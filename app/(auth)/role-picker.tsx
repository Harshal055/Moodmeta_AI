import { getLocales } from "expo-localization";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    ScrollView,
    StatusBar,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";

const roles = [
  { id: "friend", label: "Friend", icon: "😌" },
  { id: "boyfriend", label: "Boyfriend", icon: "💑" },
  { id: "girlfriend", label: "Girlfriend", icon: "👧" },
  { id: "mother", label: "Mother", icon: "🥰" },
  { id: "father", label: "Father", icon: "👨‍👧" },
  { id: "custom", label: "Custom", icon: "✨" },
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

  return (
    <View className="flex-1" style={{ backgroundColor: "#fff" }}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={{
            paddingTop: insets.top + 40,
            paddingHorizontal: 24,
            paddingBottom: 24,
          }}
        >
          <Text
            className="text-center mb-2"
            style={{
              fontFamily: "Rosehot",
              fontSize: 28,
              color: "#1a1a2e",
              lineHeight: 36,
            }}
          >
            Who do you need{"\n"}with you today? 😍
          </Text>
          <Text
            className="text-center"
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 15,
              color: "#999",
            }}
          >
            Choose your perfect companion
          </Text>
        </View>

        {/* Role Cards */}
        <View className="flex-row flex-wrap justify-between px-5">
          {roles.map((role) => {
            const isSelected = selectedRole === role.id;
            return (
              <TouchableOpacity
                key={role.id}
                onPress={() => setSelectedRole(role.id)}
                activeOpacity={0.8}
                className="w-[48%] mb-3"
              >
                <View
                  style={{
                    backgroundColor: isSelected ? "#f0f0f0" : "#F7F7F8",
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected ? "#1a1a2e" : "#EEEEEF",
                    borderRadius: 18,
                    paddingVertical: 24,
                    paddingHorizontal: 14,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>
                    {role.icon}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Manrope_600SemiBold",
                      fontSize: 16,
                      color: "#1a1a2e",
                    }}
                  >
                    {role.label}
                  </Text>
                  {isSelected && (
                    <View
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: "#1a1a2e",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 12, color: "#fff" }}>✓</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Continue button */}
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
        }}
      >
        <TouchableOpacity
          disabled={!selectedRole}
          onPress={async () => {
            if (!selectedRole) return;

            const locale = getLocales()[0];
            const regionCode = locale?.regionCode?.toUpperCase?.() || "";
            const inferredCountry = REGION_TO_COUNTRY[regionCode] || "India";

            await updateProfile({
              role: selectedRole,
              country: inferredCountry,
            });
            router.push("/(auth)/language-picker");
          }}
          activeOpacity={0.85}
          style={{
            backgroundColor: selectedRole ? "#1a1a2e" : "#E8E8EA",
            borderRadius: 999,
            paddingVertical: 18,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope_600SemiBold",
              fontSize: 18,
              color: selectedRole ? "#fff" : "#aaa",
            }}
          >
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
