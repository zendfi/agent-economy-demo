/**
 * Seller Agent - Provides services to other agents
 * Uses ZendFi SDK to receive payments
 */

import { AgentMessageLite } from './types';
import { agentStore } from './store';
import { getZendFiClient } from './zendfi-client';

export class SellerAgent {
  private agentId: string;
  private agentName: string;
  private webhookUrl: string;
  private sessionKeyId: string;
  private sessionWallet: string;
  private isAutonomous: boolean;
  private fixedPricing: Record<string, number>;

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
    this.fixedPricing = {
      'gpt4-tokens': 0.01, // $0.01 per token
    };
  }

  async initialize(): Promise<void> {
    agentStore.registerAgent({
      agent_id: this.agentId,
      agent_name: this.agentName,
      webhook_url: this.webhookUrl,
      services: ['gpt4-tokens'],
      fixed_pricing: this.fixedPricing,
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
      message: `${this.agentName} registered as GPT-4 token provider (session: ${this.sessionKeyId})`,
      data: { session_wallet: this.sessionWallet },
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
      case 'service_request':
        await this.handleServiceRequest(message);
        break;

      case 'payment_notification':
        await this.handlePayment(message);
        break;
    }
  }

  private async handleServiceRequest(message: AgentMessageLite): Promise<void> {
    const request = message.payload;
    const price = this.calculatePrice(request.quantity);

    agentStore.addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agent_id: this.agentId,
      type: 'message',
      message: `Sending quote: $${price} for ${request.quantity} tokens`,
    });

    await this.sendMessage({
      from_agent_id: this.agentId,
      to_agent_id: message.from_agent_id,
      type: 'quote',
      payload: {
        price,
        quantity: request.quantity,
        delivery_time_minutes: 5,
      },
    });
  }

  private async handlePayment(message: AgentMessageLite): Promise<void> {
    const payment = message.payload;
    const zendfi = getZendFiClient();

    // Check session key balance to verify payment received
    try {
      const status = await zendfi.sessionKeys.getStatus(this.sessionKeyId);
      
      agentStore.addLog({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        agent_id: this.agentId,
        type: 'received',
        message: `💰 Payment received: $${payment.amount} (Balance: $${status.remainingUsdc})`,
        data: { 
          payment,
          session_balance: status.remainingUsdc,
          transaction_signature: payment.transaction_signature,
        },
      });
    } catch (error: any) {
      agentStore.addLog({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        agent_id: this.agentId,
        type: 'message',
        message: `Could not verify payment: ${error.message}`,
      });
    }

    agentStore.addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agent_id: this.agentId,
      type: 'message',
      message: `Buyer has 24hr to dispute if not satisfied.`,
    });

    // Simulate delivery
    await this.deliverTokens(payment);

    // Confirm delivery
    agentStore.updatePaymentStatus(payment.payment_id, {
      status: 'completed',
      delivery_confirmed_at: new Date(),
    });

    agentStore.addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agent_id: this.agentId,
      type: 'message',
      message: `Delivered ${payment.quantity} tokens`,
    });

    // Notify buyer
    await this.sendMessage({
      from_agent_id: this.agentId,
      to_agent_id: message.from_agent_id,
      type: 'delivery_confirmation',
      payload: {
        payment_id: payment.payment_id,
        tokens_delivered: payment.quantity,
      },
    });

    agentStore.addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agent_id: this.agentId,
      type: 'message',
      message: `Delivery confirmed!`,
    });
  }

  private calculatePrice(quantity: number): number {
    return quantity * this.fixedPricing['gpt4-tokens'];
  }

  private async deliverTokens(payment: any): Promise<void> {
    // Simulate token delivery delay
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  private async sendMessage(message: Omit<AgentMessageLite, 'message_id' | 'timestamp' | 'signature'>): Promise<void> {
    const fullMessage: AgentMessageLite = {
      ...message,
      message_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      signature: 'mock_signature',
    };

    agentStore.storeMessage(fullMessage);
  }

  getId(): string {
    return this.agentId;
  }
}
