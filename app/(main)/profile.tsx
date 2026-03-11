import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { logger } from "../../utils/logger";
import { getMoodAnalytics } from "../../utils/moodAnalytics";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const profile = useAuth((s) => s.profile);
  const isPremium = useAuth((s) => s.isPremium);
  const user = useAuth((s) => s.currentUser);

  const [moodAnalytics, setMoodAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const companionName = profile?.companion_name || "Your Companion";
  const role = profile?.role || "friend";

  useEffect(() => {
    logger.info("SCREEN_VIEW: Profile");
  }, []);

  // Load mood analytics
  useEffect(() => {
    async function loadStats() {
      if (!user?.id) return;
      try {
        setLoadingAnalytics(true);
        const stats = await getMoodAnalytics(user.id);
        setMoodAnalytics(stats);
      } catch (e) {
        logger.error("Profile: Error loading mood stats", e);
      } finally {
        setLoadingAnalytics(false);
      }
    }
    loadStats();
  }, [user?.id]);

  const getRoleIcon = (r: string) => {
    switch (r) {
      case "boyfriend": return "💑";
      case "girlfriend": return "👧";
      case "mother": return "🥰";
      case "father": return "👨‍👧";
      case "custom": return "✨";
      default: return "😌";
    }
  };

  const getRoleLabel = (r: string) => {
    return r.charAt(0).toUpperCase() + r.slice(1);
  };

  const menuItems = [
    // Only show Upgrade button for free users
    ...(!isPremium ? [{
      icon: "👑",
      label: "Upgrade to Premium",
      action: () => router.push("/(modals)/paywall"),
    }] : []),
    ...(user?.is_anonymous ? [{
      icon: "🔗",
      label: "Save My Chats Forever",
      action: () => router.push("/(modals)/link-account"),
    }] : []),
    {
      icon: isPremium ? "🎨" : "🔒",
      label: isPremium ? "Customize Companion" : "Pro: Customize Companion",
      action: () => isPremium ? router.push("/(main)/customize") : router.push("/(modals)/paywall"),
    },
    {
      icon: "⚙️",
      label: "Settings",
      action: () => router.push("/(main)/settings"),
    },
  ];

  return (
    <View className="flex-1" style={{ backgroundColor: "#fff" }}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 40,
          alignItems: "center",
          backgroundColor: "#F7F7F8",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="absolute left-5"
          style={{ top: insets.top + 12 }}
        >
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 18, color: "#1a1a2e" }}>← Back</Text>
        </TouchableOpacity>

        <View style={{ marginTop: 40, width: 96, height: 96, borderRadius: 48, backgroundColor: "#F0F0F0", borderWidth: 2, borderColor: "#E8E8EA", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 40 }}>{getRoleIcon(role)}</Text>
        </View>
        <Text style={{ fontFamily: "Rosehot", fontSize: 24, color: "#1a1a2e", marginTop: 16 }}>{companionName}</Text>
        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: "#666", marginTop: 4 }}>{getRoleLabel(role)}</Text>
        <View style={{ marginTop: 8, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999, backgroundColor: isPremium ? "#FFF8E1" : "#fff", borderWidth: 1, borderColor: isPremium ? "#FDE68A" : "#E8E8EA" }}>
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: isPremium ? "#D97706" : "#999" }}>
            {isPremium ? "👑 Pro Tier" : "✦ Free Tier"}
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Mood Stats Section */}
        <View style={{ padding: 20 }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#999", marginBottom: 12, marginLeft: 8, letterSpacing: 0.5 }}>MY MOOD JOURNEY</Text>
          <View style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "#F0F0F0", borderRadius: 24, padding: 20, minHeight: 120, justifyContent: "center" }}>
            {loadingAnalytics ? (
              <ActivityIndicator color="#FF6B9D" />
            ) : moodAnalytics ? (
              <View>
                <View className="flex-row items-center justify-between mb-4">
                  <View>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#666" }}>Weekly Average</Text>
                    <Text style={{ fontFamily: "Manrope_800ExtraBold", fontSize: 24, color: "#1a1a2e" }}>{moodAnalytics.averageIntensity?.toFixed(1) || "0.0"}</Text>
                  </View>
                  <View className="bg-[#F0FDF4] px-3 py-1 rounded-full">
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#10B981" }}>{moodAnalytics.improvementTrend?.toUpperCase() || "STABLE"}</Text>
                  </View>
                </View>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#1a1a2e" }}>
                  Most common mood: <Text style={{ color: "#FF6B9D" }}>{moodAnalytics.mostCommonMood}</Text>
                </Text>
              </View>
            ) : (
              <View className="items-center">
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🌱</Text>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: "#1a1a2e", textAlign: "center" }}>
                  Start logging your mood to see trends 😊
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Menu Card */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <View style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "#F0F0F0", borderRadius: 24, overflow: "hidden" }}>
            {menuItems.map((item, i) => (
              <TouchableOpacity
                key={i}
                onPress={item.action}
                activeOpacity={0.7}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 20,
                  paddingVertical: 18,
                  borderBottomWidth: i < menuItems.length - 1 ? 1 : 0,
                  borderBottomColor: "#F5F5F5",
                }}
              >
                <View className="flex-row items-center" style={{ gap: 16 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "#F7F7F8", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                  </View>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 16, color: "#1a1a2e" }}>{item.label}</Text>
                </View>
                <Text style={{ fontSize: 18, color: "#ccc" }}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
