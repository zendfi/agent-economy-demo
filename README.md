# Agent Economy Demo

Two AI agents autonomously buying and selling services using real blockchain payments.

## What It Does

**Buyer Agent** wants 5 GPT-4 tokens.  
**Seller Agent** provides them for $0.05.  
They negotiate, pay, and deliver, **completely autonomously**.

## The Magic

### 1. **Session Wallets** (Real Solana Addresses)
Each agent gets its own wallet with USDC:
- Buyer: `0.1 USDC` spending budget
- Seller: `0.05 USDC` initial balance

### 2. **Gasless Payments** (0 SOL Required)
Session wallets hold **0 SOL**—backend pays all transaction fees.

### 3. **Autonomous Signing** (Lit Protocol)
Agents can sign transactions when offline. No human clicks needed.

### 4. **State Machine** (Crash Recovery)
Every payment tracked through states:
```
INITIATED → QUOTE_RECEIVED → PAYMENT_SENT → DELIVERY_PENDING → COMPLETED
```

### 5. **Idempotency** (No Double-Payments)
Network retries can't cause duplicate payments—every message processed once.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000 → Click **"🚀 Initialize Agents"**

## What Happens

1. **Setup** - Create session keys for both agents
2. **Fund** - Transfer USDC to session wallets (user pays ATA creation fee)
3. **Negotiate** - Buyer requests quote, seller responds
4. **Pay** - Buyer sends $0.05 USDC (autonomous, gasless)
5. **Deliver** - Seller delivers tokens, confirms completion

## The Transaction

```typescript
// Buyer makes payment (autonomous, no approval needed)
const payment = await zendfi.sessionKeys.makePayment({
  sessionKeyId: buyerSessionKey,
  amount: 0.05,
  recipient: sellerSessionWallet,
  description: '5 GPT-4 tokens',
});

// Backend automatically:
// Uses gasless transaction (buyer has 0 SOL)
// Creates seller ATA if needed (backend pays)
// Buyer session wallet signs to authorize USDC transfer
// Transaction confirmed in ~500ms
```

## Architecture

```
┌─────────────────────┐
│   User Wallet       │  (One-time: Fund session wallets)
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
┌─────────┐  ┌──────────┐
│ Buyer   │  │ Seller   │  (Session wallets with 0 SOL)
│ Session │  │ Session  │
│ Wallet  │  │ Wallet   │ 
│ 0.1 USDC│  │ 0.05 USDC│
└────┬────┘  └────┬─────┘
     │            ▲
     │  Payment   │
     └────────────┘
         $0.05
     (Gasless, Autonomous)
```

## Key Features

| Feature | How It Works |
|---------|-------------|
| **Gasless** | Session wallets have 0 SOL; backend pays all fees |
| **Autonomous** | Lit Protocol enables offline signing |
| **Safe** | State machine prevents invalid transitions |
| **Reliable** | Idempotency prevents duplicate payments |
| **Real** | Actual Solana transactions on devnet |

## Files

- `lib/buyer-agent.ts` - Purchases services autonomously
- `lib/seller-agent.ts` - Provides services autonomously  
- `lib/session-key-setup.ts` - Creates & funds session wallets
- `lib/store.ts` - State machine & payment tracking
- `lib/types.ts` - Payment states & types

## Environment

```bash
ZENDFI_API_KEY=your_api_key
ZENDFI_MODE=test
USER_MAIN_WALLET=your_solana_wallet
```

## Status

**Production-Ready Features:**
- Gasless transactions (session wallets need 0 SOL)
- Autonomous signing (Lit Protocol integration)
- Payment state machine (crash recovery)
- Idempotency protection (no double-payments)
- Event history (full audit trail)

**Test Mode:**
- Runs on Solana devnet
- No real money
- Full functionality

---

**Built with [ZendFi SDK](https://github.com/zendfi/zendfi-toolkit/packages/sdk) + [Lit Protocol](https://litprotocol.com)**
