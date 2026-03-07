import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const [moodAnalytics, setMoodAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [wellnessResources, setWellnessResources] = useState<any[]>([]);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutModalType, setLogoutModalType] = useState<"anonymous" | "normal" | null>(null);

  const handleRestorePurchases = async () => {
    setIsRestoringPurchases(true);
    try {
      const purchases = await Purchases.restorePurchases();
      const hasPurchases =
        Object.values(purchases.activeSubscriptions || {}).length > 0 ||
        Object.values(purchases.nonSubscriptionTransactions || {})
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
            style={{
              backgroundColor: "#FF6B9D",
              borderRadius: 24,
              padding: 24,
              marginBottom: 24,
              shadowColor: "#FF6B9D",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.25,
              shadowRadius: 15,
              elevation: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }}>
                <Text style={{ fontSize: 32 }}>❤️</Text>
              </View>
              <View style={{ marginLeft: 16, flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Manrope_800ExtraBold",
                    fontSize: 22,
                    color: "white",
                  }}
                >
                  {profile.companion_name || "Your Companion"}
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 14,
                    color: "rgba(255,255,255,0.9)",
                    marginTop: 2,
                  }}
                >
                  {profile.role || "Friend"} • {profile.language || "English"}
                </Text>
              </View>
              {isPremium && (
                <View style={{ backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
                  <Ionicons name="star" size={14} color="white" />
                </View>
              )}
            </View>

            <TouchableOpacity
              style={{
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: 16,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.3)",
              }}
              onPress={() => {
                if (!isPremium) {
                  router.push("/(modals)/paywall");
                } else {
                  router.push("/(auth)/welcome");
                }
              }}
            >
              <Ionicons name={isPremium ? "create-outline" : "lock-closed"} size={18} color="white" />
              <Text
                style={{
                  fontFamily: "Manrope_700Bold",
                  fontSize: 14,
                  color: "white",
                  marginLeft: 8,
                }}
              >
                {isPremium ? "Change Companion" : "Pro: Change Companion"}
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
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 24,
              borderWidth: 1,
              borderColor: "#F0F0F0",
              overflow: "hidden",
              marginBottom: 32,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.05,
              shadowRadius: 10,
              elevation: 2,
            }}
          >
            {/* Upgrade CTA */}
            <TouchableOpacity
              style={{
                padding: 24,
              }}
              onPress={() => router.push("/(modals)/paywall")}
            >
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: "#FFF8E1",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 32 }}>👑</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text
                    style={{
                      fontFamily: "Manrope_800ExtraBold",
                      fontSize: 20,
                      color: "#1a1a2e",
                    }}
                  >
                    Go Premium
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 13,
                      color: "#666",
                      marginTop: 2,
                    }}
                  >
                    All-access from ₹83/mo
                  </Text>
                </View>
                <View style={{ backgroundColor: "#FDF2F8", padding: 8, borderRadius: 12 }}>
                  <Ionicons name="chevron-forward" size={20} color="#DB2777" />
                </View>
              </View>

              {/* Enhanced Benefits Highlight */}
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#1a1a2e", marginBottom: 12 }}>PRO BENEFITS:</Text>
                {[
                  { icon: "chatbubbles", text: "Unlimited AI Conversations", color: "#4F46E5" },
                  { icon: "mic", text: "Voice Messaging (AI Speaks)", color: "#7C3AED" },
                  { icon: "stats-chart", text: "Advanced Mood Analytics", color: "#EC4899" },
                  { icon: "brush", text: "Create Custom Companions", color: "#F59E0B" },
                  { icon: "shield-checkmark", text: "No Advertisements, Ever", color: "#10B981" },
                ].map((item, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: item.color + "15", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                      <Ionicons name={item.icon as any} size={14} color={item.color} />
                    </View>
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: "#444" }}>{item.text}</Text>
                  </View>
                ))}
              </View>

              {/* Primary CTA Button */}
              <View
                style={{
                  backgroundColor: "#1a1a2e",
                  borderRadius: 16,
                  paddingVertical: 16,
                  alignItems: "center",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Manrope_700Bold",
                    fontSize: 16,
                    color: "#fff",
                  }}
                >
                  Unlock Everything — Save 58%
                </Text>
              </View>
            </TouchableOpacity>

            <View style={{ height: 1, backgroundColor: "#F5F5F5" }} />

            {/* Secondary Actions */}
            <View style={{ padding: 8 }}>
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 12,
                }}
                onPress={handleRestorePurchases}
                disabled={isRestoringPurchases}
              >
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" }}>
                    {isRestoringPurchases ? (
                      <ActivityIndicator size="small" color="#7C3AED" />
                    ) : (
                      <Ionicons name="refresh" size={18} color="#7C3AED" />
                    )}
                  </View>
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 14,
                      color: "#666",
                      marginLeft: 12,
                    }}
                  >
                    Restore Purchases
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#ccc" />
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 12,
                }}
                onPress={() => router.push("/(modals)/link-account")}
              >
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#F0F9FF", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="link" size={18} color="#0EA5E9" />
                  </View>
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 14,
                      color: "#666",
                      marginLeft: 12,
                    }}
                  >
                    Link Account
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#ccc" />
              </TouchableOpacity>
            </View>
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


        {/* Admin Section (Owner Only) */}
        {user?.email === "harsh@moodmateai.com" && (
          <>
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 12,
                color: "#6366F1",
                marginBottom: 12,
                marginLeft: 12,
                letterSpacing: 1.5,
              }}
            >
              OWNER CONSOLE
            </Text>

            <View
              style={{
                backgroundColor: "#F5F7FF",
                borderRadius: 20,
                borderWidth: 1,
                borderColor: "#E0E7FF",
                marginBottom: 24,
                overflow: "hidden"
              }}
            >
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 16,
                }}
                onPress={() => router.push("/(admin)/dashboard" as any)}
              >
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: "#4F46E5",
                      alignItems: "center",
                      justifyContent: "center",
                      shadowColor: "#4F46E5",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.2,
                      shadowRadius: 6,
                    }}
                  >
                    <Ionicons name="shield-checkmark" size={22} color="white" />
                  </View>
                  <View style={{ marginLeft: 16 }}>
                    <Text
                      style={{
                        fontFamily: "Manrope_700Bold",
                        fontSize: 16,
                        color: "#1a1a2e",
                      }}
                    >
                      Admin Dashboard
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 12,
                        color: "#6366F1",
                        marginTop: 2,
                      }}
                    >
                      View live analytics & feedback
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6366F1" />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Support Section */}
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 13,
            color: "#999",
            marginBottom: 12,
            marginLeft: 12,
            letterSpacing: 1,
            marginTop: 20,
          }}
        >
          SUPPORT & FEEDBACK
        </Text>

        <View className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden mb-8">
          <TouchableOpacity
            className="flex-row items-center justify-between p-4 border-b border-[#F5F5F5]"
            onPress={() => {
              Alert.prompt(
                "Send Feedback",
                "How can we improve MoodMateAI? Your feedback goes directly to the developer.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Send",
                    onPress: async (msg?: string) => {
                      if (!msg) return;
                      try {
                        const { error } = await supabase.from("feedback" as any).insert({
                          user_id: user?.id,
                          message: msg,
                          rating: 5,
                        });
                        if (error) throw error;
                        Alert.alert("Thank You!", "Your feedback has been received. ❤️");
                      } catch (e) {
                        logger.error("Feedback failed", e);
                        Alert.alert("Error", "Could not send feedback. Try again later.");
                      }
                    },
                  },
                ],
                "plain-text"
              );
            }}
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-[#F0FDF4] items-center justify-center">
                <Ionicons
                  name="chatbox-ellipses-outline"
                  size={20}
                  color="#10B981"
                />
              </View>
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 15,
                  color: "#1a1a2e",
                }}
              >
                Send Feedback
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center justify-between p-4"
            onPress={() => Linking.openURL("mailto:support@moodmateai.com")}
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-[#EFF6FF] items-center justify-center">
                <Ionicons name="mail-outline" size={20} color="#2563EB" />
              </View>
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 15,
                  color: "#1a1a2e",
                }}
              >
                Email Support
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>

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
            className="flex-row items-center justify-between p-4"
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
                  Delete all conversations permanently
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Account Section */}
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 13,
            color: "#999",
            marginBottom: 12,
            marginLeft: 12,
            letterSpacing: 1,
          }}
        >
          ACCOUNT
        </Text>

        <View className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden mb-8">
          {user?.is_anonymous && (
            <TouchableOpacity
              className="flex-row items-center justify-between p-4 border-b border-[#F5F5F5]"
              onPress={() => router.push("/(modals)/link-account")}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-[#EFF6FF] items-center justify-center">
                  <Ionicons name="link-outline" size={20} color="#2563EB" />
                </View>
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 15,
                    color: "#1a1a2e",
                  }}
                >
                  Link Account
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            className="flex-row items-center justify-between p-4"
            onPress={() => {
              setLogoutModalType(user?.is_anonymous ? "anonymous" : "normal");
              setShowLogoutModal(true);
            }}
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-[#FEF2F2] items-center justify-center">
                <Ionicons name="log-out-outline" size={20} color="#DC2626" />
              </View>
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 16,
                  color: "#DC2626",
                }}
              >
                Log Out
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Legal Links — required by App Store & Play Store */}
        <View className="flex-row justify-center mt-2" style={{ gap: 20 }}>
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

        {/* Medical Disclaimer — Required for Play Store Mental Health Category */}
        <View style={{ marginTop: 20, marginBottom: 40, paddingHorizontal: 12 }}>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 11,
              color: "#94a3b8",
              textAlign: "center",
              lineHeight: 16,
            }}
          >
            MoodMateAI is an AI companion and is NOT a replacement for professional medical advice, diagnosis, or treatment. If you are in a crisis, please contact your local emergency services or a mental health professional.
          </Text>
        </View>
      </ScrollView>

      {/* Custom Logout Modal */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 24, width: "100%", maxWidth: 400, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 }}>
            {/* Modal Icon */}
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: logoutModalType === "anonymous" ? "#FEF2F2" : "#F3F4F6", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Ionicons name={logoutModalType === "anonymous" ? "warning" : "log-out"} size={32} color={logoutModalType === "anonymous" ? "#DC2626" : "#4B5563"} />
            </View>

            {/* Modal Title */}
            <Text style={{ fontFamily: "Manrope_800ExtraBold", fontSize: 22, color: "#1a1a2e", marginBottom: 12, textAlign: "center" }}>
              {logoutModalType === "anonymous" ? "Wait, don't lose your chats!" : "Log Out"}
            </Text>

            {/* Modal Message */}
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 15, color: "#666", textAlign: "center", marginBottom: 24, lineHeight: 22 }}>
              {logoutModalType === "anonymous"
                ? "You will lose all your chats and your companion forever if you log out now! Please link your account first to save them safely in the cloud."
                : "Are you sure you want to log out of your account? Your chats are safely backed up and waiting for you when you return."}
            </Text>

            {/* Modal Buttons */}
            {logoutModalType === "anonymous" ? (
              <View style={{ width: "100%", gap: 12 }}>
                <TouchableOpacity
                  style={{ backgroundColor: "#1337ec", paddingVertical: 16, borderRadius: 16, alignItems: "center" }}
                  onPress={() => {
                    setShowLogoutModal(false);
                    router.push("/(modals)/link-account");
                  }}
                >
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#fff" }}>Link Account</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ paddingVertical: 16, borderRadius: 16, alignItems: "center", backgroundColor: "#FEF2F2" }}
                  onPress={async () => {
                    setShowLogoutModal(false);
                    await signOut();
                    router.replace("/(auth)/welcome");
                  }}
                >
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#DC2626" }}>Logout Anyway (Lose Data)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ paddingVertical: 12, alignItems: "center" }}
                  onPress={() => setShowLogoutModal(false)}
                >
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 15, color: "#64748b" }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ width: "100%", flexDirection: "row", gap: 12 }}>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: "center", backgroundColor: "#F3F4F6" }}
                  onPress={() => setShowLogoutModal(false)}
                >
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#4B5563" }}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: "center", backgroundColor: "#DC2626" }}
                  onPress={async () => {
                    setShowLogoutModal(false);
                    await signOut();
                    router.replace("/(auth)/welcome");
                  }}
                >
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#fff" }}>Log Out</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
