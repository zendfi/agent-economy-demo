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
    
    // Get the decrypted keypair from cache
    const keypair = (sessionKey as any).cachedKeypair;
    if (!keypair) {
      throw new Error('Session key not unlocked - no cached keypair');
    }
    
    // Sign the message with the session keypair
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.default.sign.detached(messageBytes, keypair.secretKey);
    
    // Return base64 encoded signature
    const signatureBase64 = Buffer.from(signature).toString('base64');
    console.log('  ✓ Delegation message signed with session keypair');
    return signatureBase64;
  } catch (error: any) {
    console.error(`  ❌ Failed to sign delegation message: ${error.message}`);
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
    console.log(`  Enabling autonomous delegate...`);
    
    // CRITICAL: Use the SAME expires_at in both message and request!
    // The backend reconstructs the delegation message for verification
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    const delegationMsg = zendfi.autonomy.createDelegationMessage(
      sessionKey.sessionKeyId,
      limitUsdc,
      expiresAt
    );
    
    console.log(`  Delegation message: ${delegationMsg}`);
    console.log(`  Signing with SESSION KEYPAIR (not main wallet)`);
    
    // IMPORTANT: Sign with session keypair, not main wallet!
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
      expires_at: expiresAt, // Pass the SAME expires_at!
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
  console.log('Initializing agent session keys...');

  const buyer = await createAgentSessionKey(
    'buyer-agent-demo-v5.3',
    'Token Buyer Agent V5.3',
    0.1
  );

  const seller = await createAgentSessionKey(
    'seller-agent-demo-v5.3',
    'GPT-4 Token Provider V5.3',
    0.05
  );

  console.log('All session keys initialized!\n');

  return { buyer, seller };
}
