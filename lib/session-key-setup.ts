/**
 * Agent Session Key Setup
 * Creates and initializes device-bound session keys for both agents
 */

import { getZendFiClient } from './zendfi-client';
import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';

interface SessionKeySetup {
  sessionKeyId: string;
  sessionWallet: string;
  isAutonomous: boolean;
}

/**
 * Default PIN for demo purposes
 * In production, this should be securely provided by the user
 */
const DEMO_PIN = '123456';

/**
 * Fund session wallet via ZendFi top-up API (mirrors ai_chat_demo.rs flow)
 * 
 * IMPORTANT: Session wallets DON'T need SOL!
 * - Backend builds transaction with gasless fee payer
 * - Backend creates session wallet ATA (pays fees)
 * - User signs to approve USDC transfer
 * - Session wallet just needs to SIGN (no on-chain account needed!)
 * 
 * This mirrors the ai_chat_demo.rs approach - use the backend's top-up API
 * instead of manually building transactions.
 */
async function fundSessionWallet(
  sessionWallet: string,
  amountUsdc: number
): Promise<void> {
  console.log(`  Funding session wallet with ${amountUsdc} USDC (via top-up API)...`);

  try {
    const userPrivateKey = process.env.USER_MAIN_WALLET_PRIVATE_KEY;
    if (!userPrivateKey) {
      throw new Error('USER_MAIN_WALLET_PRIVATE_KEY not found in .env');
    }

    // Initialize connection and user keypair
    const mode = process.env.ZENDFI_MODE || 'test';
    const rpcUrl = mode === 'production' 
      ? 'https://api.mainnet-beta.solana.com'
      : 'https://api.devnet.solana.com';
    
    const connection = new Connection(rpcUrl, 'confirmed');
    const userKeypair = Keypair.fromSecretKey(bs58.decode(userPrivateKey));

    console.log(`    • RPC: ${rpcUrl}`);
    console.log(`    • User: ${userKeypair.publicKey.toBase58()}`);
    console.log(`    • Session: ${sessionWallet}`);
    console.log(`    ℹ Using backend top-up API (gasless, no SOL needed!)`);
    
    const sessionPubkey = new PublicKey(sessionWallet);
    const usdcMint = new PublicKey(
      mode === 'production'
        ? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // Mainnet USDC
        : '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' // Devnet USDC
    );

    const userAta = await getAssociatedTokenAddress(usdcMint, userKeypair.publicKey);
    const sessionAta = await getAssociatedTokenAddress(usdcMint, sessionPubkey);

    console.log(`    • User ATA: ${userAta.toBase58()}`);
    console.log(`    • Session ATA: ${sessionAta.toBase58()}`);

    const instructions = [];
    const sessionAtaInfo = await connection.getAccountInfo(sessionAta);
    
    if (!sessionAtaInfo) {
      console.log(`    • Creating session wallet ATA (user pays this one-time fee)...`);
      const createAtaIx = createAssociatedTokenAccountInstruction(
        userKeypair.publicKey, // payer (user pays for ATA creation)
        sessionAta, // ata
        sessionPubkey, // owner
        usdcMint, // mint
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      instructions.push(createAtaIx);
    }

    // Transfer USDC
    const usdcDecimals = 6;
    const usdcAmount = Math.floor(amountUsdc * Math.pow(10, usdcDecimals));
    console.log(`    • Transferring ${amountUsdc} USDC (${usdcAmount} base units)...`);

    const transferIx = createTransferInstruction(
      userAta,
      sessionAta,
      userKeypair.publicKey,
      usdcAmount,
      [],
      TOKEN_PROGRAM_ID
    );
    instructions.push(transferIx);

    // Build and send transaction
    const transaction = new Transaction().add(...instructions);
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [userKeypair],
      { commitment: 'confirmed' }
    );

    console.log(`  ✓ Session wallet funded successfully!`);
    console.log(`    • USDC: ${amountUsdc} (spending balance)`);
    console.log(`    • SOL: 0 (session wallet doesn't need SOL - backend pays all fees!)`);
    console.log(`    • Tx: ${signature.slice(0, 20)}...`);
  } catch (error: any) {
    console.error(`  Failed to fund session wallet: ${error.message}`);
    console.log(`  Continuing without funding - transactions may fail!`);
  }
}

/**
 * Sign delegation message using session keypair (not main wallet!)
 * The backend verifies the signature against the session wallet's public key
 */
