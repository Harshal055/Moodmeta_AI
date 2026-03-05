import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Purchases, { PurchasesPackage } from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { revenueCatService } from "../../services/revenueCatService";

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

  const [selectedPackage, setSelectedPackage] = useState<"monthly" | "yearly">(
    PAYWALL_CONFIG.defaultPlan,
  );
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(true);

  // RevenueCat packages
  const [packages, setPackages] = useState<{
    monthly: PurchasesPackage | null;
    yearly: PurchasesPackage | null;
  }>({ monthly: null, yearly: null });

  useEffect(() => {
    fetchOfferings();
  }, []);

  const fetchOfferings = async () => {
    setIsLoadingOfferings(true);
    try {
      const offerings = await Purchases.getOfferings();

      // Always use the "current" offering configured in RevenueCat dashboard.
      // Hardcoding an offering ID (e.g. "ofrng276d5a1129") breaks when you
      // rename or recreate offerings in the dashboard.
      const targetOffering = offerings.current;

      if (targetOffering !== null && targetOffering !== undefined) {
        setPackages({
          monthly: targetOffering.monthly,
          yearly: targetOffering.annual,
        });
        setPurchaseError(null);
      } else {
        console.log(
          "No valid offering found (checked 'ofrng276d5a1129' and 'current')",
        );
        setPurchaseError(
          "Plans are temporarily unavailable. Please try again in a moment.",
        );
      }
    } catch (e) {
      console.error("Error fetching offerings", e);
      setPurchaseError(
        "Could not load subscription plans. Check internet and try again.",
      );
    } finally {
      setIsLoadingOfferings(false);
    }
  };

  const handlePurchase = async () => {
    setPurchaseError(null);
    setIsPurchasing(true);
    try {
      const pkgToBuy =
        selectedPackage === "monthly" ? packages.monthly : packages.yearly;

      if (pkgToBuy) {
        const { customerInfo } = await Purchases.purchasePackage(pkgToBuy);
        const isPremium = revenueCatService.checkEntitlement(customerInfo);
        if (isPremium) {
          useAuth.setState({ isPremium: true });
          router.replace("/(modals)/upgrade-success");
          return;
        }
        setPurchaseError(
          "Purchase completed but premium was not activated yet. Tap Restore Purchases.",
        );
        Alert.alert(
          "Activation Pending",
          "Purchase completed but premium was not activated yet. Please tap Restore Purchases.",
        );
      } else {
        setPurchaseError(
          "Selected plan is unavailable. Please refresh and try again.",
        );
        Alert.alert(
          "Plan Unavailable",
          "Selected plan is unavailable right now. Please try again.",
        );
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        console.error("Purchase error", e);
        const message =
          e.message ||
          "An unknown error occurred while trying to process your purchase. Please try again.";
        setPurchaseError(message);
        Alert.alert("Purchase Failed", message);
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
        Alert.alert(
          "Purchases Restored",
          "Welcome back! Your Pro subscription has been restored.",
          [{ text: "Continue", onPress: () => router.back() }],
        );
      } else {
        Alert.alert(
          "No Subscription Found",
          "We couldn't find an active Pro subscription linked to this Apple/Google account.",
        );
      }
    } catch (e: any) {
      console.error("Restore error", e);
      Alert.alert(
        "Restore Failed",
        e.message ||
          "An error occurred while trying to restore your purchases.",
      );
    } finally {
      setIsPurchasing(false);
    }
  };

  // Prices from the store. Show a dash if not yet loaded — never show a
  // hardcoded price in a specific currency because app store reviewers
  // and international users will see the wrong amount.
  const monthlyPrice = packages.monthly?.product.priceString || "—";
  const yearlyPrice = packages.yearly?.product.priceString || "—";

  return (
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
          <View className="absolute z-10 -top-3 w-full items-center">
            <View className="bg-[#E6F8EB] px-3 py-1 rounded-full border border-[#C6ECCC]">
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 10,
                  color: "#147039",
                }}
              >
                {PAYWALL_CONFIG.yearly.badge}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setSelectedPackage("yearly")}
            className={`p-4 pt-5 rounded-xl border-2 bg-white ${selectedPackage === "yearly" ? "border-black" : "border-gray-100"}`}
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
                  Billed as {yearlyPrice}/yr
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: "Manrope_700Bold",
                  fontSize: 18,
                  color: "#000",
                }}
              >
                {yearlyPrice}
              </Text>
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
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
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
  );
}
