import { getPool, withTransaction, sql } from '../config/database';
import { logger } from '../config/logger';

export interface LoyaltyRule {
  loyalty_rule_id: number;
  rule_name: string;
  rule_type: 'earn_percentage' | 'earn_fixed' | 'redeem_discount' | 'redeem_item';
  location_id: number | null;
  points_per_dollar?: number;
  fixed_points?: number;
  min_purchase_amount: number;
  redemption_value?: number;
  is_active: boolean;
}

export interface LoyaltyBalance {
  customer_id: number;
  total_points: number;
  lifetime_points_earned: number;
  lifetime_points_redeemed: number;
  tier_level: string;
}

export interface LoyaltyTransaction {
  loyalty_transaction_id: number;
  customer_id: number;
  order_id: number | null;
  transaction_type: 'earn' | 'redeem' | 'adjustment' | 'expire';
  points_amount: number;
  balance_after: number;
  description: string;
  created_at: Date;
}

export class LoyaltyService {
  
  /**
   * Calculate points for an order based on active rules
   */
  async calculatePoints(customerId: number, orderSubtotal: number, locationId: number): Promise<number> {
    try {
      const pool = getPool();
      
      // Get active earning rules
      const rulesResult = await pool.request()
        .input('location_id', sql.Int, locationId)
        .query(`
          SELECT *
          FROM loyalty_rules
          WHERE is_active = 1
            AND rule_type IN ('earn_percentage', 'earn_fixed')
            AND (location_id IS NULL OR location_id = @location_id)
            AND (start_date IS NULL OR start_date <= GETUTCDATE())
            AND (end_date IS NULL OR end_date >= GETUTCDATE())
          ORDER BY display_order
        `);
      
      const rules = rulesResult.recordset as LoyaltyRule[];
      
      let basePoints = 0;
      
      // Calculate points based on all applicable rules
      for (const rule of rules) {
        if (orderSubtotal >= rule.min_purchase_amount) {
          if (rule.rule_type === 'earn_percentage' && rule.points_per_dollar) {
            basePoints += Math.floor(orderSubtotal * rule.points_per_dollar);
          } else if (rule.rule_type === 'earn_fixed' && rule.fixed_points) {
            basePoints += rule.fixed_points;
          }
        }
      }
      
      // Get customer's tier and apply multiplier
      const balance = await this.getBalance(customerId);
      const tierMultiplier = this.getTierMultiplier(balance.tier_level);
      
      const finalPoints = Math.floor(basePoints * tierMultiplier);
      
      logger.info(`Calculated ${finalPoints} loyalty points for customer ${customerId} (order: $${orderSubtotal})`);
      
      return finalPoints;
      
    } catch (error) {
      logger.error('Error calculating loyalty points:', error);
      throw error;
    }
  }
  
  /**
   * Award points to a customer
   */
  async awardPoints(customerId: number, orderId: number, points: number, description?: string): Promise<void> {
    try {
      await withTransaction(async (transaction) => {
        // Get current balance
        const balanceResult = await transaction.request()
          .input('customer_id', sql.Int, customerId)
          .query(`
            SELECT total_points, lifetime_points_earned
            FROM customer_loyalty_balances
            WHERE customer_id = @customer_id
          `);
        
        let currentBalance = 0;
        let lifetimeEarned = 0;
        
        if (balanceResult.recordset.length > 0) {
          currentBalance = balanceResult.recordset[0].total_points;
          lifetimeEarned = balanceResult.recordset[0].lifetime_points_earned;
        }
        
        const newBalance = currentBalance + points;
        const newLifetimeEarned = lifetimeEarned + points;
        
        // Create transaction record
        await transaction.request()
          .input('customer_id', sql.Int, customerId)
          .input('order_id', sql.Int, orderId)
          .input('transaction_type', sql.NVarChar, 'earn')
          .input('points_amount', sql.Int, points)
          .input('balance_after', sql.Int, newBalance)
          .input('description', sql.NVarChar, description || `Order #${orderId}`)
          .query(`
            INSERT INTO loyalty_transactions (
              customer_id, order_id, transaction_type, points_amount, balance_after, description, created_at
            ) VALUES (
              @customer_id, @order_id, @transaction_type, @points_amount, @balance_after, @description, GETUTCDATE()
            )
          `);
        
        // Update or insert balance
        await transaction.request()
          .input('customer_id', sql.Int, customerId)
          .input('new_balance', sql.Int, newBalance)
          .input('new_lifetime_earned', sql.Int, newLifetimeEarned)
          .query(`
            MERGE INTO customer_loyalty_balances AS target
            USING (SELECT @customer_id AS customer_id) AS source
            ON target.customer_id = source.customer_id
            WHEN MATCHED THEN
              UPDATE SET 
                total_points = @new_balance,
                lifetime_points_earned = @new_lifetime_earned,
                updated_at = GETUTCDATE()
            WHEN NOT MATCHED THEN
              INSERT (customer_id, total_points, lifetime_points_earned, lifetime_points_redeemed, tier_level)
              VALUES (@customer_id, @new_balance, @new_lifetime_earned, 0, 'bronze');
          `);
        
        // Check and update tier
        await this.checkTierUpgrade(customerId, transaction);
        
        logger.info(`Awarded ${points} points to customer ${customerId}. New balance: ${newBalance}`);
      });
      
    } catch (error) {
      logger.error('Error awarding loyalty points:', error);
      throw error;
    }
  }
  
