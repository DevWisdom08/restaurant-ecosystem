# Loyalty System - Technical Documentation

## Overview

Complete loyalty points system with earn/redeem logic, tier management, and multi-location support.

---

## 🎯 Loyalty Rules Engine

### Rule Types

1. **earn_percentage** - Earn points based on percentage of purchase
2. **earn_fixed** - Earn fixed points per order
3. **redeem_discount** - Redeem points for dollar discount
4. **redeem_item** - Redeem points for free items

---

## 💰 Points Earning Logic

### Standard Earning Formula

```typescript
// Example: $1 spent = 1 point
const pointsEarned = Math.floor(orderTotal * pointsPerDollar);

// With minimum purchase requirement
if (orderTotal >= minPurchaseAmount) {
  pointsEarned = Math.floor(orderTotal * pointsPerDollar);
} else {
  pointsEarned = 0;
}
```

### Example Configuration

```json
{
  "rule_name": "Standard Earning",
  "rule_type": "earn_percentage",
  "points_per_dollar": 1.0,
  "min_purchase_amount": 0.00,
  "is_active": true
}
```

**Example:**
- Order Total: $32.11
- Points Per Dollar: 1.0
- Points Earned: 32 points

---

## 🎁 Points Redemption Logic

### Redemption Formula

```typescript
// Example: 100 points = $5 discount
const discountAmount = (pointsToRedeem * redemptionValue);

// Validate customer has enough points
if (customerBalance >= pointsToRedeem) {
  applyDiscount(discountAmount);
  deductPoints(pointsToRedeem);
}
```

### Example Configuration

```json
{
  "rule_name": "Redemption Rate",
  "rule_type": "redeem_discount",
  "redemption_value": 0.05,
  "is_active": true
}
```

**Example:**
- Points to Redeem: 100
- Redemption Value: $0.05 per point
- Discount Applied: $5.00

---

## 🏆 Tier System

### Tier Levels

| Tier | Lifetime Points Required | Benefits |
|------|-------------------------|----------|
| Bronze | 0 - 999 | 1x points |
| Silver | 1,000 - 2,999 | 1.25x points |
| Gold | 3,000 - 4,999 | 1.5x points |
| Platinum | 5,000+ | 2x points |

### Tier Multiplier Logic

```typescript
function calculatePointsWithTier(basePoints: number, tierLevel: string): number {
  const multipliers = {
    'bronze': 1.0,
    'silver': 1.25,
    'gold': 1.5,
    'platinum': 2.0
  };
  
  return Math.floor(basePoints * multipliers[tierLevel]);
}
```

**Example:**
- Order Total: $50.00
- Base Points: 50
- Tier: Gold (1.5x)
- Actual Points Earned: 75

---

## 🔄 Transaction Flow

### Earning Points Flow

```
1. Order Placed
   ↓
2. Payment Confirmed
   ↓
3. Calculate Points Based on Rules
   ↓
4. Apply Tier Multiplier
   ↓
5. Create loyalty_transaction (type: 'earn')
   ↓
6. Update customer_loyalty_balances
   ↓
7. Send Push Notification
   ↓
8. Sync to POS (if applicable)
```

### Redeeming Points Flow

```
1. Customer Selects Points to Redeem
   ↓
2. Validate Sufficient Balance
   ↓
3. Calculate Discount Amount
   ↓
4. Apply to Order Total
   ↓
5. Create loyalty_transaction (type: 'redeem')
   ↓
6. Update customer_loyalty_balances
   ↓
7. Process Payment (reduced total)
   ↓
8. Sync to POS
```

---

## 📊 Database Operations

### Earn Points

```sql
-- Insert earn transaction
INSERT INTO loyalty_transactions (
  customer_id,
  order_id,
  transaction_type,
  points_amount,
  balance_after,
  description,
  created_at
) VALUES (
  @customer_id,
  @order_id,
  'earn',
  @points_earned,
  @new_balance,
  'Order ' + @order_number,
  GETUTCDATE()
);

-- Update customer balance
UPDATE customer_loyalty_balances
SET 
  total_points = total_points + @points_earned,
  lifetime_points_earned = lifetime_points_earned + @points_earned,
  updated_at = GETUTCDATE()
WHERE customer_id = @customer_id;

-- Check and update tier
UPDATE customer_loyalty_balances
SET tier_level = CASE
  WHEN lifetime_points_earned >= 5000 THEN 'platinum'
  WHEN lifetime_points_earned >= 3000 THEN 'gold'
  WHEN lifetime_points_earned >= 1000 THEN 'silver'
  ELSE 'bronze'
END
WHERE customer_id = @customer_id;
```

### Redeem Points

