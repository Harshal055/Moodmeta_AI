import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getLocales } from "expo-localization";
import { useRouter } from "expo-router";
import { useState } from "react";
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

const roles = [
  {
    id: "friend",
    label: "Friend",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCv2y-cN2wc5IoHc8NoVi5GR1XkvrzFpfWcArI3xrVEKeQ71khH-I7EnqdNjLxEgCwNFQEPOyG-S_2-SyHjXbwgmMKFw55LIH5McpKI1Bizuv_S1hSIp5JJl572Yz5w08iq1ovNakyMq3DqbddXL9ZYDJ1ASJjhe26x77GLa76KZxcY96qkn4icJF33e3fuJNV_M6Jn6XVyVe5zJ-_q4N46JCRyu-34sh1qx60XIrHRi-vXr470gHOcjfKW46OZtButaM7UgGWHzzUW"
  },
  {
    id: "boyfriend",
    label: "Boyfriend",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuByqu9MS8Vl3F-Bk31qqfZBqgBvYeuy0z1ttk66pvcsa-C74EKXEmUaH_yk2Qz9hBgeKvG62Pz2bYzoMc0f7I9knc6ZpNrrbyxY1_OVSvbsxmiocarVChEENFSx-N_EaZanA99X6-8h0X8uO4eIf64M_hzmvg3nFd1Y7-fejA1IM8iWAZNBcQ47dKuW8acV03gJUpQTApIxc8T3OOyDSNKbwR5Pj09YS36kqG9AjGddkncHr7HrcdXAnCcw2kdxu3DuG4tyk93kHqsD"
  },
  {
    id: "girlfriend",
    label: "Girlfriend",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuB09DEyjudMCxz2mo5B8pTLYxjOYibrc_QkwuJ2FZP7bGEojgiF1r91qbUyy7orGHh3t7rB3ZieyAkFoN3GsJeVDybExZF_9RWW6XiKN6ReFjmXp02AA9-Z9yTIaYNwHTwXvtTdBYzYViyo4jNc_WsUV44ZU3xLbtZDBE4fksSEB6afaASZ8ItzQLPQswyQpV3LgL4bD56BiwDQKEVEqDsMK7ziYKRYb40nX5F_3JjMylhZqjg4XWeOaJd5tWtgJ5eI4CtqA5Bwa25a"
  },
  {
    id: "mother",
    label: "Mother",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCe1F6kC2yi-WFuN0nwL_9BYc_nFGlWOgM7mQnPJ_MnVLejnXs3ajjZuE-JU11dKhJB21SQgjWNO14yL4PT62_jnAAld7N4sRJeUrjNgvr6aTMBJ4yLEBFT2Pbcpl4NjeVan246FE0OLg83vUdtrZwZRxJ2gMlzq-rET1tOIH4-Vkk6JTEj6GrwUiv6OdJqZY_xdAnmEz_CLga65q3lYumsdMYofiR3Mh1e19BWmd2zWJlGc255Y2InR03HR7NEvuCGgWs21_l1cHUo"
  },
  {
    id: "father",
    label: "Father",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCi0e-puTwqBjXuyX_XpeN9sx4Qdd4_YPi30aJdYnzk5f6UVTjH8OcShR9MDV4NP256EXJiurwjtxat-dBXJFxHZ9zwvqgzoPEun6Y5WBi-ZAAdVUpCjRunYh2-HId-NWcHphrQ6KlcSIlCUC0rHyOlgxXABAcPwbkVObyvl_fLtOsJS-yDHG0c8lPycg4H0PvhDC_qly6tR4lb88HhyxXw9gaPZohIr3YGqnWyGm2gGDxoZbMrRbqeBrVJ2nHnmHdnZQrWp4xHiSJX"
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
                    source={{ uri: role.image }}
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
