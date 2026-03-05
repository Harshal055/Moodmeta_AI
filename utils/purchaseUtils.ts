/**
 * Purchase Utils
 *
 * Retry logic with exponential backoff, review prompt, and helpers
 */

import { logger } from "./logger";

/**
 * Retry configuration for purchase operations
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Execute function with exponential backoff retry logic
 *
 * @example
 * const result = await retryWithBackoff(
 *   () => Purchases.purchasePackage(pkg),
 *   { maxAttempts: 3 }
 * );
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;
  let delay = finalConfig.initialDelayMs;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      logger.info(`Attempt ${attempt}/${finalConfig.maxAttempts}`);
      return await fn();
    } catch (error: any) {
      lastError = error;
      logger.warn(
        `Attempt ${attempt} failed: ${error?.message || "Unknown error"}`,
      );

      // Don't retry user cancellations
      if (error?.userCancelled) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === finalConfig.maxAttempts) {
        break;
      }

      // Wait before retrying
      await sleep(delay);

      // Increase delay for next attempt (exponential backoff)
      delay = Math.min(delay * finalConfig.backoffMultiplier, finalConfig.maxDelayMs);
    }
  }

  throw lastError || new Error("Failed after all retry attempts");
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Request app store review post-purchase
 *
 * @note Platform-specific behavior:
 * - iOS: Open App Store app review page via URL
 * - Android: Open Play Store app review section via URL
 * - Web: No-op
 */
export async function requestReviewPostPurchase(
  delayMs: number = 1500,
): Promise<void> {
  try {
    // Wait for success animation to complete
    await sleep(delayMs);

    logger.info("Review prompt triggered");

    // Note: In-app review libraries like expo-store-review can be added later
    // For now, we just log that the review prompt was triggered
    // The native app stores will show ratings prompts automatically as needed

    // TODO: Integrate with expo-store-review or custom review dialog in future
  } catch (error) {
    logger.error("Error in review prompt:", error);
    // Non-critical, don't throw
  }
}

/**
 * Check if error is network-related and retriable
 */
export function isNetworkError(error: any): boolean {
  const message = error?.message?.toLowerCase() || "";
  const networkKeywords = [
    "network",
    "offline",
    "connection",
    "timeout",
    "econnrefused",
    "enotfound",
  ];
  return networkKeywords.some((keyword) => message.includes(keyword));
}

/**
 * Check if error is billing-related (user should verify payment method)
 */
export function isBillingError(error: any): boolean {
  const message = error?.message?.toLowerCase() || "";
  const billingKeywords = [
    "billing",
    "payment",
    "card",
    "declined",
    "invalid",
    "expired",
  ];
  return billingKeywords.some((keyword) => message.includes(keyword));
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(
  error: any,
  context: "purchase" | "restore" = "purchase",
): string {
  const message = error?.message?.toLowerCase() || "";

  if (error?.userCancelled) {
    return "Purchase cancelled.";
  }

  if (isNetworkError(error)) {
    return "Please check your internet connection and try again.";
  }

  if (isBillingError(error)) {
    return "Could not process your payment. Please check your payment method and try again.";
  }

  if (message.includes("entitlement")) {
    return "Could not activate your subscription. Please try again or contact support.";
  }

  if (message.includes("offering")) {
    return "Plans are temporarily unavailable. Please try again in a moment.";
  }

  if (context === "restore") {
    return "Could not restore your subscription. Please check your device credentials and try again.";
  }

  return "Something went wrong. Please try again or contact support.";
}

/**
 * Format price for display (e.g., "$9.99/month")
 */
export function formatPriceWithFrequency(
  price: string,
  frequency: "monthly" | "annual",
): string {
  if (frequency === "annual") {
    return `${price}/year`;
  }
  return `${price}/month`;
}

/**
 * Calculate monthly cost for annual subscription
 * Useful for showing value comparison
 */
export function getMonthlyEquivalent(annualPrice: number): number {
  return Math.round((annualPrice / 12) * 100) / 100;
}
