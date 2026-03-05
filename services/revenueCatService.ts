import { Platform } from "react-native";
import Purchases, { CustomerInfo, LOG_LEVEL, Offering, PurchasesPackage } from "react-native-purchases";
import { logger } from "../utils/logger";

const iosApiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const androidApiKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
const ENTITLEMENT_ID = "MoodMate Pro";

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return `${key.slice(0, 6)}***${key.slice(-4)}`;
}

function isTestKey(key: string): boolean {
  return key.startsWith("test_");
}

export const revenueCatService = {
  /**
   * Initialize the RevenueCat SDK
   */
  async initialize() {
    try {
      // Use ERROR level in production to avoid leaking purchase tokens
      // and receipt data into device logs. VERBOSE is only for dev debugging.
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.ERROR);

      if (Platform.OS === "android") {
        if (!androidApiKey) {
          logger.error("Missing EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY");
          return;
        }

        if (!__DEV__ && isTestKey(androidApiKey)) {
          logger.error(
            `Blocked test RevenueCat key in non-dev Android build: ${maskKey(androidApiKey)}`,
          );
          return;
        }

        await Purchases.configure({ apiKey: androidApiKey });
        logger.info(
          `RevenueCat initialized for Android (${maskKey(androidApiKey)})`,
        );
      } else if (Platform.OS === "ios") {
        if (!iosApiKey) {
          logger.error("Missing EXPO_PUBLIC_REVENUECAT_IOS_API_KEY");
          return;
        }

        if (!__DEV__ && isTestKey(iosApiKey)) {
          logger.error(
            `Blocked test RevenueCat key in non-dev iOS build: ${maskKey(iosApiKey)}`,
          );
          return;
        }

        await Purchases.configure({ apiKey: iosApiKey });
        logger.info(`RevenueCat initialized for iOS (${maskKey(iosApiKey)})`);
      }

      // Set up listener for customer info updates
      this.setupCustomerInfoListener();
    } catch (e) {
      logger.error("Error initializing RevenueCat:", e);
    }
  },

  /**
   * Set up listener for CUSTOMER_INFO_UPDATED events
   * This allows the app to react to entitlement changes in real-time
   */
  setupCustomerInfoListener() {
    try {
      Purchases.addCustomerInfoUpdateListener((customerInfo) => {
        const hasPro = this.checkEntitlement(customerInfo);
        logger.info("✅ Customer info updated:", {
          hasPro,
          entitlementId: ENTITLEMENT_ID,
          updatedAt: new Date().toISOString(),
        });
        // The consuming component (e.g., useAuth hook) can listen for this
        // by calling getCustomerInfo() or by using their own listener
      });
    } catch (e) {
      logger.error("Error setting up customer info listener:", e);
    }
  },

  /**
   * Get current offering with monthly and annual packages
   */
  async getOfferings(): Promise<{
    offering: Offering | null;
    monthly: PurchasesPackage | null;
    annual: PurchasesPackage | null;
  }> {
    try {
      const offerings = await Purchases.getOfferings();
      
      if (!offerings.current) {
        logger.warn("No current offering found in RevenueCat");
        return { offering: null, monthly: null, annual: null };
      }

      const offering = offerings.current;
      const monthly = offering.monthly;
      const annual = offering.annual;

      logger.info("Retrieved offerings:", {
        offeringId: offering.identifier,
        monthlyPrice: monthly?.product.priceString,
        annualPrice: annual?.product.priceString,
      });

      return { offering, monthly, annual };
    } catch (e) {
      logger.error("Error getting offerings:", e);
      return { offering: null, monthly: null, annual: null };
    }
  },

  /**
   * Log in user (Call this when anonymous ID is generated or user logs in)
   */
  async login(userId: string) {
    try {
      const { customerInfo } = await Purchases.logIn(userId);
      logger.info(`Logged in to RevenueCat: ${userId}`);
      return customerInfo;
    } catch (e) {
      logger.error("Error logging in to RevenueCat:", e);
      return null;
    }
  },

  /**
   * Log out user
   */
  async logout() {
    try {
      await Purchases.logOut();
      logger.info("Logged out of RevenueCat");
    } catch (e) {
      logger.error("Error logging out from RevenueCat:", e);
    }
  },

  /**
   * Check if user has active entitlement
   */
  checkEntitlement(customerInfo: CustomerInfo | null): boolean {
    if (!customerInfo) {
      logger.warn("No customer info available for entitlement check");
      return false;
    }
    
    const hasEntitlement = typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== "undefined";
    
    if (hasEntitlement) {
      const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
      logger.info("✅ Pro entitlement active:", {
        expiresAt: entitlement?.expirationDate,
        isActive: entitlement?.isActive,
      });
    }
    
    return hasEntitlement;
  },

  /**
   * Refresh Customer Info from RevenueCat servers
   */
  async getCustomerInfo(): Promise<CustomerInfo | null> {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const isPro = this.checkEntitlement(customerInfo);
      logger.info("Retrieved customer info:", { isPro });
      return customerInfo;
    } catch (e) {
      logger.error("Error getting customer info:", e);
      return null;
    }
  },

  /**
   * Get subscription details (expiration date, etc.)
   */
  async getSubscriptionDetails(customerInfo: CustomerInfo | null) {
    if (!customerInfo) return null;
    
    try {
      const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
      
      if (!entitlement) {
        return null;
      }

      return {
        isActive: entitlement.isActive,
        expirationDate: entitlement.expirationDate ? new Date(entitlement.expirationDate) : null,
        productIdentifier: entitlement.productIdentifier,
        originalPurchaseDate: entitlement.originalPurchaseDate ? new Date(entitlement.originalPurchaseDate) : null,
        latestPurchaseDate: entitlement.latestPurchaseDate ? new Date(entitlement.latestPurchaseDate) : null,
      };
    } catch (e) {
      logger.error("Error getting subscription details:", e);
      return null;
    }
  },
};