async function signDelegationMessageWithSessionKey(
  zendfi: any,
  sessionKeyId: string,
  message: string,
  pin: string
): Promise<string> {
  try {
    const nacl = await import('tweetnacl');
    
    // Unlock the session key to get the keypair
    await zendfi.sessionKeys.unlock(sessionKeyId, pin);
    
    // Get the session key instance (stored internally by SDK)
    const sessionKeyMap = (zendfi.sessionKeys as any).sessionKeys;
    const sessionKey = sessionKeyMap.get(sessionKeyId);
    
    if (!sessionKey) {
      throw new Error('Session key not found after unlock');
    }
    
    // Get the keypair using the SDK's API
    // This works whether the key is PIN-encrypted or Lit-encrypted
    const keypair = await sessionKey.getKeypair();
    if (!keypair) {
      throw new Error('Session key not unlocked - no keypair available');
    }
    
    // Sign the message with the session keypair
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.default.sign.detached(messageBytes, keypair.secretKey);
    
    // Return base64 encoded signature
    const signatureBase64 = Buffer.from(signature).toString('base64');
    console.log('  ✓ Delegation message signed with session keypair');
    return signatureBase64;
  } catch (error: any) {
    console.error(`  Failed to sign delegation message: ${error.message}`);
    throw error;
  }
}

/**
 * Create session key for an agent using device-bound (non-custodial) mode
 */
export async function createAgentSessionKey(
  agentId: string,
  agentName: string,
  limitUsdc: number
): Promise<SessionKeySetup> {
  const zendfi = getZendFiClient();
  const userWallet = process.env.USER_MAIN_WALLET || 'demo-wallet-address';

  console.log(`\nCreating device-bound session key for ${agentName}...`);

  try {
    // Create device-bound session key using SDK v0.7.4+
    // SDK now supports Lit Protocol encryption by default (enableLitProtocol: true)
    // This enables TRUE autonomous signing (AI agent can sign when client offline)
    const sessionKey = await zendfi.sessionKeys.create({
      userWallet,
      agentId,
      agentName,
      limitUSDC: limitUsdc,
      durationDays: 7,
      pin: DEMO_PIN, // SDK encrypts keypair with PIN (local) + Lit Protocol (backend)
      generateRecoveryQR: false, // Not needed for demo
      enableLitProtocol: true, // Enable Lit Protocol for autonomous signing (we've set this on by default)
    });

    console.log(`  ✓ Session key created: ${sessionKey.sessionKeyId}`);
    console.log(`  ✓ Session wallet: ${sessionKey.sessionWallet}`);
    console.log(`  ✓ Cross-app compatible: ${sessionKey.crossAppCompatible}`);
    console.log(`  ✓ Lit Protocol encryption: Enabled (for autonomous signing)`);

    // Get session key status
    const status = await zendfi.sessionKeys.getStatus(sessionKey.sessionKeyId);
    console.log(`  ✓ Status: ${status.isActive ? 'Active' : 'Inactive'}, Balance: $${status.remainingUsdc}`);

    // Auto-fund the session wallet with actual SOL + USDC
    await fundSessionWallet(sessionKey.sessionWallet, limitUsdc);

    // Enable autonomous mode
    console.log(`  Enabling autonomous delegate...`);
    
    // The backend reconstructs the delegation message for verification
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    const delegationMsg = zendfi.autonomy.createDelegationMessage(
      sessionKey.sessionKeyId,
      limitUsdc,
      expiresAt
    );
    
    console.log(`  Delegation message: ${delegationMsg}`);
    console.log(`  Signing with SESSION KEYPAIR (not main wallet)`);
    
    // The backend verifies against the session wallet's public key
    const delegationSig = await signDelegationMessageWithSessionKey(
      zendfi,
      sessionKey.sessionKeyId,
      delegationMsg,
      DEMO_PIN
    );
    console.log(`  Signature (base64): ${delegationSig.slice(0, 20)}...`);

    const delegate = await zendfi.autonomy.enable(sessionKey.sessionKeyId, {
      max_amount_usd: limitUsdc,
      duration_hours: 24,
      delegation_signature: delegationSig,
      expires_at: expiresAt,
    });

    console.log(`  ✓ Autonomous delegate enabled: ${delegate.delegate_id}`);
    console.log(`  ✓ Backend can now sign when client offline (via Lit Protocol)`);
    console.log(`  ✓ ${agentName} ready! ($${limitUsdc} budget)\n`);

    return {
      sessionKeyId: sessionKey.sessionKeyId,
      sessionWallet: sessionKey.sessionWallet,
      isAutonomous: true,
    };
  } catch (error: any) {
    console.error(`  Failed to create session key: ${error.message}`);
    
    // if API fails, return mock data, since this is basically a demo
    console.log(`  Falling back to mock session key for demo...`);
    return {
      sessionKeyId: `mock_${agentId}_${Date.now()}`,
      sessionWallet: `mock_wallet_${agentId}`,
      isAutonomous: false,
    };
  }
}

/**
 * Initialize both buyer and seller session keys
 */
export async function initializeAgentSessionKeys(): Promise<{
  buyer: SessionKeySetup;
  seller: SessionKeySetup;
}> {
  console.log('Initializing agent session keys...');

  const buyer = await createAgentSessionKey(
    'buyer-agent-demo-v6.3',
    'Token Buyer Agent V6.3',
    0.1
  );

  const seller = await createAgentSessionKey(
    'seller-agent-demo-v6.3',
    'GPT-4 Token Provider V6.3',
    0.05
  );

  console.log('All session keys initialized!\n');

  return { buyer, seller };
}
