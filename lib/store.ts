/**
 * In-Memory Store for Demo Agents
 * (In production, use a real database)
 */

import { AgentProfileLite, AgentMessageLite, PaymentState, PaymentStatus, PaymentEvent, TransactionLog } from './types';

class AgentStore {
  private agents: Map<string, AgentProfileLite> = new Map();
  private messages: Map<string, AgentMessageLite[]> = new Map();
  private payments: Map<string, PaymentState> = new Map();
  private logs: TransactionLog[] = [];

  // Valid state transitions for payment state machine
  private readonly validTransitions: Record<PaymentStatus, PaymentStatus[]> = {
    [PaymentStatus.INITIATED]: [PaymentStatus.QUOTE_RECEIVED],
    [PaymentStatus.QUOTE_RECEIVED]: [PaymentStatus.PAYMENT_SENT],
    [PaymentStatus.PAYMENT_SENT]: [PaymentStatus.DELIVERY_PENDING, PaymentStatus.DISPUTED],
    [PaymentStatus.DELIVERY_PENDING]: [PaymentStatus.COMPLETED, PaymentStatus.DISPUTED, PaymentStatus.REFUNDED],
    [PaymentStatus.COMPLETED]: [], // Terminal state
    [PaymentStatus.DISPUTED]: [PaymentStatus.REFUNDED, PaymentStatus.COMPLETED],
    [PaymentStatus.REFUNDED]: [], // Terminal state
  };

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

  // Payments with State Machine
  storePayment(payment: PaymentState): void {
    // Initialize with first event if events array is empty
    if (payment.events.length === 0) {
      payment.events.push({
        status: payment.status,
        timestamp: new Date(),
        actor: payment.buyer_agent_id,
      });
    }
    
    this.payments.set(payment.payment_id, payment);
    this.addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agent_id: payment.buyer_agent_id,
      type: 'sent',
      message: `Payment ${payment.status}: $${payment.amount}`,
      data: payment,
    });
  }

  getPayment(payment_id: string): PaymentState | undefined {
    return this.payments.get(payment_id);
  }

  /**
   * Update payment status with state machine validation
   * @throws Error if transition is invalid
   */
  updatePaymentStatus(
    payment_id: string,
    newStatus: PaymentStatus,
    actor: string,
    metadata?: Record<string, any>
  ): void {
    const payment = this.payments.get(payment_id);
    if (!payment) {
      throw new Error(`Payment ${payment_id} not found`);
    }

    // Validate state transition
    if (!this.isValidTransition(payment.status, newStatus)) {
      throw new Error(
        `Invalid state transition: ${payment.status} → ${newStatus}. ` +
        `Valid transitions from ${payment.status}: ${this.validTransitions[payment.status].join(', ')}`
      );
    }

    // Update payment
    payment.status = newStatus;
    payment.updated_at = new Date();
    
    // Add event to history
    payment.events.push({
      status: newStatus,
      timestamp: new Date(),
      actor,
      metadata,
    });

    this.payments.set(payment_id, payment);

    this.addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agent_id: actor,
      type: 'message',
      message: `Payment ${payment_id} → ${newStatus}`,
      data: { payment_id, newStatus, actor, metadata },
    });
  }

  /**
   * Check if a state transition is valid
   */
  private isValidTransition(currentStatus: PaymentStatus, newStatus: PaymentStatus): boolean {
    const allowedTransitions = this.validTransitions[currentStatus];
    return allowedTransitions.includes(newStatus);
  }

  /**
   * Get payment event history
   */
  getPaymentEvents(payment_id: string): PaymentEvent[] {
    const payment = this.payments.get(payment_id);
    return payment?.events || [];
  }

  /**
   * Check if payment can be refunded (within refund window)
   */
  canRefundPayment(payment_id: string): boolean {
    const payment = this.payments.get(payment_id);
    if (!payment) return false;
    
    const now = new Date();
    return (
      payment.status === PaymentStatus.DELIVERY_PENDING &&
      now < payment.refundable_until
    );
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
