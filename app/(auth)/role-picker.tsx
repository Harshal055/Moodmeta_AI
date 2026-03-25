import { Ionicons } from "@expo/vector-icons";
import { getLocales } from "expo-localization";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { logger } from "../../utils/logger";

const roles = [
  {
    id: "friend",
    label: "Supportive Listener",
    description: "Someone to vent to and offer emotional support without judgment.",
    icon: "heart",
    iconColor: "#1337ec",
    image: require("../../assets/images/avatar_friend.png"), // Reuse existing or use a placeholder if needed
  },
  {
    id: "boyfriend", // Keeping internal ID as boyfriend for now to match backend, but label is "Goal Motivator" in screenshot
    label: "Goal Motivator",
    description: "Keeps you on track, pushes you to succeed, and celebrates wins.",
    icon: "flash",
    iconColor: "#1337ec",
    image: require("../../assets/images/avatar_boyfriend.png"),
  },
  {
    id: "mother", // Keeping internal ID
    label: "Wise Mentor",
    description: "Provides thoughtful perspective and helps you solve problems.",
    icon: "book",
    iconColor: "#1337ec",
    image: require("../../assets/images/avatar_mother.png"),
  },
  {
    id: "girlfriend", // Keeping internal ID
    label: "Playful Friend",
    description: "Lighthearted chat, jokes, and casual companionship.",
    icon: "happy",
    iconColor: "#1337ec",
    image: require("../../assets/images/avatar_girlfriend.png"),
  },
];

const REGION_TO_COUNTRY: Record<string, string> = {
  IN: "India",
  US: "USA",
  GB: "UK",
  CA: "Canada",
  AU: "Australia",
  AE: "UAE",
  DE: "Germany",
  FR: "France",
  SG: "Singapore",
};

export default function RolePicker() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const updateProfile = useAuth((s) => s.updateProfile);
  const isPremium = useAuth((s) => s.isPremium);

  useEffect(() => {
    logger.info("SCREEN_VIEW: RolePicker");
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Top Bar matching screenshot */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 16,
          paddingBottom: 8,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(auth)/welcome");
            }
          }}
          style={{
            width: 48,
            height: 48,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            paddingRight: 48,
            fontFamily: "Inter_700Bold",
            fontSize: 18,
            color: "#0f172a",
          }}
        >
          Companion Setup
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 }}>
          <Text
            style={{
              fontFamily: "Rosehot",
              fontSize: 36,
              color: "#0f172a",
              marginBottom: 8,
              letterSpacing: -0.5,
              lineHeight: 44,
            }}
          >
            Choose Role
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 15,
              color: "#64748b",
              lineHeight: 22,
            }}
          >
            Select how you'd like your companion to interact with you today.
          </Text>
        </View>

        {/* Role Cards List */}
        <View style={{ paddingHorizontal: 24, gap: 16 }}>
          {roles.map((role) => {
            const isSelected = selectedRole === role.id;
            return (
              <View
                key={role.id}
                style={{
                  borderWidth: 1.5,
                  borderColor: isSelected ? "#1337ec" : "#f1f5f9",
                  borderRadius: 20,
                  backgroundColor: "#fff",
                  padding: 16,
                  shadowColor: isSelected ? "#1337ec" : "transparent",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 12,
                  elevation: isSelected ? 4 : 0,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
                  <View style={{ flex: 1, paddingRight: 16 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <Ionicons name={role.icon as any} size={20} color={role.iconColor} />
                      <Text
                        style={{
                          fontFamily: "Inter_700Bold",
                          fontSize: 17,
                          color: "#0f172a",
                        }}
                      >
                        {role.label}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 13,
                        color: "#64748b",
                        lineHeight: 20,
                      }}
                    >
                      {role.description}
                    </Text>
                  </View>
                  <View>
                    <Image
                      source={role.image}
                      style={{ width: 80, height: 80, borderRadius: 12 }}
                      resizeMode="cover"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setSelectedRole(role.id)}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: isSelected ? "#1337ec" : "#f8fafc",
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 15,
                      color: isSelected ? "#fff" : "#0f172a",
                    }}
                  >
                    Select Role
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={isSelected ? "#fff" : "#0f172a"}
                  />
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Custom Role Card (Pro) */}
          <View
            style={{
              borderWidth: 1.5,
              borderColor: selectedRole === "custom" ? "#1337ec" : "#f1f5f9",
              borderRadius: 20,
              backgroundColor: "#fff",
              padding: 16,
              shadowColor: selectedRole === "custom" ? "#1337ec" : "transparent",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: selectedRole === "custom" ? 4 : 0,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
              <View style={{ flex: 1, paddingRight: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Ionicons name="build" size={20} color={!isPremium ? "#94a3b8" : "#1337ec"} />
                  <Text
                    style={{
                      fontFamily: "Inter_700Bold",
                      fontSize: 17,
                      color: "#0f172a",
                    }}
                  >
                    Custom Role
                  </Text>
                  {!isPremium && (
                    <View style={{ backgroundColor: "#FEF08A", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 10, color: "#854D0E" }}>PRO</Text>
                    </View>
                  )}
                </View>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 13,
                    color: "#64748b",
                    lineHeight: 20,
                  }}
                >
                  Create a completely custom companion with tailored traits and instructions.
                </Text>
              </View>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 12,
                  backgroundColor: "#F8FAFC",
                  justifyContent: "center",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#E2E8F0",
                  borderStyle: "dashed"
                }}
              >
                <Ionicons name={!isPremium ? "lock-closed" : "add"} size={32} color={!isPremium ? "#94a3b8" : "#1337ec"} />
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {
                if (!isPremium) {
                  router.push("/(modals)/paywall");
                  return;
                }
                setSelectedRole("custom");
              }}
              activeOpacity={0.7}
              style={{
                backgroundColor: selectedRole === "custom" ? "#1337ec" : "#f8fafc",
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 15,
                  color: selectedRole === "custom" ? "#fff" : "#0f172a",
                }}
              >
                {!isPremium ? "Unlock Custom Role" : "Select Role"}
              </Text>
              <Ionicons
                name={!isPremium ? "lock-closed" : "arrow-forward"}
                size={16}
                color={selectedRole === "custom" || !isPremium ? (selectedRole === "custom" ? "#fff" : "#0f172a") : "#0f172a"}
              />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Footer Area with Button */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 20,
          paddingTop: 16,
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderColor: "#f1f5f9",
        }}
      >
        <TouchableOpacity
          disabled={!selectedRole}
          onPress={async () => {
            if (!selectedRole) return;
            // Match the inferred logic from original
            const locale = getLocales()[0];
            const regionCode = locale?.regionCode?.toUpperCase?.() || "";
            const inferredCountry = REGION_TO_COUNTRY[regionCode] || "India";
            await updateProfile({
              role: selectedRole,
              country: inferredCountry,
            });
            // Update the next step in flow (it used to be language-picker, but often it goes to name-companion now based on typical flows)
            // Sticking to language-picker as that is what the original code did
            router.push("/(auth)/language-picker");
          }}
          activeOpacity={0.8}
          style={{
            backgroundColor: selectedRole ? "#1337ec" : "#e2e8f0",
            borderRadius: 16,
            height: 56,
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "row",
            gap: 8,
            shadowColor: selectedRole ? "#1337ec" : "transparent",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: selectedRole ? 8 : 0,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_700Bold",
              fontSize: 16,
              color: selectedRole ? "#fff" : "#94a3b8",
            }}
          >
            Continue
          </Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={selectedRole ? "#fff" : "#94a3b8"}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
