/**
 * Agent Economy Demo - Type Definitions
 */

export interface AgentMessageLite {
  type: 'service_request' | 'quote' | 'payment_notification' | 'delivery_confirmation';
  from_agent_id: string;
  to_agent_id: string;
  payload: any;
  signature: string;
  timestamp: string;
  message_id: string;
}

export interface AgentProfileLite {
  agent_id: string;
  agent_name: string;
  webhook_url: string;
  services: string[];
  fixed_pricing: Record<string, number>;
  session_wallet: string;
  is_online: boolean;
}

export interface A2APaymentRequestLite {
  buyer_agent_id: string;
  seller_agent_id: string;
  amount: number;
  service_type: string;
  description: string;
}

export interface PaymentWithRefundWindow {
  payment_id: string;
  buyer_agent_id: string;
  seller_agent_id: string;
  amount: number;
  status: 'pending_delivery' | 'completed' | 'disputed' | 'refunded';
  refundable_until: Date;
  delivery_confirmed_at?: Date;
  created_at: Date;
}

export interface TransactionLog {
  id: string;
  timestamp: Date;
  agent_id: string;
  type: 'sent' | 'received' | 'message';
  message: string;
  data?: any;
}
