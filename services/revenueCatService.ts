import { Platform } from "react-native";
import Purchases, { CustomerInfo, LOG_LEVEL } from "react-native-purchases";
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
      Purchases.setLogLevel(LOG_LEVEL.ERROR);

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
        console.log("✅ Customer info updated:", {
          hasPro: this.checkEntitlement(customerInfo),
          updatedAt: new Date().toISOString(),
        });
        // The consuming component (e.g., useAuth hook) can listen for this
        // by calling getCustomerInfo() or by using their own listener
      });
    } catch (e) {
      console.error("❌ Error setting up customer info listener:", e);
    }
  },

  /**
   * Log in user (Call this when anonymous ID is generated or user logs in)
   */
  async login(userId: string) {
    try {
      const { customerInfo } = await Purchases.logIn(userId);
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
    } catch (e) {
      logger.error("Error logging out from RevenueCat:", e);
    }
  },

  /**
   * Check if user has active entitlement
   */
  checkEntitlement(customerInfo: CustomerInfo | null): boolean {
    if (!customerInfo) return false;
    return (
      typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== "undefined"
    );
  },

  /**
   * Refresh Customer Info from RevenueCat servers
   */
  async getCustomerInfo(): Promise<CustomerInfo | null> {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo;
    } catch (e) {
      logger.error("Error getting customer info:", e);
      return null;
    }
  },
};
