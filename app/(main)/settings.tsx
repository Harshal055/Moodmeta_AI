import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useState } from "react";
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
import { logger } from "../../utils/logger";

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

        <View className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden mb-8">
          <TouchableOpacity
            className="flex-row items-center justify-between p-4 border-b border-[#F5F5F5]"
            onPress={() => router.push("/(modals)/paywall")}
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-[#FFF8E1] items-center justify-center">
                <Text style={{ fontSize: 18 }}>👑</Text>
              </View>
              <View>
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 16,
                    color: "#1a1a2e",
                  }}
                >
                  {isPremium ? "Upgrade Plan" : "Go Premium"}
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                    color: "#888",
                    marginTop: 2,
                  }}
                >
                  ₹99/mo, ₹799/yr, or ₹2,999 lifetime
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center justify-between p-4 border-b border-[#F5F5F5]"
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
                    fontSize: 16,
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
            className="flex-row items-center justify-between p-4"
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
                    fontSize: 16,
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
