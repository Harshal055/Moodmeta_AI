import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getLocales } from "expo-localization";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ImageBackground,
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
    label: "Friend",
    image: require("../../assets/images/avatar_friend.png")
  },
  {
    id: "boyfriend",
    label: "Boyfriend",
    image: require("../../assets/images/avatar_boyfriend.png")
  },
  {
    id: "girlfriend",
    label: "Girlfriend",
    image: require("../../assets/images/avatar_girlfriend.png")
  },
  {
    id: "mother",
    label: "Mother",
    image: require("../../assets/images/avatar_mother.png")
  },
  {
    id: "father",
    label: "Father",
    image: require("../../assets/images/avatar_father.png")
  },
  {
    id: "custom",
    label: "Custom",
    image: null
  },
];

const REGION_TO_COUNTRY: Record<string, string> = {
  IN: "India", US: "USA", GB: "UK", CA: "Canada",
  AU: "Australia", AE: "UAE", DE: "Germany", FR: "France", SG: "Singapore",
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
    <View className="flex-1 bg-[#f6f6f8]">
      <StatusBar barStyle="dark-content" />

      {/* Top Bar matching HTML design */}
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 48, height: 48, justifyContent: "center", alignItems: "center" }}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: "center", paddingRight: 48, fontFamily: "Inter_700Bold", fontSize: 18, color: "#0f172a", letterSpacing: -0.5 }}>
          Companion Selection
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header matching HTML */}
        <View style={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 16 }}>
          <Text
            style={{
              fontFamily: "Inter_800ExtraBold",
              fontSize: 30,
              color: "#0f172a",
              lineHeight: 38,
              letterSpacing: -0.5,
              marginBottom: 8
            }}
          >
            Who do you need{"\n"}with you today?
          </Text>
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 14,
              color: "#64748b",
            }}
          >
            Choose the persona that fits your current mood or needs.
          </Text>
        </View>

        {/* Role Cards Grid */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", padding: 16, justifyContent: "space-between" }}>
          {roles.map((role) => {
            const isSelected = selectedRole === role.id;
            return (
              <TouchableOpacity
                key={role.id}
                onPress={() => {
                  if (role.id === "custom" && !isPremium) {
                    router.push("/(modals)/paywall");
                    return;
                  }
                  setSelectedRole(role.id);
                }}
                activeOpacity={0.9}
                style={{
                  width: "48%",
                  aspectRatio: 4 / 5,
                  marginBottom: 16,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: isSelected ? "#1337ec" : "#f1f5f9",
                  overflow: "hidden",
                  backgroundColor: "#fff",
                }}
              >
                {role.image ? (
                  <ImageBackground
                    source={role.image}
                    resizeMode="cover"
                    style={{ width: "100%", height: "100%", justifyContent: "flex-end", padding: 12 }}
                    imageStyle={{ borderRadius: 14 }}
                  >
                    <LinearGradient
                      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']}
                      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%', borderRadius: 14 }}
                    />
                    <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: "#fff", zIndex: 10 }}>{role.label}</Text>

                    {isSelected && (
                      <View style={{ position: "absolute", top: 12, right: 12, zIndex: 10 }}>
                        <Ionicons name="checkmark-circle" size={24} color="#fff" />
                      </View>
                    )}
                  </ImageBackground>
                ) : (
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" }}>
                    <View style={{ backgroundColor: "rgba(19, 55, 236, 0.1)", borderRadius: 999, padding: 16, marginBottom: 12 }}>
                      {role.id === "custom" && !isPremium ? (
                        <Ionicons name="lock-closed" size={32} color="#1337ec" />
                      ) : (
                        <Ionicons name="add" size={32} color="#1337ec" />
                      )}
                    </View>
                    <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: "#0f172a", textAlign: "center", paddingHorizontal: 8 }}>
                      {role.id === "custom" && !isPremium ? "Pro\nCustom" : "Create\nCustom"}
                    </Text>

                    {isSelected && (
                      <View style={{ position: "absolute", top: 12, right: 12, zIndex: 10 }}>
                        <Ionicons name="checkmark-circle" size={24} color="#1337ec" />
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Footer Area with Button and Indicator */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 32,
          paddingTop: 24,
          backgroundColor: "#f6f6f8",
          borderTopWidth: 1,
          borderColor: "rgba(0,0,0,0.05)"
        }}
      >
        <TouchableOpacity
          disabled={!selectedRole}
          onPress={async () => {
            if (!selectedRole) return;
            const locale = getLocales()[0];
            const regionCode = locale?.regionCode?.toUpperCase?.() || "";
            const inferredCountry = REGION_TO_COUNTRY[regionCode] || "India";
            await updateProfile({ role: selectedRole, country: inferredCountry });
            router.push("/(auth)/language-picker");
          }}
          activeOpacity={0.8}
          style={{
            backgroundColor: selectedRole ? "#1337ec" : "#cbd5e1",
            borderRadius: 12,
            height: 56,
            justifyContent: "center",
            alignItems: "center",
            shadowColor: selectedRole ? "#1337ec" : "transparent",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: selectedRole ? 8 : 0,
            marginBottom: 20
          }}
        >
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff", letterSpacing: 0.5 }}>
            Continue Selection
          </Text>
        </TouchableOpacity>

        {/* Pagination Indicator */}
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }}>
          <View style={{ height: 4, width: 32, borderRadius: 2, backgroundColor: "#1337ec" }} />
          <View style={{ height: 4, width: 32, borderRadius: 2, backgroundColor: "#e2e8f0" }} />
          <View style={{ height: 4, width: 32, borderRadius: 2, backgroundColor: "#e2e8f0" }} />
        </View>
      </View>
    </View>
  );
}
