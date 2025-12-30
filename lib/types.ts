/**
 * Agent Economy Demo - Type Definitions
 * Integrated with ZendFi SDK
 */

import type { SessionKeyStatus } from '@zendfi/sdk';

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
  
  // ZendFi Session Key Integration
  session_key_id: string; // UUID from ZendFi
  session_wallet: string; // Solana address of session wallet
  is_autonomous: boolean; // Whether autonomous delegate is enabled
  
  is_online: boolean;
}

export interface A2APaymentRequestLite {
  buyer_agent_id: string;
  seller_agent_id: string;
  amount: number;
  service_type: string;
  description: string;
}

export enum PaymentStatus {
  INITIATED = 'initiated',
  QUOTE_RECEIVED = 'quote_received',
  PAYMENT_SENT = 'payment_sent',
  DELIVERY_PENDING = 'delivery_pending',
  COMPLETED = 'completed',
  DISPUTED = 'disputed',
  REFUNDED = 'refunded',
}

export interface PaymentEvent {
  status: PaymentStatus;
  timestamp: Date;
  actor: string;
  metadata?: Record<string, any>;
}

export interface PaymentState {
  payment_id: string; // ZendFi payment ID
  status: PaymentStatus;
  buyer_agent_id: string;
  seller_agent_id: string;
  amount: number;
  service_type: string;
  transaction_signature?: string; // Solana transaction signature
  events: PaymentEvent[];
  refundable_until: Date;
  delivery_confirmed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// Legacy type alias just here for backward compatibility
export type PaymentWithRefundWindow = PaymentState;

export interface TransactionLog {
  id: string;
  timestamp: Date;
  agent_id: string;
  type: 'sent' | 'received' | 'message';
  message: string;
  data?: any;
}
