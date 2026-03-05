/**
 * Analytics Service
 *
 * Tracks critical user events: purchases, cancellations, etc.
 * Currently logs to console; ready to integrate with Supabase once analytics_events table is created
 */

import { logger } from "../utils/logger";

export interface PurchaseEvent {
  userId: string;
  productId: string; // "mood-buddy-pro-monthly" | "mood-buddy-pro-annual"
  currency?: string;
  amount?: number;
  transactionId?: string;
  revenueCatId?: string;
}

export interface CancellationEvent {
  userId: string;
  subscriptionId: string;
  reason?: string;
  daysActive?: number;
}

export interface MonetizationMetrics {
  totalPurchases: number;
  totalRevenue: number;
  monthlyPayingUsers: number;
  annualPayingUsers: number;
  cancellationRate: number;
  lifetime: number; // avg days subscribed
}

export const analyticsService = {
  /**
   * Track successful purchase
   */
  async trackPurchase(event: PurchaseEvent): Promise<void> {
    try {
      const isAnnual = event.productId.includes("annual");

      logger.info(
        `Purchase tracked: ${event.productId} for user ${event.userId}`,
      );

      // TODO: Uncomment once analytics_events table is created in Supabase
      // const { error } = await supabase.from("analytics_events").insert({
      //   user_id: event.userId,
      //   event_type: "purchase_completed",
      //   product_id: event.productId,
      //   is_annual: isAnnual,
      //   currency: event.currency || "USD",
      //   amount: event.amount || 0,
      //   revenue_cat_id: event.revenueCatId,
      //   created_at: new Date().toISOString(),
      // });
    } catch (e) {
      logger.error("Analytics track purchase error:", e);
    }
  },

  /**
   * Track purchase failure
   */
  async trackPurchaseError(
    userId: string,
    productId: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      logger.warn(`Purchase error tracked: ${productId} - ${errorMessage}`);

      // TODO: Uncomment once analytics_events table is created
      // await supabase.from("analytics_events").insert({
      //   user_id: userId,
      //   event_type: "purchase_failed",
      //   product_id: productId,
      //   error_message: errorMessage,
      //   created_at: new Date().toISOString(),
      // });
    } catch (e) {
      logger.error("Error tracking purchase error:", e);
    }
  },

  /**
   * Track subscription cancellation
   */
  async trackCancellation(event: CancellationEvent): Promise<void> {
    try {
      logger.info(
        `Cancellation tracked: user ${event.userId} after ${event.daysActive} days`,
      );

      // TODO: Uncomment once analytics_events table is created
      // await supabase.from("analytics_events").insert({
      //   user_id: event.userId,
      //   event_type: "subscription_cancelled",
      //   subscription_id: event.subscriptionId,
      //   cancellation_reason: event.reason,
      //   days_active: event.daysActive,
      //   created_at: new Date().toISOString(),
      // });
    } catch (e) {
      logger.error("Error tracking cancellation:", e);
    }
  },

  /**
   * Track paywall impression
   */
  async trackPaywallImpression(userId: string): Promise<void> {
    try {
      logger.debug("Paywall impression tracked");

      // TODO: Uncomment once analytics_events table is created
      // await supabase.from("analytics_events").insert({
      //   user_id: userId,
      //   event_type: "paywall_shown",
      //   created_at: new Date().toISOString(),
      // });
    } catch (e) {
      logger.error("Error tracking paywall impression:", e);
    }
  },

  /**
   * Track paywall dismissal
   */
  async trackPaywallDismiss(userId: string, reason?: string): Promise<void> {
    try {
      logger.debug("Paywall dismissal tracked");

      // TODO: Uncomment once analytics_events table is created
      // await supabase.from("analytics_events").insert({
      //   user_id: userId,
      //   event_type: "paywall_dismissed",
      //   reason: reason || "user_action",
      //   created_at: new Date().toISOString(),
      // });
    } catch (e) {
      logger.error("Error tracking paywall dismissal:", e);
    }
  },

  /**
   * Get monetization metrics (for admin dashboard)
   * TODO: Implement once analytics_events table exists
   */
  async getMetrics(): Promise<MonetizationMetrics | null> {
    logger.debug(
      "Metrics requested - implement once analytics_events table is created",
    );
    return null;
  },
};
