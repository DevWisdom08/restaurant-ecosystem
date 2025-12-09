# Payment Flow - Technical Documentation

## Overview

Complete payment processing architecture using Authorize.Net API with terminal integration support (Clover, Ingenico).

---

## 💳 Payment Methods Supported

1. **Credit/Debit Card** (via Authorize.Net tokenization)
2. **EMV Terminal** (Clover SDK)
3. **EMV Terminal** (Ingenico SDK)
4. **Cash** (POS only)

---

## 🔐 Authorize.Net Integration

### Environment Configuration

```typescript
const config = {
  apiLoginId: process.env.AUTHORIZE_NET_API_LOGIN_ID,
  transactionKey: process.env.AUTHORIZE_NET_TRANSACTION_KEY,
  environment: process.env.AUTHORIZE_NET_ENVIRONMENT || 'sandbox', // 'sandbox' or 'production'
  endpoint: process.env.AUTHORIZE_NET_ENVIRONMENT === 'production'
    ? 'https://api.authorize.net/xml/v1/request.api'
    : 'https://apitest.authorize.net/xml/v1/request.api'
};
```

---

## 🔄 Payment Flow

### Step 1: Card Tokenization

**Mobile/Web → API:**

```typescript
POST /api/v1/payments/tokenize

{
  "card_number": "4111111111111111",
  "expiry_month": "12",
  "expiry_year": "2027",
  "cvv": "123",
  "billing_zip": "10001"
}
```

**API → Authorize.Net:**

```typescript
import { AuthorizeNetAPI } from './services/authorizeNet';

const authorizeNet = new AuthorizeNetAPI();

const tokenResponse = await authorizeNet.createCustomerPaymentProfile({
  cardNumber: request.card_number,
  expiryMonth: request.expiry_month,
  expiryYear: request.expiry_year,
  cvv: request.cvv,
  billingZip: request.billing_zip
});

// Response
{
  "payment_token": "tok_abc123def456",
  "card_last_four": "1111",
  "card_brand": "Visa",
  "customer_profile_id": "prof_xyz789"
}
```

### Step 2: Create Order

**Mobile/Web → API:**

```typescript
POST /api/v1/orders/create

{
  "location_id": 1,
  "order_type": "delivery",
  "items": [...],
  "tip_amount": 5.00,
  "loyalty_points_to_redeem": 100
}
```

**Response:**

```typescript
{
  "order_id": 5001,
  "order_number": "ORD-5001",
  "total_amount": 32.11,
  "payment_required": true
}
```

### Step 3: Process Payment

**Mobile/Web → API:**

```typescript
POST /api/v1/orders/5001/payment

{
  "payment_method": "credit_card",
  "payment_token": "tok_abc123def456",
  "save_card": true
}
```

**API → Authorize.Net:**

```typescript
const chargeResponse = await authorizeNet.chargeCustomerProfile({
  customerProfileId: 'prof_xyz789',
  paymentProfileId: 'pay_abc123',
  amount: 32.11,
  invoiceNumber: 'ORD-5001',
  description: 'Restaurant Order'
});

// Authorize.Net Response
{
  "transId": "40037769123",
  "responseCode": "1", // 1 = Approved, 2 = Declined, 3 = Error
  "authCode": "ABC123",
  "avsResultCode": "Y",
  "cvvResultCode": "M",
  "accountNumber": "XXXX1111",
  "accountType": "Visa"
}
```

### Step 4: Save Payment Record

```sql
INSERT INTO payments (
  order_id,
  payment_method,
  amount,
  payment_status,
  transaction_id,
  authorization_code,
  card_last_four,
  card_brand,
  payment_token,
  gateway,
  gateway_response,
  processed_at
) VALUES (
  5001,
  'credit_card',
  32.11,
  'completed',
  '40037769123',
  'ABC123',
  '1111',
  'Visa',
  'tok_abc123def456',
  'authorize_net',
  '{"responseCode": "1", "avsResultCode": "Y"}',
  GETUTCDATE()
);
```

### Step 5: Update Order Status

