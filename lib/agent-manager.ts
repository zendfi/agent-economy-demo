/**
 * Agent Manager - Coordinates agents and message delivery
 * Uses ZendFi SDK for session key management
 */

import { BuyerAgent } from './buyer-agent';
import { SellerAgent } from './seller-agent';
import { agentStore } from './store';
import { initializeAgentSessionKeys } from './session-key-setup';

class AgentManager {
  private buyerAgent: BuyerAgent | null = null;
  private sellerAgent: SellerAgent | null = null;
  private messageProcessingInterval: NodeJS.Timeout | null = null;

  async initializeAgents(): Promise<void> {
    console.log('🤖 Initializing agents with ZendFi session keys...');

    // Create session keys for both agents
    const sessionKeys = await initializeAgentSessionKeys();

    // Initialize Buyer Agent
    this.buyerAgent = new BuyerAgent({
      agentId: 'buyer-agent-demo',
      agentName: 'Demo Buyer Agent',
      webhookUrl: '/api/webhook/buyer',
      sessionKeyId: sessionKeys.buyer.sessionKeyId,
      sessionWallet: sessionKeys.buyer.sessionWallet,
      isAutonomous: sessionKeys.buyer.isAutonomous,
    });
    await this.buyerAgent.initialize();

    // Initialize Seller Agent
    this.sellerAgent = new SellerAgent({
      agentId: 'seller-agent-demo',
      agentName: 'Demo GPT-4 Provider',
      webhookUrl: '/api/webhook/seller',
      sessionKeyId: sessionKeys.seller.sessionKeyId,
      sessionWallet: sessionKeys.seller.sessionWallet,
      isAutonomous: sessionKeys.seller.isAutonomous,
    });
    await this.sellerAgent.initialize();

    // Start message processing
    this.startMessageProcessing();

    console.log('✅ Both agents initialized and ready!');
  }

  private startMessageProcessing(): void {
    // Process messages every 500ms
    this.messageProcessingInterval = setInterval(() => {
      this.processMessages();
    }, 500);
  }

  private processMessages(): void {
    if (!this.buyerAgent || !this.sellerAgent) return;

    // Process buyer messages
    const buyerMessages = agentStore.getMessages(this.buyerAgent.getId());
    if (buyerMessages.length > 0) {
      buyerMessages.forEach(msg => this.buyerAgent!.handleMessage(msg));
      agentStore.clearMessages(this.buyerAgent.getId());
    }

    // Process seller messages
    const sellerMessages = agentStore.getMessages(this.sellerAgent.getId());
    if (sellerMessages.length > 0) {
      sellerMessages.forEach(msg => this.sellerAgent!.handleMessage(msg));
      agentStore.clearMessages(this.sellerAgent.getId());
    }
  }

  async triggerPurchase(tokenCount: number): Promise<void> {
    if (!this.buyerAgent) {
      throw new Error('Agents not initialized');
    }
    await this.buyerAgent.purchaseTokens(tokenCount);
  }

  reset(): void {
    if (this.messageProcessingInterval) {
      clearInterval(this.messageProcessingInterval);
      this.messageProcessingInterval = null;
    }
    this.buyerAgent = null;
    this.sellerAgent = null;
    agentStore.reset();
  }

  isInitialized(): boolean {
    return this.buyerAgent !== null && this.sellerAgent !== null;
  }
}

// Singleton instance
export const agentManager = new AgentManager();
