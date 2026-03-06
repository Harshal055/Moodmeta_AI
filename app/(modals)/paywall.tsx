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
import Purchases, {
  PACKAGE_TYPE,
  PurchasesPackage,
} from "react-native-purchases";
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

// Static UI configuration only - all pricing/trials come from RevenueCat
const PAYWALL_CONFIG = {
  heroTitle: "Unlock Premium Features",
  heroEmoji: "✨",
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
  ctaDefault: "Start Your Free Trial",
  ctaNoTrial: "Subscribe Now",
  refresh: "Refresh Plans",
  restore: "Restore Purchases",
  legalFooter:
    "Auto-renews unless canceled. Manage subscription in account settings.",
  trustFooter: "Secure payments via Apple/Google",
};

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const alert = useAlert();
  const user = useAuth((state) => state.currentUser);

  // Store all available packages dynamically
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPackageIndex, setSelectedPackageIndex] = useState(0);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  // Animation refs
  const slideUpAnim = useRef(new Animated.Value(100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

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
      const currentOffering = offerings.current;

      if (!currentOffering || currentOffering.availablePackages.length === 0) {
        logger.warn("No valid offering found or no packages available");
        setPurchaseError(
          "Plans are temporarily unavailable. Please try again in a moment.",
        );
        alert.show({
          type: "error",
          title: "Plans Unavailable",
          message:
            "Could not load subscription plans. Please check that an offering is set to CURRENT in RevenueCat with at least one product.",
          buttons: [{ text: "Dismiss", style: "default" }],
        });
        return;
      }

      // Get all packages and sort by duration (annual first for better defaults)
      const sortedPackages = [...currentOffering.availablePackages].sort(
        (a, b) => {
          // Prioritize default package types in this order:
          const typeOrder = {
            [PACKAGE_TYPE.ANNUAL]: 1,
            [PACKAGE_TYPE.SIX_MONTH]: 2,
            [PACKAGE_TYPE.THREE_MONTH]: 3,
            [PACKAGE_TYPE.TWO_MONTH]: 4,
            [PACKAGE_TYPE.MONTHLY]: 5,
            [PACKAGE_TYPE.WEEKLY]: 6,
            [PACKAGE_TYPE.LIFETIME]: 7,
            [PACKAGE_TYPE.CUSTOM]: 8,
            [PACKAGE_TYPE.UNKNOWN]: 9,
          };
          const orderA = typeOrder[a.packageType] ?? 99;
          const orderB = typeOrder[b.packageType] ?? 99;
          return orderA - orderB;
        },
      );

      setPackages(sortedPackages);

      // Auto-select the first package (typically annual if sorted)
      setSelectedPackageIndex(0);

      logger.debug(
        `Loaded ${sortedPackages.length} packages from RevenueCat:`,
        sortedPackages.map((p) => p.identifier),
      );
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

    if (packages.length === 0 || selectedPackageIndex >= packages.length) {
      alert.show({
        type: "warning",
        title: "Plan Unavailable",
        message: "No subscription plan selected. Please refresh plans.",
        buttons: [
          {
            text: "Refresh Plans",
            onPress: () => fetchOfferings(),
            style: "default",
          },
        ],
      });
      return;
    }

    setPurchaseError(null);
    setIsPurchasing(true);

    try {
      const pkgToBuy = packages[selectedPackageIndex];

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
          packages[selectedPackageIndex]?.identifier || "unknown",
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

  // Helper functions for dynamic package info
  const getPackageLabel = (pkg: PurchasesPackage): string => {
    // Use product title from store if available, otherwise fallback to identifier
    if (pkg.product.title && pkg.product.title !== pkg.product.identifier) {
      return pkg.product.title;
    }

    // Fallback to type-based labels
    switch (pkg.packageType) {
      case PACKAGE_TYPE.ANNUAL:
        return "Annual Plan";
      case PACKAGE_TYPE.SIX_MONTH:
        return "6-Month Plan";
      case PACKAGE_TYPE.THREE_MONTH:
        return "3-Month Plan";
      case PACKAGE_TYPE.TWO_MONTH:
        return "2-Month Plan";
      case PACKAGE_TYPE.MONTHLY:
        return "Monthly Plan";
      case PACKAGE_TYPE.WEEKLY:
        return "Weekly Plan";
      case PACKAGE_TYPE.LIFETIME:
        return "Lifetime Access";
      default:
        return pkg.identifier;
    }
  };

  const getPackageHelper = (pkg: PurchasesPackage): string => {
    // Use product description from store if available
    if (
      pkg.product.description &&
      pkg.product.description !== pkg.product.identifier
    ) {
      return pkg.product.description;
    }

    // Check for intro price/trial
    const intro = pkg.product.introPrice;
    if (intro) {
      const period = intro.periodUnit;
      const periodCount = Number(intro.cycles || intro.period || 1);

      if (intro.price === 0 || intro.priceString === "$0.00") {
        return `Free for ${periodCount} ${period}${periodCount > 1 ? "s" : ""}`;
      }
      return `${intro.priceString} for ${periodCount} ${period}${periodCount > 1 ? "s" : ""}`;
    }

    // Fallback to package type description
    switch (pkg.packageType) {
      case PACKAGE_TYPE.ANNUAL:
        return "Best value • Billed yearly";
      case PACKAGE_TYPE.MONTHLY:
        return "Flexible monthly billing";
      case PACKAGE_TYPE.WEEKLY:
        return "Billed weekly";
      case PACKAGE_TYPE.LIFETIME:
        return "One-time payment";
      default:
        return "Subscribe now";
    }
  };

  const getBestValueIndex = (): number => {
    if (packages.length === 0) return -1;
    if (packages.length === 1) return 0;

    // Find the package with the best monthly equivalent price
    let bestIndex = 0;
    let bestMonthlyPrice = Infinity;

    packages.forEach((pkg, index) => {
      const price = pkg.product.price;
      let monthlyEquiv = price;

      // Calculate monthly equivalent based on package type
      switch (pkg.packageType) {
        case PACKAGE_TYPE.ANNUAL:
          monthlyEquiv = price / 12;
          break;
        case PACKAGE_TYPE.SIX_MONTH:
          monthlyEquiv = price / 6;
          break;
        case PACKAGE_TYPE.THREE_MONTH:
          monthlyEquiv = price / 3;
          break;
        case PACKAGE_TYPE.TWO_MONTH:
          monthlyEquiv = price / 2;
          break;
        case PACKAGE_TYPE.WEEKLY:
          monthlyEquiv = price * 4.33; // Average weeks per month
          break;
        case PACKAGE_TYPE.LIFETIME:
          monthlyEquiv = price / 60; // Amortize over 5 years
          break;
      }

      if (monthlyEquiv < bestMonthlyPrice) {
        bestMonthlyPrice = monthlyEquiv;
        bestIndex = index;
      }
    });

    return bestIndex;
  };

  const calculateSavings = (
    packageIndex: number,
    comparisonIndex: number,
  ): number => {
    if (
      packageIndex >= packages.length ||
      comparisonIndex >= packages.length
    ) {
      return 0;
    }

    const pkg = packages[packageIndex];
    const comparison = packages[comparisonIndex];

    // Get monthly equivalent prices
    const getMonthlyPrice = (p: PurchasesPackage) => {
      const price = p.product.price;
      switch (p.packageType) {
        case PACKAGE_TYPE.ANNUAL:
          return price / 12;
        case PACKAGE_TYPE.SIX_MONTH:
          return price / 6;
        case PACKAGE_TYPE.THREE_MONTH:
          return price / 3;
        case PACKAGE_TYPE.TWO_MONTH:
          return price / 2;
        case PACKAGE_TYPE.WEEKLY:
          return price * 4.33;
        default:
          return price;
      }
    };

    const pkgMonthly = getMonthlyPrice(pkg);
    const comparisonMonthly = getMonthlyPrice(comparison);

    if (comparisonMonthly === 0) return 0;
    return Math.round(
      ((comparisonMonthly - pkgMonthly) / comparisonMonthly) * 100,
    );
  };

  // Determine CTA text based on trial availability
  const getCtaText = (): string => {
    if (packages.length === 0) return PAYWALL_CONFIG.ctaDefault;

    const selectedPkg = packages[selectedPackageIndex];
    if (!selectedPkg) return PAYWALL_CONFIG.ctaDefault;

    const intro = selectedPkg.product.introPrice;
    if (intro && (intro.price === 0 || intro.priceString === "$0.00")) {
      const period = intro.periodUnit || "day";
      const periodCount = Number(intro.cycles || intro.period || 1);
      return `Start ${periodCount}-${period} Free Trial`;
    }

    return PAYWALL_CONFIG.ctaNoTrial;
  };

  const bestValueIndex = getBestValueIndex();
  const monthlyPackageIndex = packages.findIndex(
    (p) => p.packageType === PACKAGE_TYPE.MONTHLY,
  );

  // Prices from the store. Show a dash if not yet loaded — never show a
  // hardcoded price in a specific currency because app store reviewers
  // and international users will see the wrong amount.

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

          {/* Dynamic Package Options */}
          {isLoadingOfferings ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" color="#000" />
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  color: "#666",
                  marginTop: 8,
                }}
              >
                Loading plans...
              </Text>
            </View>
          ) : packages.length === 0 ? (
            <View className="py-12 items-center">
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 14,
                  color: "#666",
                  textAlign: "center",
                }}
              >
                No plans available at the moment.
              </Text>
              <TouchableOpacity
                onPress={fetchOfferings}
                className="mt-4 px-6 py-2 bg-gray-100 rounded-full"
              >
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 13,
                    color: "#000",
                  }}
                >
                  {PAYWALL_CONFIG.refresh}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="gap-y-4 mb-8">
              {packages.map((pkg, index) => {
                const isSelected = selectedPackageIndex === index;
                const isBestValue = index === bestValueIndex;
                const savingsVsMonthly =
                  monthlyPackageIndex >= 0 && index !== monthlyPackageIndex
                    ? calculateSavings(index, monthlyPackageIndex)
                    : 0;

                return (
                  <View key={pkg.identifier} className="relative">
                    {/* Best Value Badge */}
                    {isBestValue && packages.length > 1 && (
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
                            BEST VALUE
                            {savingsVsMonthly > 0 &&
                              ` • Save ${savingsVsMonthly}%`}
                          </Text>
                        </View>
                      </Animated.View>
                    )}

                    {/* Package Card */}
                    <TouchableOpacity
                      onPress={() => setSelectedPackageIndex(index)}
                      className={`p-4 ${isBestValue ? "pt-5" : ""} rounded-xl border-2 bg-white ${
                        isSelected
                          ? "border-black shadow-lg"
                          : "border-gray-100"
                      }`}
                    >
                      <View className="flex-row justify-between items-center">
                        <View className="flex-1 pr-4">
                          <Text
                            style={{
                              fontFamily: "Inter_500Medium",
                              fontSize: 14,
                              color: "#000",
                            }}
                          >
                            {getPackageLabel(pkg)}
                          </Text>
                          <Text
                            style={{
                              fontFamily: "Inter_400Regular",
                              fontSize: 11,
                              color: "#888",
                              marginTop: 2,
                            }}
                          >
                            {getPackageHelper(pkg)}
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
                            {pkg.product.priceString}
                          </Text>
                          {isBestValue && (
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
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

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
            disabled={isPurchasing || isLoadingOfferings || packages.length === 0}
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
                {getCtaText()}
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