```sql
UPDATE orders
SET 
  payment_status = 'paid',
  order_status = 'confirmed',
  updated_at = GETUTCDATE()
WHERE order_id = 5001;
```

### Step 6: Post to POS

```typescript
// Write order to POS database
await posSync.postOrderToPOS(order);

// Trigger kitchen printing
await kitchenPrinter.printOrder(order);
```

### Step 7: Award Loyalty Points

```typescript
const pointsEarned = await loyaltyService.calculatePoints(order, customer);
await loyaltyService.awardPoints(customer.id, order.id, pointsEarned);
```

### Step 8: Send Confirmation

```typescript
// Push notification
await notificationService.send({
  userId: customer.id,
  title: 'Order Confirmed!',
  message: `Your order ${order.order_number} has been confirmed`,
  type: 'order_status'
});

// Email receipt (optional)
await emailService.sendReceipt(order);
```

---

## 🏪 Terminal Payment Flow (Clover)

### Step 1: Initialize Terminal Connection

```typescript
import { CloverConnector } from 'remote-pay-cloud';

const cloverConnector = new CloverConnector({
  merchantId: process.env.CLOVER_MERCHANT_ID,
  accessToken: process.env.CLOVER_ACCESS_TOKEN,
  environment: 'production'
});

await cloverConnector.initializeConnection();
```

### Step 2: Create Sale Request

```typescript
POST /api/v1/payments/terminal/charge

{
  "order_id": 5001,
  "amount": 32.11,
  "terminal_type": "clover"
}
```

**API → Clover Terminal:**

```typescript
const saleRequest = {
  amount: 3211, // Amount in cents
  externalId: 'ORD-5001',
  type: 'SALE'
};

cloverConnector.sale(saleRequest);
```

### Step 3: Customer Interacts with Terminal

1. Customer inserts/taps card
2. Terminal processes EMV transaction
3. Customer signs (if required)
4. Receipt prints (optional)

### Step 4: Receive Terminal Response

```typescript
cloverConnector.on('onSaleResponse', async (response) => {
  if (response.success) {
    // Save payment record
    await db.payments.create({
      order_id: 5001,
      payment_method: 'terminal',
      amount: 32.11,
      payment_status: 'completed',
      transaction_id: response.payment.id,
      authorization_code: response.payment.authCode,
      card_last_four: response.payment.cardTransaction.last4,
      card_brand: response.payment.cardTransaction.cardType,
      gateway: 'clover',
      gateway_response: JSON.stringify(response),
      processed_at: new Date()
    });
    
    // Update order
    await updateOrderPaymentStatus(5001, 'paid');
    
    // Post to POS
    await posSync.postPaymentToPOS(5001, response);
  } else {
    // Handle declined/error
    await handlePaymentFailure(5001, response.reason);
  }
});
```

---

## 🏪 Terminal Payment Flow (Ingenico)

### Initialize Ingenico SDK

```typescript
import { IngenicoSDK } from 'ingenico-sdk';

const ingenico = new IngenicoSDK({
  terminalId: process.env.INGENICO_TERMINAL_ID,
  apiKey: process.env.INGENICO_API_KEY,
  environment: 'production'
});
```

### Process Sale

```typescript
const saleRequest = {
  amount: 3211, // cents
  reference: 'ORD-5001',
  currency: 'USD'
};

const response = await ingenico.processSale(saleRequest);

if (response.approved) {
  // Save payment record
  await savePayment({
    order_id: 5001,
    transaction_id: response.transactionId,
    authorization_code: response.authCode,
    card_last_four: response.maskedPan.slice(-4),
    card_brand: response.cardScheme
  });
}
```

---

## 💸 Refund Flow

### Step 1: Initiate Refund (Admin Portal)

```typescript
POST /api/v1/payments/8001/refund

{
  "refund_amount": 32.11,
  "refund_reason": "Customer complaint"
}
```

### Step 2: Process Refund via Authorize.Net

```typescript
const refundResponse = await authorizeNet.refundTransaction({
  transactionId: '40037769123',
  amount: 32.11,
  cardNumber: '1111' // Last 4 digits
});

// Response
{
  "transId": "40037769456",
  "responseCode": "1",
  "messages": [{
    "code": "I00001",
    "text": "Successful."
  }]
}
```

