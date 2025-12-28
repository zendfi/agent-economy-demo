/**
 * Agent Session Key Setup
 * Creates and initializes device-bound session keys for both agents
 */

import { getZendFiClient } from './zendfi-client';

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
 * Sign delegation message using Solana wallet
 */
async function signDelegationMessage(message: string): Promise<string> {
  try {
    // Import Solana web3.js and bs58
    const { Keypair } = await import('@solana/web3.js');
    const bs58 = await import('bs58');
    const nacl = await import('tweetnacl');
    
    // Get private key from env
    const privateKeyBase58 = process.env.USER_MAIN_WALLET_PRIVATE_KEY;
    if (!privateKeyBase58) {
      console.warn('⚠️ No private key found, cannot sign delegation message');
      return 'mock_delegation_signature_' + Date.now();
    }

    // Decode private key
    const privateKeyBytes = bs58.default.decode(privateKeyBase58);
    const keypair = Keypair.fromSecretKey(privateKeyBytes);

    // Sign the message
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.default.sign.detached(messageBytes, keypair.secretKey);
    
    // Return base64 encoded signature (API expects base64, not base58)
    const signatureBase64 = Buffer.from(signature).toString('base64');
    console.log('  ✓ Delegation message signed');
    return signatureBase64;
  } catch (error: any) {
    console.error(`  ❌ Failed to sign delegation message: ${error.message}`);
    return 'mock_delegation_signature_' + Date.now();
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

  console.log(`\n🔧 Creating device-bound session key for ${agentName}...`);

  try {
    // Create device-bound session key using new SDK API
    // The SDK handles keypair generation and PIN encryption internally
    const sessionKey = await zendfi.sessionKeys.create({
      userWallet,
      agentId,
      agentName,
      limitUSDC: limitUsdc,
      durationDays: 7,
      pin: DEMO_PIN, // SDK encrypts keypair with this PIN
      generateRecoveryQR: false, // Not needed for demo
    });

    console.log(`  ✓ Session key created: ${sessionKey.sessionKeyId}`);
    console.log(`  ✓ Session wallet: ${sessionKey.sessionWallet}`);
    console.log(`  ✓ Cross-app compatible: ${sessionKey.crossAppCompatible}`);

    // Get session key status
    const status = await zendfi.sessionKeys.getStatus(sessionKey.sessionKeyId);
    console.log(`  ✓ Status: ${status.isActive ? 'Active' : 'Inactive'}, Balance: $${status.remainingUsdc}`);

    // Enable autonomous mode
    console.log(`  ⏳ Enabling autonomous delegate...`);
    const delegationMsg = zendfi.autonomy.createDelegationMessage(
      sessionKey.sessionKeyId,
      limitUsdc,
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    );
    
    console.log(`  📝 Delegation message: ${delegationMsg}`);
    console.log(`  🔑 Signing with wallet: ${userWallet}`);
    
    const delegationSig = await signDelegationMessage(delegationMsg);
    console.log(`  ✅ Signature (base64): ${delegationSig.slice(0, 20)}...`);

    const delegate = await zendfi.autonomy.enable(sessionKey.sessionKeyId, {
      max_amount_usd: limitUsdc,
      duration_hours: 24,
      delegation_signature: delegationSig,
    });

    console.log(`  ✓ Autonomous delegate enabled: ${delegate.delegate_id}`);
    console.log(`  ✓ ${agentName} ready! ($${limitUsdc} budget)\n`);

    return {
      sessionKeyId: sessionKey.sessionKeyId,
      sessionWallet: sessionKey.sessionWallet,
      isAutonomous: true,
    };
  } catch (error: any) {
    console.error(`  ❌ Failed to create session key: ${error.message}`);
    
    // For demo purposes, if API fails, return mock data
    console.log(`  ⚠️ Falling back to mock session key for demo...`);
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
  console.log('🚀 Initializing agent session keys...');

  const buyer = await createAgentSessionKey(
    'buyer-agent-demo-v4',
    'Token Buyer Agent V4',
    0.1
  );

  const seller = await createAgentSessionKey(
    'seller-agent-demo-v4',
    'GPT-4 Token Provider V4',
    0.05
  );

  console.log('✅ All session keys initialized!\n');

  return { buyer, seller };
}
