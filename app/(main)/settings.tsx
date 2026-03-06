import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Purchases from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { isFeatureEnabled } from "../../utils/featureFlags";
import { logger } from "../../utils/logger";
import { getMoodAnalytics } from "../../utils/moodAnalytics";
import {
  getRecommendedResources
} from "../../utils/wellnessResources";

// TODO: Replace these with your actual hosted URLs before submitting to stores
const PRIVACY_POLICY_URL =
  "https://harshal055.github.io/moodmateai-site/privacy.html";
const TERMS_OF_SERVICE_URL =
  "https://harshal055.github.io/moodmateai-site/terms.html";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.currentUser);
  const profile = useAuth((s) => s.profile);
  const isPremium = useAuth((s) => s.isPremium);
  const signOut = useAuth((s) => s.signOut);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const [moodAnalytics, setMoodAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [wellnessResources, setWellnessResources] = useState<any[]>([]);

  const handleRestorePurchases = async () => {
    setIsRestoringPurchases(true);
    try {
      const purchases = await Purchases.restorePurchases();
      const hasPurchases =
        Object.values(purchases.activeSubscriptions || {}).length > 0 ||
        Object.values(purchases.nonSubscriptionTransactionsByProductId || {})
          .length > 0;

      if (hasPurchases) {
        Alert.alert("Success", "Your purchases have been restored! 🎉");
      } else {
        Alert.alert("No Purchases", "No previous purchases found to restore.");
      }
    } catch (error) {
      logger.error("Error restoring purchases:", error);
      Alert.alert("Error", "Could not restore purchases. Please try again.");
    } finally {
      setIsRestoringPurchases(false);
    }
  };

  const handleClearChatHistory = () => {
    Alert.alert(
      "Clear Chat History",
      "This will delete all your chats with " +
      (profile?.companion_name || "your companion") +
      ". Your companion will remember you, but the conversation history will be gone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear History",
          style: "destructive",
          onPress: async () => {
            if (!user) return;
            setIsClearingChat(true);
            try {
              // Delete all chats but keep the profile
              await supabase.from("chats").delete().eq("user_id", user.id);
              Alert.alert("Success", "Chat history cleared! 🧹");
            } catch (e: any) {
              logger.error("Error clearing chat history", e);
              Alert.alert("Error", "Could not clear chat history. Try again.");
            } finally {
              setIsClearingChat(false);
            }
          },
        },
      ],
    );
  };

  const handleWipeData = () => {
    Alert.alert(
      "Wipe Memory & Start Over",
      "This will permanently delete your companion, all chat history, and forget who you are. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Everything",
          style: "destructive",
          onPress: async () => {
            if (!user) return;
            setIsDeleting(true);
            try {
              // 1. Delete all chats
              await supabase.from("chats").delete().eq("user_id", user.id);

              // 2. Delete profile
              await supabase.from("profiles").delete().eq("user_id", user.id);

              // 3. Clear local state and session
              await signOut();

              // 4. Force route back to welcome
              router.replace("/(auth)/welcome");
            } catch (e: any) {
              logger.error("Error wiping data", e);
              Alert.alert(
                "Error",
                "Could not delete your data. Please try again.",
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  // Load mood analytics and wellness resources for Pro users
  const loadProFeatures = async () => {
    if (!user?.id || !isPremium) return;

    try {
      setLoadingAnalytics(true);

      // Load mood analytics if enabled
      if (isFeatureEnabled("moodAnalytics", isPremium)) {
        const analytics = await getMoodAnalytics(user.id);
        setMoodAnalytics(analytics);
      }

      // Load wellness resources if enabled
      if (isFeatureEnabled("wellnessResources", isPremium)) {
        // Get recommended resources based on mood
        const recommended = getRecommendedResources("stressed");
        setWellnessResources(recommended || []);
      }
    } catch (error) {
      logger.error("Error loading Pro features:", error);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Load Pro features when component mounts or user changes
  useEffect(() => {
    loadProFeatures();
  }, [user?.id, isPremium]);

  return (
    <View className="flex-1 bg-[#F8FBFF]">
      <View
        style={{
          paddingTop: insets.top + 20,
          paddingHorizontal: 20,
          paddingBottom: 20,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
        </TouchableOpacity>
        <Text
          style={{
            fontFamily: "Manrope_700Bold",
            fontSize: 24,
            color: "#1a1a2e",
          }}
        >
          Settings
        </Text>
      </View>

      <ScrollView className="flex-1 px-5 pt-4">
        {/* Companion Summary Card */}
        {profile && (
          <View
            className="bg-gradient-to-br from-[#FF6B9D] to-[#C44569] rounded-3xl p-6 mb-8 overflow-hidden"
            style={{
              shadowColor: "#FF6B9D",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 5,
            }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center gap-3 flex-1">
                <View className="w-16 h-16 rounded-full bg-white items-center justify-center">
                  <Text style={{ fontSize: 40 }}>❤️</Text>
                </View>
                <View className="flex-1">
                  <Text
                    style={{
                      fontFamily: "Manrope_700Bold",
                      fontSize: 18,
                      color: "white",
                    }}
                  >
                    {profile.companion_name || "Your Companion"}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 13,
                      color: "rgba(255,255,255,0.8)",
                      marginTop: 2,
                    }}
                  >
                    {profile.role || "Friend"} • {profile.language || "English"}
                  </Text>
                  {isPremium && (
                    <View className="flex-row items-center gap-1 mt-2">
                      <Ionicons name="star" size={14} color="white" />
                      <Text
                        style={{
                          fontFamily: "Inter_500Medium",
                          fontSize: 12,
                          color: "white",
                        }}
                      >
                        Premium
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            <TouchableOpacity
              className="bg-white rounded-xl py-3 px-4 flex-row items-center justify-center gap-2"
              onPress={() => router.push("/(auth)/welcome")}
            >
              <Ionicons name="create-outline" size={16} color="#FF6B9D" />
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 13,
                  color: "#FF6B9D",
                }}
              >
                Change Companion
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Premium Section */}
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 13,
            color: "#999",
            marginBottom: 12,
            marginLeft: 12,
          }}
        >
          SUBSCRIPTION
        </Text>

        {/* Pro Status Card (when subscribed) */}
        {isPremium ? (
          <View className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden mb-8">
            <View
              style={{
                backgroundColor: "#F0FDF4",
                padding: 20,
                borderBottomWidth: 1,
                borderBottomColor: "#E5F5E0",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: "#10B981",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={28} color="#fff" />
                  </View>
                  <View>
                    <Text
                      style={{
                        fontFamily: "Manrope_700Bold",
                        fontSize: 18,
                        color: "#065F46",
                      }}
                    >
                      MoodMate Pro
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 12,
                        color: "#10B981",
                        marginTop: 2,
                      }}
                    >
                      ✨ All premium features unlocked
                    </Text>
                  </View>
                </View>
                <View
                  style={{
                    backgroundColor: "#10B981",
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 11,
                      color: "#fff",
                      letterSpacing: 0.5,
                    }}
                  >
                    ACTIVE
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#F5F5F5",
              }}
              onPress={() => Linking.openURL("https://play.google.com/store/account/subscriptions")}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View className="w-10 h-10 rounded-full bg-[#F0F8FF] items-center justify-center">
                  <Ionicons name="settings-outline" size={20} color="#0066CC" />
                </View>
                <View>
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 15,
                      color: "#1a1a2e",
                    }}
                  >
                    Manage Subscription
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 12,
                      color: "#888",
                      marginTop: 2,
                    }}
                  >
                    Cancel, change plan, or billing info
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center justify-between p-4"
              onPress={handleRestorePurchases}
              disabled={isRestoringPurchases}
            >
              <View className="flex-row items-center gap-3 flex-1">
                <View className="w-10 h-10 rounded-full bg-[#F0E8FF] items-center justify-center">
                  {isRestoringPurchases ? (
                    <ActivityIndicator size="small" color="#7C3AED" />
                  ) : (
                    <Ionicons name="download-outline" size={20} color="#7C3AED" />
                  )}
                </View>
                <View>
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 15,
                      color: "#1a1a2e",
                    }}
                  >
                    Restore Purchases
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 12,
                      color: "#888",
                      marginTop: 2,
                    }}
                  >
                    Re-sync premium on new device
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden mb-8">
            {/* Upgrade CTA */}
            <TouchableOpacity
              style={{
                padding: 20,
              }}
              onPress={() => router.push("/(modals)/paywall")}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: "#FFF8E1",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 24 }}>👑</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: "Manrope_700Bold",
                      fontSize: 18,
                      color: "#1a1a2e",
                    }}
                  >
                    Go Premium
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 12,
                      color: "#888",
                      marginTop: 2,
                    }}
                  >
                    Starting at ₹83/mo with annual plan
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </View>

              {/* Quick Feature Highlights */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {["Unlimited AI Chats", "Zero Ads", "Voice Messages", "Mood Analytics"].map((feat) => (
                  <View
                    key={feat}
                    style={{
                      backgroundColor: "#F8F9FA",
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 20,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 11,
                        color: "#666",
                      }}
                    >
                      ✓ {feat}
                    </Text>
                  </View>
                ))}
              </View>

              {/* CTA Button */}
              <View
                style={{
                  backgroundColor: "#1a1a2e",
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Manrope_700Bold",
                    fontSize: 15,
                    color: "#fff",
                  }}
                >
                  Upgrade Now — Save 58%
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center justify-between p-4 border-t border-[#F5F5F5]"
              onPress={handleRestorePurchases}
              disabled={isRestoringPurchases}
            >
              <View className="flex-row items-center gap-3 flex-1">
                <View className="w-10 h-10 rounded-full bg-[#F0E8FF] items-center justify-center">
                  {isRestoringPurchases ? (
                    <ActivityIndicator size="small" color="#7C3AED" />
                  ) : (
                    <Ionicons name="download-outline" size={20} color="#7C3AED" />
                  )}
                </View>
                <View>
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 15,
                      color: "#1a1a2e",
                    }}
                  >
                    Restore Purchases
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 12,
                      color: "#888",
                      marginTop: 2,
                    }}
                  >
                    Re-sync premium on new device
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center justify-between p-4 border-t border-[#F5F5F5]"
              onPress={() => router.push("/(modals)/link-account")}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-[#F0F8FF] items-center justify-center">
                  <Ionicons name="link" size={20} color="#0066CC" />
                </View>
                <View>
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 15,
                      color: "#1a1a2e",
                    }}
                  >
                    Link Account
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 12,
                      color: "#888",
                      marginTop: 2,
                    }}
                  >
                    Save across devices
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
          </View>
        )}

        {/* Mood Analytics Section (Pro feature) */}
        {isPremium && isFeatureEnabled("moodAnalytics", isPremium) && (
          <>
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 13,
                color: "#999",
                marginBottom: 12,
                marginLeft: 12,
              }}
            >
              MOOD ANALYTICS
            </Text>

            <View className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden mb-8 p-4">
              {loadingAnalytics ? (
                <View className="items-center justify-center py-8">
                  <ActivityIndicator size="large" color="#FF6B9D" />
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 12,
                      color: "#888",
                      marginTop: 8,
                    }}
                  >
                    Loading your mood insights...
                  </Text>
                </View>
              ) : moodAnalytics ? (
                <View>
                  <View className="mb-4">
                    <Text
                      style={{
                        fontFamily: "Manrope_600SemiBold",
                        fontSize: 14,
                        color: "#1a1a2e",
                        marginBottom: 8,
                      }}
                    >
                      📊 30-Day Mood Trend
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 12,
                        color: "#666",
                      }}
                    >
                      {moodAnalytics.improvementTrajectory || "No data yet"}
                    </Text>
                  </View>

                  <View className="mb-4">
                    <Text
                      style={{
                        fontFamily: "Manrope_600SemiBold",
                        fontSize: 14,
                        color: "#1a1a2e",
                        marginBottom: 8,
                      }}
                    >
                      😊 Most Common Mood
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Inter_500Medium",
                        fontSize: 13,
                        color: "#FF6B9D",
                      }}
                    >
                      {moodAnalytics.mostCommonMood || "Neutral"}
                    </Text>
                  </View>

                  <TouchableOpacity className="bg-[#FFF8E1] rounded-lg p-3 items-center">
                    <Text
                      style={{
                        fontFamily: "Inter_500Medium",
                        fontSize: 12,
                        color: "#F59E0B",
                      }}
                    >
                      View Detailed Insights
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                    color: "#888",
                    textAlign: "center",
                    paddingVertical: 16,
                  }}
                >
                  Start logging moods to see insights 💭
                </Text>
              )}
            </View>
          </>
        )}

        {/* Wellness Resources Section (Pro feature) */}
        {isPremium && isFeatureEnabled("wellnessResources", isPremium) && (
          <>
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 13,
                color: "#999",
                marginBottom: 12,
                marginLeft: 12,
              }}
            >
              WELLNESS HUB
            </Text>

            <View className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden mb-8">
              {wellnessResources.length > 0 ? (
                wellnessResources.slice(0, 3).map((resource, idx) => (
                  <TouchableOpacity
                    key={idx}
                    className={`flex-row items-center justify-between p-4 ${idx < wellnessResources.slice(0, 3).length - 1
                        ? "border-b border-[#F5F5F5]"
                        : ""
                      }`}
                  >
                    <View className="flex-row items-center gap-3 flex-1">
                      <View className="w-10 h-10 rounded-full bg-[#F0E8FF] items-center justify-center">
                        <Text style={{ fontSize: 18 }}>
                          {resource.emoji || "💚"}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text
                          style={{
                            fontFamily: "Inter_500Medium",
                            fontSize: 14,
                            color: "#1a1a2e",
                          }}
                        >
                          {resource.title}
                        </Text>
                        <Text
                          style={{
                            fontFamily: "Inter_400Regular",
                            fontSize: 11,
                            color: "#888",
                            marginTop: 2,
                          }}
                          numberOfLines={1}
                        >
                          {resource.description}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#ccc" />
                  </TouchableOpacity>
                ))
              ) : (
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                    color: "#888",
                    textAlign: "center",
                    paddingVertical: 16,
                  }}
                >
                  Loading wellness resources... 🧘
                </Text>
              )}
            </View>
          </>
        )}

        {/* Pro Features Summary (for free users) */}
        {!isPremium && (
          <>
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 13,
                color: "#999",
                marginBottom: 12,
                marginLeft: 12,
              }}
            >
              PRO FEATURES
            </Text>

            <View className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden mb-8 p-4">
              <Text
                style={{
                  fontFamily: "Manrope_600SemiBold",
                  fontSize: 14,
                  color: "#1a1a2e",
                  marginBottom: 8,
                }}
              >
                Unlock Premium Benefits
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  color: "#666",
                  marginBottom: 12,
                  lineHeight: 18,
                }}
              >
                • 🔊 Voice Messages - AI companion speaks{"\n"}• 📊 Mood
                Analytics - 30-day insights{"\n"}• 📤 Export Chats - Share
                conversations{"\n"}• 🧘 Wellness Hub - Curated exercises{"\n"}•
                🎭 Custom Companions - Create your own
              </Text>
              <TouchableOpacity
                className="bg-[#FF6B9D] rounded-lg py-3 items-center"
                onPress={() => router.push("/(modals)/paywall")}
              >
                <Text
                  style={{
                    fontFamily: "Manrope_600SemiBold",
                    fontSize: 13,
                    color: "white",
                  }}
                >
                  Upgrade to Pro
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Danger Zone */}
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 13,
            color: "#999",
            marginBottom: 12,
            marginLeft: 12,
          }}
        >
          DANGER ZONE
        </Text>

        <View className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden mb-8">
          <TouchableOpacity
            className="flex-row items-center justify-between p-4 border-b border-[#F5F5F5]"
            onPress={handleClearChatHistory}
            disabled={isClearingChat}
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-[#FEF2F2] items-center justify-center">
                {isClearingChat ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <Ionicons
                    name="close-circle-outline"
                    size={20}
                    color="#DC2626"
                  />
                )}
              </View>
              <View>
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 16,
                    color: "#DC2626",
                  }}
                >
                  Clear Chat History
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                    color: "#DC2626",
                    opacity: 0.7,
                    marginTop: 2,
                  }}
                >
                  Delete all conversations
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center justify-between p-4"
            onPress={handleWipeData}
            disabled={isDeleting}
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-[#FEF2F2] items-center justify-center">
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <Ionicons name="trash-outline" size={20} color="#DC2626" />
                )}
              </View>
              <View>
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 16,
                    color: "#DC2626",
                  }}
                >
                  Wipe Memory & Start Over
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                    color: "#DC2626",
                    opacity: 0.7,
                    marginTop: 2,
                  }}
                >
                  Delete all data permanently
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Legal Links — required by App Store & Play Store */}
        <View className="flex-row justify-center mt-2 mb-4" style={{ gap: 20 }}>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                color: "#999",
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
                fontSize: 12,
                color: "#999",
                textDecorationLine: "underline",
              }}
            >
              Terms of Service
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