### Step 3: Save Refund Record

```sql
INSERT INTO payment_refunds (
  payment_id,
  order_id,
  refund_amount,
  refund_reason,
  refund_status,
  transaction_id,
  processed_by_user_id,
  processed_at
) VALUES (
  8001,
  5001,
  32.11,
  'Customer complaint',
  'completed',
  '40037769456',
  102,
  GETUTCDATE()
);
```

### Step 4: Update Order & Payment Status

```sql
UPDATE orders
SET payment_status = 'refunded'
WHERE order_id = 5001;

UPDATE payments
SET payment_status = 'refunded'
WHERE payment_id = 8001;
```

### Step 5: Reverse Loyalty Points

```typescript
// Deduct points that were earned on this order
await loyaltyService.reverseLoyaltyPoints(order.customer_id, order.order_id);
```

### Step 6: Notify Customer

```typescript
await notificationService.send({
  userId: order.customer_id,
  title: 'Refund Processed',
  message: `Your refund of $${refundAmount} has been processed`,
  type: 'payment'
});
```

---

## 🔒 Security Best Practices

### 1. PCI DSS Compliance

- **Never store raw card numbers** - Use tokenization
- **Never log CVV codes**
- **Encrypt sensitive data** at rest and in transit
- **Use HTTPS only** for all payment endpoints

### 2. Card Data Handling

```typescript
// ❌ WRONG - Never do this
const cardNumber = request.body.card_number;
await db.save({ card_number: cardNumber }); // NEVER STORE

// ✅ CORRECT - Tokenize immediately
const tokenResponse = await authorizeNet.tokenize(cardData);
await db.save({ payment_token: tokenResponse.token }); // Store token only
```

### 3. Input Validation

```typescript
import { z } from 'zod';

const cardSchema = z.object({
  card_number: z.string().regex(/^\d{13,19}$/),
  expiry_month: z.string().regex(/^(0[1-9]|1[0-2])$/),
  expiry_year: z.string().regex(/^\d{4}$/),
  cvv: z.string().regex(/^\d{3,4}$/)
});

// Validate before processing
const validated = cardSchema.parse(request.body);
```

### 4. Transaction Logging

```typescript
// Log all payment attempts (success and failure)
await db.paymentLogs.create({
  order_id: 5001,
  payment_method: 'credit_card',
  amount: 32.11,
  status: 'completed',
  transaction_id: response.transId,
  ip_address: request.ip,
  user_agent: request.headers['user-agent'],
  timestamp: new Date()
});
```

### 5. Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 payment attempts
  message: 'Too many payment attempts, please try again later'
});

app.post('/api/v1/payments/charge', paymentLimiter, async (req, res) => {
  // Process payment
});
```

---

## 🔧 Service Implementation

### PaymentService Class

```typescript
class PaymentService {
  
  async processPayment(orderId: number, paymentData: PaymentData): Promise<Payment> {
    const order = await db.orders.findById(orderId);
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    if (order.payment_status === 'paid') {
      throw new Error('Order already paid');
    }
    
    let paymentResponse;
    
    // Route to appropriate payment processor
    switch (paymentData.payment_method) {
      case 'credit_card':
        paymentResponse = await this.processCardPayment(order, paymentData);
        break;
      case 'terminal':
        paymentResponse = await this.processTerminalPayment(order, paymentData);
        break;
      default:
        throw new Error('Invalid payment method');
    }
    
    // Save payment record
    const payment = await this.savePayment(order, paymentResponse);
    
    // Update order status
    await this.updateOrderPaymentStatus(orderId, 'paid');
    
    // Post to POS
    await this.syncPaymentToPOS(payment);
    
    // Award loyalty points
    await this.awardLoyaltyPoints(order);
    
    // Send confirmation
    await this.sendPaymentConfirmation(order, payment);
    
    return payment;
  }
  
