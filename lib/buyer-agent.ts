/**
 * Buyer Agent - Purchases services from other agents
 */

import { AgentMessageLite, AgentProfileLite } from './types';
import { agentStore } from './store';

export class BuyerAgent {
  private agentId: string;
  private agentName: string;
  private webhookUrl: string;
  private sessionWallet: string;

  constructor(config: {
    agentId: string;
    agentName: string;
    webhookUrl: string;
    sessionWallet: string;
  }) {
    this.agentId = config.agentId;
    this.agentName = config.agentName;
    this.webhookUrl = config.webhookUrl;
    this.sessionWallet = config.sessionWallet;
  }

  async initialize(): Promise<void> {
    // Register in agent registry
    agentStore.registerAgent({
      agent_id: this.agentId,
      agent_name: this.agentName,
      webhook_url: this.webhookUrl,
      services: [], // Buyer doesn't provide services
      fixed_pricing: {},
      session_wallet: this.sessionWallet,
      is_online: true,
    });

    agentStore.addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agent_id: this.agentId,
      type: 'message',
      message: `${this.agentName} initialized and online`,
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
    agentStore.addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agent_id: this.agentId,
      type: 'received',
      message: `Received ${message.type}`,
      data: message,
    });

    switch (message.type) {
      case 'quote':
        await this.handleQuote(message);
        break;

      case 'delivery_confirmation':
        await this.handleDelivery(message);
        break;
    }
  }

  private async handleQuote(message: AgentMessageLite): Promise<void> {
    const quote = message.payload;
    
    agentStore.addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agent_id: this.agentId,
      type: 'message',
      message: `Quote received: $${quote.price} for ${quote.quantity} tokens`,
    });

    // Auto-accept quote and pay
    const payment_id = crypto.randomUUID();
    const refundable_until = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Store payment
    agentStore.storePayment({
      payment_id,
      buyer_agent_id: this.agentId,
      seller_agent_id: message.from_agent_id,
      amount: quote.price,
      status: 'pending_delivery',
      refundable_until,
      created_at: new Date(),
    });

    agentStore.addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agent_id: this.agentId,
      type: 'sent',
      message: `Payment sent: $${quote.price}. Refundable until ${refundable_until.toLocaleString()}`,
      data: { payment_id, amount: quote.price },
    });

    // Notify seller
    await this.sendMessage({
      from_agent_id: this.agentId,
      to_agent_id: message.from_agent_id,
      type: 'payment_notification',
      payload: {
        payment_id,
        amount: quote.price,
        service_type: 'gpt4-tokens',
        quantity: quote.quantity,
        refundable_until: refundable_until.toISOString(),
      },
    });
  }

  private async handleDelivery(message: AgentMessageLite): Promise<void> {
    agentStore.addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agent_id: this.agentId,
      type: 'message',
      message: `✅ Tokens delivered! Transaction complete.`,
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
