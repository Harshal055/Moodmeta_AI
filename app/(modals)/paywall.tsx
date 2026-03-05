import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Purchases, { PurchasesPackage } from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAlert } from "../../components/CustomAlert";
import { useAuth } from "../../hooks/useAuth";
import { analyticsService } from "../../services/analyticsService";
import { revenueCatService } from "../../services/revenueCatService";
import { logger } from "../../utils/logger";
import {
  getMonthlyEquivalent,
  getUserFriendlyErrorMessage,
  retryWithBackoff,
} from "../../utils/purchaseUtils";

// TODO: Replace these with your actual hosted URLs before submitting to stores
const PRIVACY_POLICY_URL =
  "https://harshal055.github.io/moodmateai-site/privacy.html";
const TERMS_OF_SERVICE_URL =
  "https://harshal055.github.io/moodmateai-site/terms.html";

const PAYWALL_CONFIG = {
  defaultPlan: "yearly" as "monthly" | "yearly",
  heroTitle: "Start Your 2-Day Free Trial",
  heroEmoji: "❤️",
  heroSubtitle:
    "Unlimited chats, premium companions, and faster replies. Cancel anytime.",
  features: [
    "Unlimited AI chats",
    "All premium companions",
    "Priority response speed",
    "Full chat history",
    "Voice companion messages",
    "Advanced mood analytics",
    "Export chat history",
    "Zero ads",
    "AI memory & continuity",
    "Custom companion creation",
    "Offline chat mode",
    "Early access to new features",
  ],
  monthly: {
    label: "Pro Monthly",
    helper: "Flexible monthly plan",
  },
  yearly: {
    label: "Pro Annual",
    helper: "Billed yearly",
    badge: "BEST VALUE",
  },
  cta: "Start Free Trial",
  refresh: "Refresh Plans",
  restore: "Restore Purchases",
  legalFooter:
    "No charge today. Cancel anytime before trial ends. Auto-renews unless canceled.",
  trustFooter: "Secure payments via Apple/Google",
};

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const alert = useAlert();
  const user = useAuth((state) => state.currentUser);

  const [selectedPackage, setSelectedPackage] = useState<"monthly" | "yearly">(
    PAYWALL_CONFIG.defaultPlan,
  );
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  // Animation refs
  const slideUpAnim = useRef(new Animated.Value(100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // RevenueCat packages
  const [packages, setPackages] = useState<{
    monthly: PurchasesPackage | null;
    yearly: PurchasesPackage | null;
  }>({ monthly: null, yearly: null });

  useEffect(() => {
    fetchOfferings();
    trackPaywallView();

    // Animate in
    Animated.parallel([
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 8,
      }),
    ]).start();
  }, []);

  const trackPaywallView = async () => {
    if (user?.id) {
      await analyticsService.trackPaywallImpression(user.id);
    }
  };

  const fetchOfferings = async () => {
    setIsLoadingOfferings(true);
    setPurchaseError(null);
    try {
      const offerings = await Purchases.getOfferings();
      const targetOffering = offerings.current;

      if (targetOffering !== null && targetOffering !== undefined) {
        setPackages({
          monthly: targetOffering.monthly,
          yearly: targetOffering.annual,
        });
      } else {
        logger.warn(
          "No valid offering found (checked 'ofrng276d5a1129' and 'current')",
        );
        setPurchaseError(
          "Plans are temporarily unavailable. Please try again in a moment.",
        );
        alert.show({
          type: "error",
          title: "Plans Unavailable",
          message:
            "Could not load subscription plans. Please check that the offering is set to CURRENT in RevenueCat.",
          buttons: [{ text: "Dismiss", style: "default" }],
        });
      }
    } catch (e) {
      logger.error("Error fetching offerings:", e);
      setPurchaseError(
        "Could not load subscription plans. Check internet and try again.",
      );
    } finally {
      setIsLoadingOfferings(false);
    }
  };

  const handlePurchase = async () => {
    if (!user?.id) {
      alert.show({
        type: "error",
        title: "Not Logged In",
        message: "Please log in to purchase a subscription.",
        buttons: [{ text: "OK", style: "default" }],
      });
      return;
    }

    setPurchaseError(null);
    setIsPurchasing(true);

    try {
      const pkgToBuy =
        selectedPackage === "monthly" ? packages.monthly : packages.yearly;

      if (!pkgToBuy) {
        setPurchaseError(
          "Selected plan is unavailable. Please refresh and try again.",
        );
        alert.show({
          type: "warning",
          title: "Plan Unavailable",
          message: "The selected plan is not available. Please try refreshing.",
          buttons: [
            {
              text: "Refresh Plans",
              onPress: () => fetchOfferings(),
              style: "default",
            },
          ],
        });
        setIsPurchasing(false);
        return;
      }

      // Use retry logic for purchase
      const { customerInfo } = await retryWithBackoff(
        () => Purchases.purchasePackage(pkgToBuy),
        { maxAttempts: 3 },
      );

      const isPremium = revenueCatService.checkEntitlement(customerInfo);

      if (isPremium) {
        // Track successful purchase
        await analyticsService.trackPurchase({
          userId: user.id,
          productId: pkgToBuy.product.identifier,
          currency: pkgToBuy.product.currencyCode,
          amount: parseFloat(pkgToBuy.product.priceString || "0"),
          transactionId: customerInfo.originalPurchaseDate ?? undefined,
          revenueCatId: customerInfo.originalAppUserId,
        });

        // Update app state
        useAuth.setState({ isPremium: true });

        // Show success
        alert.show({
          type: "success",
          title: "Welcome to Pro!",
          message: "💫 All premium features unlocked. Enjoy!",
          duration: 1500,
        });

        // Redirect after animation
        setTimeout(() => {
          router.replace("/(modals)/upgrade-success");
        }, 1500);
        return;
      }

      // Premium not activated immediately (might need to restore)
      setPurchaseError(
        "Purchase completed but premium was not activated yet. Tap Restore Purchases.",
      );
      alert.show({
        type: "warning",
        title: "Activation Pending",
        message:
          "Purchase completed but premium wasn't activated. Please tap Restore Purchases.",
        buttons: [
          {
            text: "Restore Purchases",
            onPress: handleRestore,
            style: "default",
          },
          { text: "Dismiss", style: "default" },
        ],
      });
    } catch (e: any) {
      if (e?.userCancelled) {
        // User intentionally cancelled, don't log as error
        logger.debug("User cancelled purchase");
        await analyticsService.trackPaywallDismiss(user.id, "user_cancelled");
      } else {
        logger.error("Purchase error:", e);
        const friendlyMessage = getUserFriendlyErrorMessage(e, "purchase");

        // Track failure
        await analyticsService.trackPurchaseError(
          user.id,
          selectedPackage,
          e?.message || "Unknown error",
        );

        setPurchaseError(friendlyMessage);

        // Show appropriate alert based on error type
        const isNetwork = e?.message?.includes("network");
        const isBilling = e?.message?.includes("billing");

        alert.show({
          type: "error",
          title: isNetwork
            ? "Connection Error"
            : isBilling
              ? "Payment Failed"
              : "Purchase Error",
          message: friendlyMessage,
          buttons: [
            retryCount < 2
              ? {
                  text: "Retry",
                  onPress: () => {
                    setRetryCount(retryCount + 1);
                    handlePurchase();
                  },
                  style: "default",
                }
              : undefined,
            { text: "Dismiss", style: "default" },
          ].filter(Boolean) as any[],
        });
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsPurchasing(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      const isPremium = revenueCatService.checkEntitlement(customerInfo);

      if (isPremium) {
        useAuth.setState({ isPremium: true });
        alert.show({
          type: "success",
          title: "Purchases Restored",
          message: "Welcome back! Your Pro subscription has been restored.",
          buttons: [
            {
              text: "Continue",
              onPress: () => router.back(),
              style: "default",
            },
          ],
          duration: 2000,
        });
      } else {
        alert.show({
          type: "info",
          title: "No Subscription Found",
          message:
            "We couldn't find an active Pro subscription linked to this Apple/Google account.",
          buttons: [{ text: "OK", style: "default" }],
        });
      }
    } catch (e: any) {
      logger.error("Restore error:", e);
      const friendlyMessage = getUserFriendlyErrorMessage(e, "restore");

      alert.show({
        type: "error",
        title: "Restore Failed",
        message: friendlyMessage,
        buttons: [
          { text: "Retry", onPress: handleRestore, style: "default" },
          { text: "Dismiss", style: "cancel" },
        ],
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  // Prices from the store. Show a dash if not yet loaded — never show a
  // hardcoded price in a specific currency because app store reviewers
  // and international users will see the wrong amount.
  const monthlyPrice = packages.monthly?.product.priceString || "—";
  const yearlyPrice = packages.yearly?.product.priceString || "—";

  // Calculate value comparison
  const monthlyPriceNum = packages.monthly?.product.price || 9.99;
  const yearlyPriceNum = packages.yearly?.product.price || 69.99;
  const monthlyEquivalent = getMonthlyEquivalent(yearlyPriceNum);
  const savingsPercentage = Math.round(
    ((monthlyPriceNum * 12 - yearlyPriceNum) / (monthlyPriceNum * 12)) * 100,
  );

  return (
    <Animated.View
      style={{
        transform: [{ translateY: slideUpAnim }],
        opacity: fadeAnim,
        flex: 1,
      }}
    >
      <ScrollView
        className="flex-1 bg-white"
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{ paddingTop: Platform.OS === "ios" ? 20 : insets.top + 20 }}
          className="px-6 flex-1 mt-4"
        >
          {/* Title */}
          <Text
            style={{
              fontFamily: "Manrope_700Bold",
              fontSize: 32,
              lineHeight: 40,
              color: "#000",
            }}
          >
            {PAYWALL_CONFIG.heroTitle}
          </Text>
          <Text style={{ fontSize: 32, marginTop: 4, marginBottom: 8 }}>
            {PAYWALL_CONFIG.heroEmoji}
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              color: "#555",
              marginBottom: 24,
            }}
          >
            {PAYWALL_CONFIG.heroSubtitle}
          </Text>

          {/* Features */}
          <View className="gap-y-4 mb-8">
            {PAYWALL_CONFIG.features.map((feature, i) => (
              <View key={i} className="flex-row items-center gap-x-3">
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color="#000"
                />
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 13,
                    color: "#111",
                  }}
                >
                  {feature}
                </Text>
              </View>
            ))}
          </View>

          {/* Monthly Option */}
          <TouchableOpacity
            onPress={() => setSelectedPackage("monthly")}
            className={`p-4 rounded-xl border-2 mb-6 bg-white ${selectedPackage === "monthly" ? "border-black" : "border-gray-100"}`}
          >
            <View className="flex-row justify-between items-center">
              <View>
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 14,
                    color: "#000",
                  }}
                >
                  {PAYWALL_CONFIG.monthly.label}
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 11,
                    color: "#888",
                    marginTop: 2,
                  }}
                >
                  {PAYWALL_CONFIG.monthly.helper}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: "Manrope_700Bold",
                  fontSize: 18,
                  color: "#000",
                }}
              >
                {monthlyPrice}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Yearly Option */}
          <View className="mb-8">
            <Animated.View
              className="absolute z-10 -top-3 w-full items-center"
              style={{
                transform: [{ scale: scaleAnim }],
              }}
            >
              <View className="bg-[#E6F8EB] px-3 py-1 rounded-full border border-[#C6ECCC]">
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 10,
                    color: "#147039",
                  }}
                >
                  {PAYWALL_CONFIG.yearly.badge} • Save {savingsPercentage}%
                </Text>
              </View>
            </Animated.View>
            <TouchableOpacity
              onPress={() => setSelectedPackage("yearly")}
              className={`p-4 pt-5 rounded-xl border-2 bg-white transition-all ${selectedPackage === "yearly" ? "border-black shadow-lg" : "border-gray-100"}`}
            >
              <View className="flex-row justify-between items-center">
                <View className="flex-1">
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 14,
                      color: "#000",
                    }}
                  >
                    {PAYWALL_CONFIG.yearly.label}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 11,
                      color: "#888",
                      marginTop: 2,
                    }}
                  >
                    {yearlyPrice}/yr (${monthlyEquivalent.toFixed(2)}/mo)
                  </Text>
                </View>
                <View className="items-end">
                  <Text
                    style={{
                      fontFamily: "Manrope_700Bold",
                      fontSize: 18,
                      color: "#000",
                    }}
                  >
                    {yearlyPrice}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 10,
                      color: "#10B981",
                      marginTop: 2,
                    }}
                  >
                    Best Value ✓
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          <View className="flex-1" />

          {purchaseError && (
            <View className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-3 mb-3">
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 12,
                  color: "#B91C1C",
                }}
              >
                {purchaseError}
              </Text>
            </View>
          )}

          {/* CTA Button */}
          <TouchableOpacity
            onPress={handlePurchase}
            disabled={isPurchasing || isLoadingOfferings}
            className="w-full bg-black py-4 rounded-full items-center justify-center mt-6 mb-3"
          >
            {isPurchasing || isLoadingOfferings ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={{
                  fontFamily: "Manrope_700Bold",
                  fontSize: 15,
                  color: "#fff",
                }}
              >
                {PAYWALL_CONFIG.cta}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={fetchOfferings}
            disabled={isPurchasing}
            className="py-1"
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 12,
                color: "#666",
                textAlign: "center",
                textDecorationLine: "underline",
              }}
            >
              {PAYWALL_CONFIG.refresh}
            </Text>
          </TouchableOpacity>

          {/* Footer text */}
          <TouchableOpacity
            onPress={handleRestore}
            disabled={isPurchasing}
            className="py-2 mt-2"
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 13,
                color: "#888",
                textAlign: "center",
                textDecorationLine: "underline",
              }}
            >
              {PAYWALL_CONFIG.restore}
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 10,
              color: "#bbb",
              textAlign: "center",
              marginTop: 8,
            }}
          >
            {PAYWALL_CONFIG.legalFooter}
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 10,
              color: "#bbb",
              textAlign: "center",
              marginTop: 4,
            }}
          >
            {PAYWALL_CONFIG.trustFooter}
          </Text>

          {/* Apple & Google require visible legal links on paywall screens */}
          <View className="flex-row justify-center mt-4" style={{ gap: 16 }}>
            <TouchableOpacity
              onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
            >
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 11,
                  color: "#aaa",
                  textDecorationLine: "underline",
                }}
              >
                Privacy Policy
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}
            >
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 11,
                  color: "#aaa",
                  textDecorationLine: "underline",
                }}
              >
                Terms of Service
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  );
}
