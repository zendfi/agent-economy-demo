/**
 * Example: Using Payment State Machine and Idempotency
 * 
 * This demonstrates the new features:
 * 1. Idempotency protection against duplicate messages
 * 2. Payment state machine with event tracking
 * 3. State transition validation
 */

import { agentStore } from './store';
import { PaymentStatus, PaymentState } from './types';

// Creating a payment with initial state
function createPaymentExample() {
  const payment: PaymentState = {
    payment_id: 'example-payment-123',
    status: PaymentStatus.INITIATED,
    buyer_agent_id: 'buyer-1',
    seller_agent_id: 'seller-1',
    amount: 0.05,
    service_type: 'gpt4-tokens',
    events: [],
    refundable_until: new Date(Date.now() + 24 * 60 * 60 * 1000),
    created_at: new Date(),
    updated_at: new Date(),
  };

  agentStore.storePayment(payment);
  console.log('Payment created in INITIATED state');
}

// Valid state transitions
function validStateTransitionsExample() {
  const paymentId = 'example-payment-123';
  
  try {
    agentStore.updatePaymentStatus(
      paymentId,
      PaymentStatus.QUOTE_RECEIVED,
      'seller-1',
      { quote_amount: 0.05 }
    );
    console.log('Transition: INITIATED → QUOTE_RECEIVED');

    agentStore.updatePaymentStatus(
      paymentId,
      PaymentStatus.PAYMENT_SENT,
      'buyer-1',
      { tx_signature: '5eed47c4...' }
    );
    console.log('Transition: QUOTE_RECEIVED → PAYMENT_SENT');

    agentStore.updatePaymentStatus(
      paymentId,
      PaymentStatus.DELIVERY_PENDING,
      'seller-1',
      { delivery_eta: '2 mins' }
    );
    console.log('Transition: PAYMENT_SENT → DELIVERY_PENDING');

    // Valid: DELIVERY_PENDING → COMPLETED
    agentStore.updatePaymentStatus(
      paymentId,
      PaymentStatus.COMPLETED,
      'seller-1',
      { delivered_at: new Date().toISOString() }
    );
    console.log('Transition: DELIVERY_PENDING → COMPLETED');

  } catch (error: any) {
    console.error('State transition failed:', error.message);
  }
}

// Invalid state transition (will throw error)
function invalidStateTransitionExample() {
  const payment: PaymentState = {
    payment_id: 'invalid-payment-456',
    status: PaymentStatus.INITIATED,
    buyer_agent_id: 'buyer-1',
    seller_agent_id: 'seller-1',
    amount: 0.05,
    service_type: 'gpt4-tokens',
    events: [],
    refundable_until: new Date(Date.now() + 24 * 60 * 60 * 1000),
    created_at: new Date(),
    updated_at: new Date(),
  };

  agentStore.storePayment(payment);

  try {
    // INVALID: Can't go directly from INITIATED to COMPLETED
    agentStore.updatePaymentStatus(
      payment.payment_id,
      PaymentStatus.COMPLETED,
      'seller-1'
    );
  } catch (error: any) {
    console.log('Invalid transition prevented:', error.message);
    // Expected: "Invalid state transition: initiated → completed"
  }
}

// Viewing payment event history
function paymentEventHistoryExample() {
  const paymentId = 'example-payment-123';
  const events = agentStore.getPaymentEvents(paymentId);
  
  console.log('\nPayment Event History:');
  events.forEach((event, i) => {
    console.log(`  ${i + 1}. ${event.status} (${event.actor}) at ${event.timestamp.toISOString()}`);
    if (event.metadata) {
      console.log(`     Metadata:`, event.metadata);
    }
  });
}

// Checking refund eligibility
function checkRefundEligibilityExample() {
  const paymentId = 'example-payment-123';
  const canRefund = agentStore.canRefundPayment(paymentId);
  
  if (canRefund) {
    console.log('Payment is within refund window');
  } else {
    console.log('Payment cannot be refunded (completed or window expired)');
  }
}

// Idempotency demonstration
function idempotencyExample() {
  console.log('\nIdempotency Test:');
  
  // Simulate the same message being processed twice
  const duplicateMessageId = 'msg-duplicate-789';
  const processedMessages = new Set<string>();
  
  // First attempt
  if (!processedMessages.has(duplicateMessageId)) {
    processedMessages.add(duplicateMessageId);
    console.log('First attempt: Message processed');
  }
  
  // Second attempt (duplicate)
  if (!processedMessages.has(duplicateMessageId)) {
    processedMessages.add(duplicateMessageId);
    console.log('This should not print');
  } else {
    console.log('Second attempt: Duplicate detected and prevented!');
  }
}

// Recovery from crash mid-transaction
function crashRecoveryExample() {
  console.log('\nCrash Recovery Scenario:');
  
  // Agent crashes after payment sent but before delivery confirmed
  const payment = agentStore.getPayment('example-payment-123');
  
  if (payment) {
    console.log(`Current status: ${payment.status}`);
    console.log(`Last event: ${payment.events[payment.events.length - 1].status}`);
    
    // Agent can resume from current state
    if (payment.status === PaymentStatus.DELIVERY_PENDING) {
      console.log('Agent can resume delivery from DELIVERY_PENDING state');
    } else if (payment.status === PaymentStatus.COMPLETED) {
      console.log('Payment already completed, no action needed');
    }
  }
}

// Run all examples
export function runStateManagementExamples() {
  console.log('Payment State Machine & Idempotency Examples\n');
  
  createPaymentExample();
  console.log('');
  
  validStateTransitionsExample();
  console.log('');
  
  invalidStateTransitionExample();
  console.log('');
  
  paymentEventHistoryExample();
  console.log('');
  
  checkRefundEligibilityExample();
  
  idempotencyExample();
  
  crashRecoveryExample();
  
  console.log('\nAll examples completed!');
}