  /**
   * Redeem loyalty points for discount
   */
  async redeemPoints(customerId: number, pointsToRedeem: number, orderId: number): Promise<number> {
    try {
      // Get current balance
      const balance = await this.getBalance(customerId);
      
      if (balance.total_points < pointsToRedeem) {
        throw new Error(`Insufficient loyalty points. Available: ${balance.total_points}, Requested: ${pointsToRedeem}`);
      }
      
      // Get redemption rate
      const redemptionRule = await this.getActiveRedemptionRule();
      
      if (!redemptionRule || !redemptionRule.redemption_value) {
        throw new Error('No active redemption rule found');
      }
      
      const discountAmount = pointsToRedeem * redemptionRule.redemption_value;
      
      await withTransaction(async (transaction) => {
        const newBalance = balance.total_points - pointsToRedeem;
        const newLifetimeRedeemed = balance.lifetime_points_redeemed + pointsToRedeem;
        
        // Create redemption transaction
        await transaction.request()
          .input('customer_id', sql.Int, customerId)
          .input('order_id', sql.Int, orderId)
          .input('transaction_type', sql.NVarChar, 'redeem')
          .input('points_amount', sql.Int, -pointsToRedeem)
          .input('balance_after', sql.Int, newBalance)
          .input('description', sql.NVarChar, `Redeemed on Order #${orderId}`)
          .query(`
            INSERT INTO loyalty_transactions (
              customer_id, order_id, transaction_type, points_amount, balance_after, description, created_at
            ) VALUES (
              @customer_id, @order_id, @transaction_type, @points_amount, @balance_after, @description, GETUTCDATE()
            )
          `);
        
        // Update balance
        await transaction.request()
          .input('customer_id', sql.Int, customerId)
          .input('new_balance', sql.Int, newBalance)
          .input('new_lifetime_redeemed', sql.Int, newLifetimeRedeemed)
          .query(`
            UPDATE customer_loyalty_balances
            SET 
              total_points = @new_balance,
              lifetime_points_redeemed = @new_lifetime_redeemed,
              updated_at = GETUTCDATE()
            WHERE customer_id = @customer_id
          `);
        
        logger.info(`Redeemed ${pointsToRedeem} points for customer ${customerId}. Discount: $${discountAmount}`);
      });
      
      return discountAmount;
      
    } catch (error) {
      logger.error('Error redeeming loyalty points:', error);
      throw error;
    }
  }
  
  /**
   * Get customer's loyalty balance
   */
  async getBalance(customerId: number): Promise<LoyaltyBalance> {
    try {
      const pool = getPool();
      
      const result = await pool.request()
        .input('customer_id', sql.Int, customerId)
        .query(`
          SELECT 
            customer_id,
            total_points,
            lifetime_points_earned,
            lifetime_points_redeemed,
            tier_level
          FROM customer_loyalty_balances
          WHERE customer_id = @customer_id
        `);
      
      if (result.recordset.length === 0) {
        // No balance yet - return default
        return {
          customer_id: customerId,
          total_points: 0,
          lifetime_points_earned: 0,
          lifetime_points_redeemed: 0,
          tier_level: 'bronze'
        };
      }
      
      return result.recordset[0] as LoyaltyBalance;
      
    } catch (error) {
      logger.error('Error fetching loyalty balance:', error);
      throw error;
    }
  }
  
  /**
   * Get transaction history for a customer
   */
  async getTransactions(customerId: number, limit: number = 50, offset: number = 0): Promise<LoyaltyTransaction[]> {
    try {
      const pool = getPool();
      
      const result = await pool.request()
        .input('customer_id', sql.Int, customerId)
        .input('limit', sql.Int, limit)
        .input('offset', sql.Int, offset)
        .query(`
          SELECT 
            loyalty_transaction_id,
            customer_id,
            order_id,
            transaction_type,
            points_amount,
            balance_after,
            description,
            created_at
          FROM loyalty_transactions
          WHERE customer_id = @customer_id
          ORDER BY created_at DESC
          OFFSET @offset ROWS
          FETCH NEXT @limit ROWS ONLY
        `);
      
      return result.recordset as LoyaltyTransaction[];
      
    } catch (error) {
      logger.error('Error fetching loyalty transactions:', error);
      throw error;
    }
  }
  