```sql
-- Verify balance
SELECT total_points 
FROM customer_loyalty_balances 
WHERE customer_id = @customer_id;

-- Insert redeem transaction
INSERT INTO loyalty_transactions (
  customer_id,
  order_id,
  transaction_type,
  points_amount,
  balance_after,
  description,
  created_at
) VALUES (
  @customer_id,
  @order_id,
  'redeem',
  -@points_redeemed,
  @new_balance,
  'Discount on Order ' + @order_number,
  GETUTCDATE()
);

-- Update customer balance
UPDATE customer_loyalty_balances
SET 
  total_points = total_points - @points_redeemed,
  lifetime_points_redeemed = lifetime_points_redeemed + @points_redeemed,
  updated_at = GETUTCDATE()
WHERE customer_id = @customer_id;
```

---

## 🔧 Service Implementation

### LoyaltyService Class

```typescript
class LoyaltyService {
  
  // Calculate points for an order
  async calculatePoints(order: Order, customer: Customer): Promise<number> {
    // Get active earning rules
    const rules = await this.getActiveEarningRules(order.location_id);
    
    let basePoints = 0;
    
    for (const rule of rules) {
      if (rule.rule_type === 'earn_percentage') {
        if (order.subtotal >= rule.min_purchase_amount) {
          basePoints += Math.floor(order.subtotal * rule.points_per_dollar);
        }
      } else if (rule.rule_type === 'earn_fixed') {
        if (order.subtotal >= rule.min_purchase_amount) {
          basePoints += rule.fixed_points;
        }
      }
    }
    
    // Apply tier multiplier
    const tierMultiplier = this.getTierMultiplier(customer.tier_level);
    const finalPoints = Math.floor(basePoints * tierMultiplier);
    
    return finalPoints;
  }
  
  // Award points to customer
  async awardPoints(customerId: number, orderId: number, points: number): Promise<void> {
    // Start transaction
    const transaction = await db.transaction();
    
    try {
      // Get current balance
      const balance = await this.getBalance(customerId);
      const newBalance = balance.total_points + points;
      
      // Create transaction record
      await db.loyaltyTransactions.create({
        customer_id: customerId,
        order_id: orderId,
        transaction_type: 'earn',
        points_amount: points,
        balance_after: newBalance,
        description: `Order ${orderId}`
      });
      
      // Update balance
      await db.customerLoyaltyBalances.update({
        total_points: newBalance,
        lifetime_points_earned: balance.lifetime_points_earned + points
      }, {
        where: { customer_id: customerId }
      });
      
      // Check tier upgrade
      await this.checkTierUpgrade(customerId);
      
      // Commit transaction
      await transaction.commit();
      
      // Send notification
      await this.notifyPointsEarned(customerId, points, newBalance);
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  // Redeem points
  async redeemPoints(customerId: number, pointsToRedeem: number, orderId: number): Promise<number> {
    // Get current balance
    const balance = await this.getBalance(customerId);
    
    // Validate sufficient points
    if (balance.total_points < pointsToRedeem) {
      throw new Error('Insufficient loyalty points');
    }
    
    // Get redemption rate
    const redemptionRule = await this.getActiveRedemptionRule();
    const discountAmount = pointsToRedeem * redemptionRule.redemption_value;
    
    // Start transaction
    const transaction = await db.transaction();
    
    try {
      const newBalance = balance.total_points - pointsToRedeem;
      
      // Create transaction record
      await db.loyaltyTransactions.create({
        customer_id: customerId,
        order_id: orderId,
        transaction_type: 'redeem',
        points_amount: -pointsToRedeem,
        balance_after: newBalance,
        description: `Redeemed on Order ${orderId}`
      });
      
      // Update balance
      await db.customerLoyaltyBalances.update({
        total_points: newBalance,
        lifetime_points_redeemed: balance.lifetime_points_redeemed + pointsToRedeem
      }, {
        where: { customer_id: customerId }
      });
      
      await transaction.commit();
      
      return discountAmount;
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  // Check and apply tier upgrades
  async checkTierUpgrade(customerId: number): Promise<void> {
    const balance = await this.getBalance(customerId);
    
    let newTier = 'bronze';
    if (balance.lifetime_points_earned >= 5000) newTier = 'platinum';
    else if (balance.lifetime_points_earned >= 3000) newTier = 'gold';
    else if (balance.lifetime_points_earned >= 1000) newTier = 'silver';
    
    if (newTier !== balance.tier_level) {
      await db.customerLoyaltyBalances.update({
        tier_level: newTier
      }, {
        where: { customer_id: customerId }
      });
      
      // Notify customer of tier upgrade
      await this.notifyTierUpgrade(customerId, newTier);
    }
  }
}
```

---

## 🔗 POS Sync Strategy

### Sync Points to POS

When points are earned or redeemed in the mobile app/website, they must sync to POS:

```typescript
async syncLoyaltyToPOS(customerId: number): Promise<void> {
  const balance = await this.getBalance(customerId);
  
  // Write to POS loyalty table
  await db.raw(`
    MERGE INTO pos_customer_loyalty AS target
    USING (SELECT @customer_id AS customer_id, @total_points AS points) AS source
    ON target.customer_id = source.customer_id
    WHEN MATCHED THEN
      UPDATE SET points = source.points, updated_at = GETUTCDATE()
    WHEN NOT MATCHED THEN
      INSERT (customer_id, points, created_at)
      VALUES (source.customer_id, source.points, GETUTCDATE());
  `, {
    customer_id: customerId,
    total_points: balance.total_points
  });
}
```

