/**
 * Buyer Agent - Purchases services from other agents
 * Uses ZendFi SDK for real payments
 */

import { AgentMessageLite, AgentProfileLite, PaymentStatus } from './types';
import { agentStore } from './store';
import { getZendFiClient } from './zendfi-client';

export class BuyerAgent {
  private agentId: string;
  private agentName: string;
  private webhookUrl: string;
  private sessionKeyId: string;
  private sessionWallet: string;
  private isAutonomous: boolean;
  
  // Idempotency: Track processed messages to prevent double-payments
  private processedMessages = new Set<string>();

  constructor(config: {
    agentId: string;
    agentName: string;
    webhookUrl: string;
    sessionKeyId: string;
    sessionWallet: string;
    isAutonomous: boolean;
  }) {
    this.agentId = config.agentId;
    this.agentName = config.agentName;
    this.webhookUrl = config.webhookUrl;
    this.sessionKeyId = config.sessionKeyId;
    this.sessionWallet = config.sessionWallet;
    this.isAutonomous = config.isAutonomous;
  }

  async initialize(): Promise<void> {
    // Register in agent registry
    agentStore.registerAgent({
      agent_id: this.agentId,
      agent_name: this.agentName,
      webhook_url: this.webhookUrl,
      services: [], // Buyer doesn't provide services
      fixed_pricing: {},
      session_key_id: this.sessionKeyId,
      session_wallet: this.sessionWallet,
      is_autonomous: this.isAutonomous,
      is_online: true,
    });

    agentStore.addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agent_id: this.agentId,
      type: 'message',
      message: `${this.agentName} initialized with session key ${this.sessionKeyId}`,
      data: { session_wallet: this.sessionWallet, is_autonomous: this.isAutonomous },
    });
  }

  async purchaseTokens(tokenCount: number): Promise<void> {
    agentStore.addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agent_id: this.agentId,
      type: 'message',
      message: `Looking for GPT-4 token provider...`,
    });

    // 1. Find provider
    const agents = agentStore.listAgents();
    const provider = agents.find(a => a.services.includes('gpt4-tokens'));

    if (!provider) {
      throw new Error('No provider found');
    }

    agentStore.addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agent_id: this.agentId,
      type: 'message',
      message: `Found provider: ${provider.agent_name}`,
    });

    // 2. Send service request
    await this.sendMessage({
      from_agent_id: this.agentId,
      to_agent_id: provider.agent_id,
      type: 'service_request',
      payload: {
        service_type: 'gpt4-tokens',
        quantity: tokenCount,
      },
    });

    agentStore.addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agent_id: this.agentId,
      type: 'sent',
      message: `Service request sent. Waiting for quote...`,
    });
  }

  async handleMessage(message: AgentMessageLite): Promise<void> {
    // IDEMPOTENCY CHECK: Prevent duplicate processing
    if (this.processedMessages.has(message.message_id)) {
      agentStore.addLog({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        agent_id: this.agentId,
        type: 'message',
        message: `⚠️  Ignoring duplicate message: ${message.message_id}`,
        data: { message_id: message.message_id, type: message.type },
      });
      return;
    }
    
    // Mark as processed FIRST (before any async operations)
    this.processedMessages.add(message.message_id);
    
    agentStore.addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agent_id: this.agentId,
      type: 'received',
      message: `Received ${message.type}`,
      data: message,
    });

    try {
      switch (message.type) {
        case 'quote':
          await this.handleQuote(message);
          break;

        case 'delivery_confirmation':
          await this.handleDelivery(message);
          break;
      }
    } catch (error: any) {
      agentStore.addLog({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        agent_id: this.agentId,
        type: 'message',
        message: `❌ Error handling ${message.type}: ${error.message}`,
        data: { message_id: message.message_id, error: error.message },
      });
      // Remove from processed set on error to allow retry
      this.processedMessages.delete(message.message_id);
      throw error;
    }
  }

  private async handleQuote(message: AgentMessageLite): Promise<void> {
    const quote = message.payload;
    const zendfi = getZendFiClient();
    
    agentStore.addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agent_id: this.agentId,
      type: 'message',
      message: `Quote received: $${quote.price} for ${quote.quantity} tokens`,
    });

    // Auto-accept quote and pay using ZendFi SDK
    try {
      agentStore.addLog({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        agent_id: this.agentId,
        type: 'message',
        message: `Executing payment via ZendFi...`,
      });

      // Find seller's session wallet
      const seller = agentStore.getAgent(message.from_agent_id);
      if (!seller) {
        throw new Error('Seller agent not found');
      }

      // Execute autonomous payment using session key with Lit Protocol
      // Backend will sign using Lit-encrypted keypair (no user interaction needed!)
      const payment = await zendfi.sessionKeys.makePayment({
        sessionKeyId: this.sessionKeyId,
        amount: quote.price,
        recipient: seller.session_wallet,
        description: `${quote.quantity} GPT-4 tokens`,
      });

      const refundable_until = new Date(Date.now() + 24 * 60 * 60 * 1000);

      agentStore.addLog({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        agent_id: this.agentId,
        type: 'message',
        message: `🤖 Autonomous signing via Lit Protocol...`,
      });

      // Store payment with state machine
      const now = new Date();
      agentStore.storePayment({
        payment_id: payment.paymentId,
        status: PaymentStatus.PAYMENT_SENT,
        buyer_agent_id: this.agentId,
        seller_agent_id: message.from_agent_id,
        amount: quote.price,
        service_type: 'gpt4-tokens',
        transaction_signature: payment.signature,
        events: [
          {
            status: PaymentStatus.PAYMENT_SENT,
            timestamp: now,
            actor: this.agentId,
            metadata: { quantity: quote.quantity },
          }
        ],
        refundable_until,
        created_at: now,
        updated_at: now,
      });
      
      // Update to delivery pending
      agentStore.updatePaymentStatus(
        payment.paymentId,
        PaymentStatus.DELIVERY_PENDING,
        this.agentId,
        { awaiting_delivery: true }
      );

      agentStore.addLog({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        agent_id: this.agentId,
        type: 'sent',
        message: `✅ Payment sent: $${quote.price} (TX: ${payment.signature?.slice(0, 8)}...)`,
        data: { 
          payment_id: payment.paymentId,
          amount: quote.price,
          signature: payment.signature,
          refundable_until: refundable_until.toISOString(),
        },
      });

      // Notify seller
      await this.sendMessage({
        from_agent_id: this.agentId,
        to_agent_id: message.from_agent_id,
        type: 'payment_notification',
        payload: {
          payment_id: payment.paymentId,
          amount: quote.price,
          service_type: 'gpt4-tokens',
          quantity: quote.quantity,
          transaction_signature: payment.signature,
          refundable_until: refundable_until.toISOString(),
        },
      });
    } catch (error: any) {
      agentStore.addLog({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        agent_id: this.agentId,
        type: 'message',
        message: ` Payment failed: ${error.message}`,
        data: { error: error.message },
      });
    }
  }

  private async handleDelivery(message: AgentMessageLite): Promise<void> {
    agentStore.addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agent_id: this.agentId,
      type: 'message',
      message: `Tokens delivered! Transaction complete.`,
      data: message.payload,
    });
  }

  private async sendMessage(message: Omit<AgentMessageLite, 'message_id' | 'timestamp' | 'signature'>): Promise<void> {
    const fullMessage: AgentMessageLite = {
      ...message,
      message_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      signature: 'mock_signature', // In production: sign with agent's key
    };

    agentStore.storeMessage(fullMessage);
  }

  getId(): string {
    return this.agentId;
  }
}
