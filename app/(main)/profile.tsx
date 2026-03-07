import { useRouter } from "expo-router";
import { StatusBar, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const profile = useAuth((s) => s.profile);
  const isPremium = useAuth((s) => s.isPremium);
  const user = useAuth((s) => s.currentUser);

  const companionName = profile?.companion_name || "Your Companion";
  const role = profile?.role || "friend";

  const getRoleIcon = (r: string) => {
    switch (r) {
      case "boyfriend":
        return "💑";
      case "girlfriend":
        return "👧";
      case "mother":
        return "🥰";
      case "father":
        return "👨‍👧";
      case "custom":
        return "✨";
      default:
        return "😌";
    }
  };

  const getRoleLabel = (r: string) => {
    return r.charAt(0).toUpperCase() + r.slice(1);
  };

  const menuItems = [
    {
      icon: "👑",
      label: "Upgrade to Premium",
      action: () => router.push("/(modals)/paywall"),
    },
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
        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="absolute left-5"
          style={{ top: insets.top + 12 }}
        >
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 18,
              color: "#1a1a2e",
            }}
          >
            ← Back
          </Text>
        </TouchableOpacity>

        {/* Avatar */}
        <View
          style={{
            marginTop: 40,
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: "#F0F0F0",
            borderWidth: 2,
            borderColor: "#E8E8EA",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 40 }}>{getRoleIcon(role)}</Text>
        </View>
        <Text
          style={{
            fontFamily: "Rosehot",
            fontSize: 24,
            color: "#1a1a2e",
            marginTop: 16,
          }}
        >
          {companionName}
        </Text>
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 14,
            color: "#666",
            marginTop: 4,
          }}
        >
          {getRoleLabel(role)}
        </Text>
        <View
          style={{
            marginTop: 8,
            paddingHorizontal: 16,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: isPremium ? "#FFF8E1" : "#fff",
            borderWidth: 1,
            borderColor: isPremium ? "#FDE68A" : "#E8E8EA",
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 13,
              color: isPremium ? "#D97706" : "#999",
            }}
          >
            {isPremium ? "👑 Pro Tier" : "✦ Free Tier"}
          </Text>
        </View>
      </View>

      {/* Menu Card */}
      <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
        <View
          style={{
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: "#F0F0F0",
            borderRadius: 24,
            overflow: "hidden",
          }}
        >
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
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: "#F7F7F8",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                </View>
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 16,
                    color: "#1a1a2e",
                  }}
                >
                  {item.label}
                </Text>
              </View>
              <Text style={{ fontSize: 18, color: "#ccc" }}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}