  /**
   * Reverse loyalty points (for refunds)
   */
  async reverseLoyaltyPoints(customerId: number, orderId: number): Promise<void> {
    try {
      await withTransaction(async (transaction) => {
        // Find the original earn transaction
        const earnResult = await transaction.request()
          .input('customer_id', sql.Int, customerId)
          .input('order_id', sql.Int, orderId)
          .query(`
            SELECT points_amount
            FROM loyalty_transactions
            WHERE customer_id = @customer_id
              AND order_id = @order_id
              AND transaction_type = 'earn'
          `);
        
        if (earnResult.recordset.length === 0) {
          logger.warn(`No loyalty transaction found for order ${orderId}`);
          return;
        }
        
        const pointsToReverse = earnResult.recordset[0].points_amount;
        
        // Get current balance
        const balance = await this.getBalance(customerId);
        const newBalance = Math.max(0, balance.total_points - pointsToReverse);
        
        // Create reversal transaction
        await transaction.request()
          .input('customer_id', sql.Int, customerId)
          .input('order_id', sql.Int, orderId)
          .input('transaction_type', sql.NVarChar, 'adjustment')
          .input('points_amount', sql.Int, -pointsToReverse)
          .input('balance_after', sql.Int, newBalance)
          .input('description', sql.NVarChar, `Reversal for refunded Order #${orderId}`)
          .query(`
            INSERT INTO loyalty_transactions (
              customer_id, order_id, transaction_type, points_amount, balance_after, description, created_at
            ) VALUES (
              @customer_id, @order_id, @transaction_type, @points_amount, @balance_after, @description, GETUTCDATE()
            )
          `);
        
        // Update balance
        await transaction.request()
          .input('customer_id', sql.Int, customerId)
          .input('new_balance', sql.Int, newBalance)
          .query(`
            UPDATE customer_loyalty_balances
            SET total_points = @new_balance, updated_at = GETUTCDATE()
            WHERE customer_id = @customer_id
          `);
        
        logger.info(`Reversed ${pointsToReverse} points for customer ${customerId} due to refund`);
      });
      
    } catch (error) {
      logger.error('Error reversing loyalty points:', error);
      throw error;
    }
  }
  
  /**
   * Check and apply tier upgrades
   */
  private async checkTierUpgrade(customerId: number, transaction: sql.Transaction): Promise<void> {
    const balanceResult = await transaction.request()
      .input('customer_id', sql.Int, customerId)
      .query(`
        SELECT lifetime_points_earned, tier_level
        FROM customer_loyalty_balances
        WHERE customer_id = @customer_id
      `);
    
    if (balanceResult.recordset.length === 0) {
      return;
    }
    
    const lifetimePoints = balanceResult.recordset[0].lifetime_points_earned;
    const currentTier = balanceResult.recordset[0].tier_level;
    
    let newTier = 'bronze';
    if (lifetimePoints >= 5000) newTier = 'platinum';
    else if (lifetimePoints >= 3000) newTier = 'gold';
    else if (lifetimePoints >= 1000) newTier = 'silver';
    
    if (newTier !== currentTier) {
      await transaction.request()
        .input('customer_id', sql.Int, customerId)
        .input('tier_level', sql.NVarChar, newTier)
        .query(`
          UPDATE customer_loyalty_balances
          SET tier_level = @tier_level, updated_at = GETUTCDATE()
          WHERE customer_id = @customer_id
        `);
      
      logger.info(`Customer ${customerId} upgraded from ${currentTier} to ${newTier}`);
    }
  }
  
  /**
   * Get tier multiplier
   */
  private getTierMultiplier(tierLevel: string): number {
    const multipliers: Record<string, number> = {
      'bronze': 1.0,
      'silver': 1.25,
      'gold': 1.5,
      'platinum': 2.0
    };
    
    return multipliers[tierLevel] || 1.0;
  }
  
  /**
   * Get active redemption rule
   */
  private async getActiveRedemptionRule(): Promise<LoyaltyRule | null> {
    try {
      const pool = getPool();
      
      const result = await pool.request()
        .query(`
          SELECT TOP 1 *
          FROM loyalty_rules
          WHERE is_active = 1
            AND rule_type = 'redeem_discount'
            AND (start_date IS NULL OR start_date <= GETUTCDATE())
            AND (end_date IS NULL OR end_date >= GETUTCDATE())
          ORDER BY loyalty_rule_id DESC
        `);
      
      return result.recordset.length > 0 ? result.recordset[0] as LoyaltyRule : null;
      
    } catch (error) {
      logger.error('Error fetching redemption rule:', error);
      return null;
    }
  }
}

// Export singleton instance
export const loyaltyService = new LoyaltyService();

