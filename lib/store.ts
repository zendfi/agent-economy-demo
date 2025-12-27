/**
 * In-Memory Store for Demo Agents
 * (In production, use a real database)
 */

import { AgentProfileLite, AgentMessageLite, PaymentWithRefundWindow, TransactionLog } from './types';

class AgentStore {
  private agents: Map<string, AgentProfileLite> = new Map();
  private messages: Map<string, AgentMessageLite[]> = new Map();
  private payments: Map<string, PaymentWithRefundWindow> = new Map();
  private logs: TransactionLog[] = [];

  // Agent Registry
  registerAgent(profile: AgentProfileLite): void {
    this.agents.set(profile.agent_id, profile);
    this.addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agent_id: profile.agent_id,
      type: 'message',
      message: `Agent registered: ${profile.agent_name}`,
      data: profile,
    });
  }

  getAgent(agent_id: string): AgentProfileLite | undefined {
    return this.agents.get(agent_id);
  }

  listAgents(): AgentProfileLite[] {
    return Array.from(this.agents.values());
  }

  setAgentOnline(agent_id: string, online: boolean): void {
    const agent = this.agents.get(agent_id);
    if (agent) {
      agent.is_online = online;
      this.agents.set(agent_id, agent);
    }
  }

  // Messaging
  storeMessage(message: AgentMessageLite): void {
    const messages = this.messages.get(message.to_agent_id) || [];
    messages.push(message);
    this.messages.set(message.to_agent_id, messages);

    this.addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agent_id: message.from_agent_id,
      type: 'sent',
      message: `Message sent: ${message.type}`,
      data: message,
    });
  }

  getMessages(agent_id: string): AgentMessageLite[] {
    return this.messages.get(agent_id) || [];
  }

  clearMessages(agent_id: string): void {
    this.messages.set(agent_id, []);
  }

  // Payments
  storePayment(payment: PaymentWithRefundWindow): void {
    this.payments.set(payment.payment_id, payment);
    this.addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agent_id: payment.buyer_agent_id,
      type: 'sent',
      message: `Payment sent: $${payment.amount}`,
      data: payment,
    });
  }

  getPayment(payment_id: string): PaymentWithRefundWindow | undefined {
    return this.payments.get(payment_id);
  }

  updatePaymentStatus(payment_id: string, updates: Partial<PaymentWithRefundWindow>): void {
    const payment = this.payments.get(payment_id);
    if (payment) {
      Object.assign(payment, updates);
      this.payments.set(payment_id, payment);
    }
  }

  // Logs
  addLog(log: TransactionLog): void {
    this.logs.push(log);
  }

  getLogs(agent_id?: string): TransactionLog[] {
    if (agent_id) {
      return this.logs.filter(log => log.agent_id === agent_id);
    }
    return this.logs;
  }

  clearLogs(): void {
    this.logs = [];
  }

  // Reset all
  reset(): void {
    this.agents.clear();
    this.messages.clear();
    this.payments.clear();
    this.logs = [];
  }
}

// Singleton instance
export const agentStore = new AgentStore();