### Sync Points from POS

When points are earned in POS (dine-in orders), sync back to app:

```typescript
// Polling service (runs every 60 seconds)
async pollPOSLoyalty(): Promise<void> {
  // Get recent POS loyalty transactions
  const posTransactions = await db.raw(`
    SELECT customer_id, points_change, transaction_date
    FROM pos_loyalty_log
    WHERE synced_to_app = 0
      AND transaction_date >= DATEADD(minute, -5, GETUTCDATE())
  `);
  
  for (const transaction of posTransactions) {
    // Apply to app loyalty system
    await this.syncFromPOS(transaction);
  }
}
```

---

## 📱 Mobile App Integration

### Display Balance

```typescript
// API: GET /loyalty/balance
{
  "total_points": 1250,
  "lifetime_points_earned": 3480,
  "tier_level": "gold",
  "dollar_value": 62.50,
  "points_to_next_tier": 520
}
```

### Display in Cart/Checkout

```typescript
// Show available points as discount option
if (loyaltyBalance >= 100) {
  showRedeemOption({
    points: 100,
    discount: "$5.00",
    newTotal: originalTotal - 5.00
  });
}
```

### Transaction History

```typescript
// API: GET /loyalty/transactions
{
  "transactions": [
    {
      "date": "2025-12-09",
      "type": "earn",
      "points": 32,
      "description": "Order ORD-5001",
      "balance_after": 1250
    },
    {
      "date": "2025-12-08",
      "type": "redeem",
      "points": -100,
      "description": "Discount applied",
      "balance_after": 1218
    }
  ]
}
```

---

## 🎨 Admin Portal Features

### Loyalty Configuration

```typescript
// Configure earning rules
{
  "rule_name": "Weekend Bonus",
  "rule_type": "earn_percentage",
  "points_per_dollar": 2.0,
  "min_purchase_amount": 20.00,
  "start_date": "2025-12-13T00:00:00Z",
  "end_date": "2025-12-15T23:59:59Z",
  "is_active": true
}
```

### Customer Loyalty Dashboard

- Total customers by tier
- Total points issued
- Total points redeemed
- Redemption rate
- Top loyalty customers
- Points expiring soon

### Manual Adjustments

```typescript
// Admin can manually adjust points
async adjustPoints(customerId: number, pointsChange: number, reason: string): Promise<void> {
  const balance = await this.getBalance(customerId);
  const newBalance = balance.total_points + pointsChange;
  
  await db.loyaltyTransactions.create({
    customer_id: customerId,
    transaction_type: 'adjustment',
    points_amount: pointsChange,
    balance_after: newBalance,
    description: `Admin adjustment: ${reason}`
  });
  
  await db.customerLoyaltyBalances.update({
    total_points: newBalance
  }, {
    where: { customer_id: customerId }
  });
}
```

---

## 📈 Analytics & Reporting

### Key Metrics

1. **Total Active Loyalty Members**
2. **Points Earned This Month**
3. **Points Redeemed This Month**
4. **Redemption Rate** = (Points Redeemed / Points Earned) × 100
5. **Average Points per Customer**
6. **Tier Distribution**
7. **Customer Retention Rate**

### SQL Queries

```sql
-- Total active loyalty members
SELECT COUNT(DISTINCT customer_id) 
FROM customer_loyalty_balances 
WHERE total_points > 0;

-- Points earned this month
SELECT SUM(points_amount) 
FROM loyalty_transactions 
WHERE transaction_type = 'earn'
  AND created_at >= DATEADD(month, -1, GETUTCDATE());

-- Tier distribution
SELECT 
  tier_level,
  COUNT(*) as customer_count,
  AVG(total_points) as avg_points
FROM customer_loyalty_balances
GROUP BY tier_level;
```

---

## 🔒 Security Considerations

1. **Points Validation**: Always validate customer has sufficient points before redemption
2. **Transaction Atomicity**: Use database transactions to prevent race conditions
3. **Balance Recalculation**: Periodic job to verify balance matches transaction history
4. **Fraud Detection**: Flag suspicious redemption patterns
5. **Expiration Policy**: Optional points expiration after 12 months

---

## 🚀 Future Enhancements

1. **Referral Bonuses**: Earn points for referring friends
2. **Birthday Rewards**: Bonus points on customer's birthday
3. **Multiplier Events**: 2x points during specific hours/days
4. **Tier-Specific Perks**: Free delivery for Platinum members
5. **Gamification**: Badges, challenges, and achievements
6. **Points Gifting**: Transfer points to other customers
7. **Charity Donations**: Donate points to charity

---

**Document Version:** 1.0  
**Last Updated:** December 9, 2025  
**Author:** Domenico