  async processCardPayment(order: Order, paymentData: PaymentData): Promise<any> {
    const authorizeNet = new AuthorizeNetAPI();
    
    try {
      const response = await authorizeNet.chargeCustomerProfile({
        customerProfileId: paymentData.customer_profile_id,
        paymentProfileId: paymentData.payment_profile_id,
        amount: order.total_amount,
        invoiceNumber: order.order_number,
        description: `Order ${order.order_number}`
      });
      
      if (response.messages.resultCode === 'Ok') {
        return {
          success: true,
          transaction_id: response.transactionResponse.transId,
          authorization_code: response.transactionResponse.authCode,
          card_last_four: response.transactionResponse.accountNumber.slice(-4),
          card_brand: response.transactionResponse.accountType
        };
      } else {
        throw new Error(response.messages.message[0].text);
      }
      
    } catch (error) {
      await this.logPaymentError(order.order_id, error);
      throw error;
    }
  }
  
  async refundPayment(paymentId: number, refundAmount: number, reason: string, adminUserId: number): Promise<Refund> {
    const payment = await db.payments.findById(paymentId);
    
    if (!payment) {
      throw new Error('Payment not found');
    }
    
    if (payment.payment_status === 'refunded') {
      throw new Error('Payment already refunded');
    }
    
    const authorizeNet = new AuthorizeNetAPI();
    
    try {
      const refundResponse = await authorizeNet.refundTransaction({
        transactionId: payment.transaction_id,
        amount: refundAmount,
        cardNumber: payment.card_last_four
      });
      
      if (refundResponse.messages.resultCode === 'Ok') {
        // Save refund record
        const refund = await db.paymentRefunds.create({
          payment_id: paymentId,
          order_id: payment.order_id,
          refund_amount: refundAmount,
          refund_reason: reason,
          refund_status: 'completed',
          transaction_id: refundResponse.transactionResponse.transId,
          processed_by_user_id: adminUserId,
          processed_at: new Date()
        });
        
        // Update payment status
        await db.payments.update(
          { payment_status: 'refunded' },
          { where: { payment_id: paymentId } }
        );
        
        // Update order status
        await db.orders.update(
          { payment_status: 'refunded' },
          { where: { order_id: payment.order_id } }
        );
        
        // Reverse loyalty points
        await loyaltyService.reverseLoyaltyPoints(payment.order_id);
        
        return refund;
      } else {
        throw new Error(refundResponse.messages.message[0].text);
      }
      
    } catch (error) {
      await this.logRefundError(paymentId, error);
      throw error;
    }
  }
}
```

---

## 📊 Payment Analytics

### Key Metrics

1. **Total Revenue**
2. **Average Transaction Value**
3. **Payment Success Rate**
4. **Decline Rate**
5. **Refund Rate**
6. **Payment Method Distribution**

### SQL Queries

```sql
-- Total revenue (last 30 days)
SELECT SUM(amount) as total_revenue
FROM payments
WHERE payment_status = 'completed'
  AND processed_at >= DATEADD(day, -30, GETUTCDATE());

-- Payment success rate
SELECT 
  COUNT(CASE WHEN payment_status = 'completed' THEN 1 END) * 100.0 / COUNT(*) as success_rate
FROM payments
WHERE processed_at >= DATEADD(day, -30, GETUTCDATE());

-- Payment method distribution
SELECT 
  payment_method,
  COUNT(*) as transaction_count,
  SUM(amount) as total_amount
FROM payments
WHERE payment_status = 'completed'
  AND processed_at >= DATEADD(day, -30, GETUTCDATE())
GROUP BY payment_method;
```

---

## 🚨 Error Handling

### Common Error Codes

| Code | Description | Action |
|------|-------------|--------|
| E00001 | Invalid authentication | Check API credentials |
| E00003 | Invalid XML format | Verify request structure |
| E00027 | Transaction limit exceeded | Contact Authorize.Net |
| 2 | Declined | Notify customer to use different card |
| 3 | Error | Retry transaction |
| 4 | Held for Review | Manual review required |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_DECLINED",
    "message": "Your card was declined",
    "details": {
      "response_code": "2",
      "response_reason": "Insufficient funds"
    }
  }
}
```

---

**Document Version:** 1.0  
**Last Updated:** December 9, 2025  
**Author:** Domenico

