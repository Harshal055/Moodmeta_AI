import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Purchases from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { logger } from "../../utils/logger";

const PRIVACY_POLICY_URL = "https://harshal055.github.io/moodmateai-site/";
const TERMS_OF_SERVICE_URL = "https://harshal055.github.io/moodmateai-site/";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.currentUser);
  const profile = useAuth((s) => s.profile);
  const isPremium = useAuth((s) => s.isPremium);
  const signOut = useAuth((s) => s.signOut);

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSignOutInProgress, setIsSignOutInProgress] = useState(false);
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);

  // Feedback modal states
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);

  // Account action states
  const [isClearingChat, setIsClearingChat] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    logger.info("SCREEN_VIEW: Settings");
  }, []);

  // Compute display name from profile or user metadata
  const displayName =
    (user?.user_metadata?.full_name as string) ||
    (user?.user_metadata?.name as string) ||
    profile?.companion_name ||
    user?.email?.split("@")[0] ||
    "You";

  const handleSignOut = async () => {
    setIsSignOutInProgress(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await signOut();
      router.replace("/(auth)/welcome");
    } catch (error) {
      Alert.alert("Error", "Failed to log out. Please try again.");
    } finally {
      setIsSignOutInProgress(false);
    }
  };

  const handleSendFeedback = async () => {
    if (!feedbackMessage.trim() || !user?.id) return;
    setIsSendingFeedback(true);
    try {
      const { error } = await supabase.from("feedback").insert({
        user_id: user.id,
        message: feedbackMessage,
      });
      if (error) throw error;
      Alert.alert("Thank you!", "Your feedback has been received.");
      setShowFeedbackModal(false);
      setFeedbackMessage("");
    } catch (error) {
      logger.error("Error sending feedback:", error);
      Alert.alert("Error", "Could not send feedback. Please try again.");
    } finally {
      setIsSendingFeedback(false);
    }
  };

  const handleRestorePurchases = async () => {
    setIsRestoringPurchases(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const customerInfo = await Purchases.restorePurchases();
      const entitlements = customerInfo?.entitlements?.active;
      const hasPro = entitlements && Object.keys(entitlements).length > 0;
      if (hasPro) {
        Alert.alert("Purchases Restored", "Your premium subscription has been restored successfully!");
      } else {
        Alert.alert("No Purchases Found", "We couldn't find any active purchases linked to this account.");
      }
    } catch (error) {
      logger.error("Error restoring purchases:", error);
      Alert.alert("Error", "Could not restore purchases. Please try again.");
    } finally {
      setIsRestoringPurchases(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // On iOS, opens the App Store subscription manager
      // On Android, opens Google Play subscription page
      if (Platform.OS === "ios") {
        await Linking.openURL("https://apps.apple.com/account/subscriptions");
      } else {
        await Linking.openURL(
          "https://play.google.com/store/account/subscriptions?package=com.harshal.moodmateai"
        );
      }
    } catch (error) {
      logger.error("Error opening subscription management:", error);
      Alert.alert("Error", "Could not open subscription management.");
    }
  };

  const handleClearChatHistory = () => {
    if (!user?.id) return;
    Alert.alert(
      "Clear Chat History",
      "Are you sure you want to delete all messages with your companion? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setIsClearingChat(true);
            try {
              await supabase.from("chats").delete().eq("user_id", user.id);
              await AsyncStorage.removeItem(`chat_history_${user.id}`);
              Alert.alert("Done", "Chat history cleared successfully.");
            } catch (error) {
              logger.error("Error clearing chat history", error);
              Alert.alert("Error", "Could not clear chat history.");
            } finally {
              setIsClearingChat(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    if (!user?.id) return;
    Alert.alert(
      "Delete Account",
      "Are you absolutely sure? This permanently deletes your account, all mood logs, chat history and cancels your subscription. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete My Account",
          style: "destructive",
          onPress: async () => {
            setIsDeletingAccount(true);
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              const { error } = await supabase.functions.invoke("delete-user");
              if (error) throw error;
              await signOut();
              router.replace("/(auth)/welcome");
            } catch (error) {
              logger.error("Error deleting account", error);
              Alert.alert(
                "Action Required",
                "To fully delete your account, please email us from your registered address.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Email Support",
                    onPress: () =>
                      Linking.openURL(
                        `mailto:support@moodmateai.com?subject=Account Deletion Request&body=Please delete my account: ${user?.email}`
                      ),
                  },
                ]
              );
            } finally {
              setIsDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(main)/dashboard" as any);
    }
  };

  const SettingRow = ({
    icon,
    label,
    subtitle,
    onPress,
    rightElement,
    iconColor = "#475569",
    labelColor = "#0f172a",
    disabled = false,
  }: {
    icon: any;
    label: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    iconColor?: string;
    labelColor?: string;
    disabled?: boolean;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || !onPress}
      style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 14, opacity: disabled ? 0.6 : 1 }}
    >
      <View style={{ width: 20, alignItems: "center" }}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 15, color: labelColor, marginBottom: subtitle ? 2 : 0 }}>{label}</Text>
        {subtitle ? <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#64748b" }}>{subtitle}</Text> : null}
      </View>
      {rightElement !== undefined ? rightElement : <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />}
    </TouchableOpacity>
  );

  const SectionTitle = ({ title }: { title: string }) => (
    <Text style={{ fontFamily: "Inter_700Bold", fontSize: 11, color: "#94A3B8", letterSpacing: 1.5, paddingHorizontal: 24, paddingBottom: 12, paddingTop: 28 }}>
      {title}
    </Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F9FA" }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 24,
          paddingBottom: 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TouchableOpacity onPress={goBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: "#0f172a" }}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Profile Card */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Image
              source={
                profile?.avatar_url
                  ? { uri: profile.avatar_url }
                  : require("../../assets/images/logo.png")
              }
              style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#EBEAFC" }}
            />
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 20, color: "#0f172a", marginBottom: 2 }}>
                {displayName}
              </Text>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#4F46E5" }} numberOfLines={1}>
                {user?.email || ""}
              </Text>
              {isPremium && (
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                  <Ionicons name="star" size={12} color="#F59E0B" />
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 11, color: "#F59E0B", marginLeft: 4 }}>PREMIUM</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(main)/profile" as any)}
            style={{ backgroundColor: "#EEECFE", alignSelf: "flex-start", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 }}
          >
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 12, color: "#4F46E5" }}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Premium Banner (only for free users) */}
        {!isPremium && (
          <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 16,
                padding: 20,
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#F1F5F9",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View style={{ flex: 1, paddingRight: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                  <Ionicons name="star" size={14} color="#F59E0B" style={{ marginRight: 6 }} />
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 15, color: "#0f172a" }}>Premium Membership</Text>
                </View>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#64748b", lineHeight: 18, marginBottom: 16 }}>
                  Unlock personalized AI insights and unlimited mood tracking.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/(modals)/paywall" as any)}
                  style={{ backgroundColor: "#2013C9", alignSelf: "flex-start", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
                >
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: "#fff" }}>Upgrade Now</Text>
                </TouchableOpacity>
              </View>
              <View style={{ width: 64, height: 64, backgroundColor: "#F5F3FF", borderRadius: 16, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="hardware-chip" size={32} color="#A78BFA" />
              </View>
            </View>
          </View>
        )}

        {/* SUBSCRIPTION */}
        <SectionTitle title="SUBSCRIPTION" />
        {isPremium ? (
          <SettingRow
            icon="card"
            label="Manage Subscription"
            subtitle="View or cancel your active plan"
            onPress={handleManageSubscription}
          />
        ) : (
          <SettingRow
            icon="card-outline"
            label="View Plans"
            subtitle="Upgrade to unlock premium features"
            onPress={() => router.push("/(modals)/paywall" as any)}
          />
        )}
        <SettingRow
          icon={isRestoringPurchases ? "refresh" : "refresh-outline"}
          label="Restore Purchases"
          subtitle="Recover your previous subscription"
          iconColor="#475569"
          onPress={handleRestorePurchases}
          disabled={isRestoringPurchases}
          rightElement={
            isRestoringPurchases ? (
              <ActivityIndicator size="small" color="#4F46E5" />
            ) : (
              <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
            )
          }
        />

        {/* ACCOUNT */}
        <SectionTitle title="ACCOUNT" />
        <SettingRow
          icon="language"
          label="Language"
          subtitle={profile?.language ? `Currently: ${profile.language}` : "Change app language"}
          onPress={() => router.push("/(auth)/language-picker" as any)}
        />
        <SettingRow
          icon="lock-closed"
          label="Privacy Policy"
          subtitle="Read our privacy terms"
          onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          rightElement={<Ionicons name="open-outline" size={16} color="#CBD5E1" />}
        />
        <SettingRow
          icon="key"
          label="Reset Password"
          subtitle="Send password reset email"
          onPress={() => {
            if (!user?.email) return;
            Alert.alert(
              "Reset Password",
              `We'll send a reset link to ${user.email}`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Send",
                  onPress: async () => {
                    try {
                      const resetLink = Linking.createURL("/(auth)/reset-password");
                      await supabase.auth.resetPasswordForEmail(user.email!, {
                        redirectTo: resetLink,
                      });
                      Alert.alert("Sent!", "Check your email for the reset link.");
                    } catch {
                      Alert.alert("Error", "Could not send reset email.");
                    }
                  },
                },
              ]
            );
          }}
        />
        <SettingRow
          icon="chatbubbles-outline"
          label="Clear Chat History"
          subtitle="Wipe all companion messages"
          iconColor="#EAB308"
          onPress={handleClearChatHistory}
          disabled={isClearingChat}
          rightElement={
            isClearingChat ? (
              <ActivityIndicator size="small" color="#EAB308" />
            ) : (
              <Ionicons name="warning-outline" size={16} color="#EAB308" />
            )
          }
        />
        <SettingRow
          icon="trash-outline"
          label="Delete Account"
          subtitle="Permanently remove your data"
          iconColor="#EF4444"
          labelColor="#EF4444"
          onPress={handleDeleteAccount}
          disabled={isDeletingAccount}
          rightElement={
            isDeletingAccount ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Ionicons name="chevron-forward" size={16} color="#FCC8D1" />
            )
          }
        />

        {/* APP SETTINGS */}
        <SectionTitle title="APP SETTINGS" />
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 14 }}>
          <View style={{ width: 20, alignItems: "center" }}>
            <Ionicons name="moon" size={20} color="#475569" />
          </View>
          <View style={{ flex: 1, paddingHorizontal: 16 }}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 15, color: "#0f172a" }}>Dark Mode</Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#64748b" }}>Switch app appearance</Text>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={setIsDarkMode}
            trackColor={{ false: "#E2E8F0", true: "#4F46E5" }}
            thumbColor="#fff"
            style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }}
          />
        </View>
        <SettingRow
          icon="notifications"
          label="Notifications"
          subtitle="Reminders and wellness alerts"
          onPress={() => {
            Linking.openSettings().catch(() => {
              Alert.alert("Open Settings", "Please go to your device Settings to manage notifications.");
            });
          }}
        />

        {/* SUPPORT */}
        <SectionTitle title="SUPPORT" />
        <SettingRow
          icon="chatbubble-outline"
          label="Send Feedback"
          subtitle="Share your thoughts, report issues"
          onPress={() => setShowFeedbackModal(true)}
        />
        <SettingRow
          icon="mail-outline"
          label="Email Support"
          subtitle="Contact us directly"
          onPress={() => Linking.openURL("mailto:support@moodmateai.com")}
          rightElement={<Ionicons name="open-outline" size={16} color="#CBD5E1" />}
        />
        <SettingRow
          icon="document-text"
          label="Terms & Conditions"
          subtitle="Read our legal guidelines"
          onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}
          rightElement={<Ionicons name="open-outline" size={16} color="#CBD5E1" />}
        />

        {/* Log Out */}
        <View style={{ marginTop: 40, alignItems: "center", paddingBottom: 20 }}>
          {isSignOutInProgress ? (
            <ActivityIndicator color="#EF4444" />
          ) : (
            <TouchableOpacity
              onPress={handleSignOut}
              style={{ flexDirection: "row", alignItems: "center", padding: 12 }}
            >
              <Ionicons name="log-out-outline" size={22} color="#EF4444" style={{ marginRight: 8 }} />
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 15, color: "#EF4444" }}>Log Out</Text>
            </TouchableOpacity>
          )}
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#CBD5E1", marginTop: 16 }}>
            MoodMate AI
          </Text>
        </View>
      </ScrollView>

      {/* Send Feedback Modal */}
      <Modal
        visible={showFeedbackModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFeedbackModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, backgroundColor: "#fff" }}
        >
          <View style={{ flex: 1, paddingTop: Platform.OS === "android" ? 24 : 0 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: "#0f172a" }}>Send Feedback</Text>
              <TouchableOpacity onPress={() => setShowFeedbackModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20, flex: 1 }}>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#475569", marginBottom: 16 }}>
                We'd love to hear your thoughts, suggestions, or any issues you've encountered!
              </Text>
              <TextInput
                style={{
                  backgroundColor: "#F8FAFC",
                  borderRadius: 12,
                  padding: 16,
                  fontFamily: "Inter_400Regular",
                  fontSize: 15,
                  color: "#0f172a",
                  minHeight: 150,
                  textAlignVertical: "top",
                  borderWidth: 1,
                  borderColor: "#E2E8F0",
                }}
                placeholder="Type your feedback here..."
                placeholderTextColor="#94A3B8"
                multiline
                maxLength={500}
                value={feedbackMessage}
                onChangeText={setFeedbackMessage}
                autoFocus
              />
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#94A3B8", textAlign: "right", marginTop: 8 }}>
                {feedbackMessage.length}/500
              </Text>
            </View>

            <View style={{ padding: 24, paddingBottom: Platform.OS === "ios" ? insets.bottom + 24 : 24, borderTopWidth: 1, borderTopColor: "#F1F5F9" }}>
              <TouchableOpacity
                onPress={handleSendFeedback}
                disabled={!feedbackMessage.trim() || isSendingFeedback}
                style={{
                  backgroundColor: !feedbackMessage.trim() || isSendingFeedback ? "#E2E8F0" : "#2013C9",
                  paddingVertical: 16,
                  borderRadius: 12,
                  alignItems: "center",
                }}
              >
                {isSendingFeedback ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: !feedbackMessage.trim() ? "#94A3B8" : "#fff" }}>
                    Send Feedback
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
