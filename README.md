# Autonomous Agent Economy - POC Demo

**Real AI agents transacting autonomously using ZendFi SDK v0.7.4+ with Lit Protocol**

This demo shows two AI agents (buyer & seller) conducting fully autonomous transactions without human intervention after initial setup.

## What This Demo Shows

- **Device-Bound Session Keys**: Non-custodial session keys encrypted with PIN + Lit Protocol
- **Lit Protocol Integration**: Enables true autonomous signing when client is offline
- **Autonomous Delegates**: AI agents can sign transactions without user approval
- **Smart Payments**: Intelligent payment routing via ZendFi SDK
- **Real Blockchain**: Actual USDC transfers on Solana (test mode)

## Quick Start

```bash
# Install
npm install

# Setup environment
cp .env.local.example .env.local
# Edit .env.local with your ZendFi API key

# Run
npm run dev
```

Open http://localhost:3000 and click "🚀 Initialize Agents"

## Architecture

### Session Keys = Agent Wallets

Each agent has its own **session key wallet** (real Solana address):
- **Buyer**: $100 budget to purchase services
- **Seller**: $50 initial to receive payments

```typescript
// Create session key (generates Solana wallet)
const key = await zendfi.sessionKeys.create({
  user_wallet: 'YOUR_WALLET',
  limit_usdc: 100,
  duration_days: 7,
});

// Enable autonomous spending (no signature per transaction!)
await zendfi.autonomy.enable(key.id, {
  max_amount_usd: 100,
  duration_hours: 24,
});
```

### Payment Flow

```
User funds agents (one-time setup)
         ↓
Buyer Session Wallet (100 USDC)
         ↓ smart payment
Seller Session Wallet (receives 10 USDC)
         ↓
Check balance via SDK
```

## Key Files

- `lib/zendfi-client.ts` - SDK singleton
- `lib/session-key-setup.ts` - Creates session keys
- `lib/buyer-agent.ts` - Makes autonomous payments
- `lib/seller-agent.ts` - Receives payments
- `lib/agent-manager.ts` - Coordinates agents

## SDK Integration

### Payment Execution
```typescript
const payment = await zendfi.smart.execute({
  agent_id: 'buyer-agent',
  user_wallet: sessionWallet,
  amount_usd: 10,
  description: '1000 GPT-4 tokens',
});
```

### Balance Check
```typescript
const status = await zendfi.sessionKeys.getStatus(sessionKeyId);
console.log(`Balance: $${status.remaining_usdc}`);
```

## Environment Variables

```bash
ZENDFI_API_KEY=your_test_api_key_here  # Get from zendfi.com
ZENDFI_MODE=test                        # test or live
USER_MAIN_WALLET=your_wallet_address    # Funds session keys
```

## Testing

This runs in **test mode** (Solana devnet):
- No real money
- Mock transaction signing
- Full SDK functionality

## Learn More

- [Full Architecture Doc](../docs/AUTONOMOUS_AGENTIC_ECONOMY.md)
- [ZendFi SDK](../zendfi-toolkit/packages/sdk/)
- [ZendFi Website](https://zendfi.com)

## License

MIT
