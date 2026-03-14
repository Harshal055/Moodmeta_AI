import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";

const countriesList = [
  { id: "India", label: "India", code: "🇮🇳" },
  { id: "USA", label: "United States", code: "🇺🇸" },
  { id: "UK", label: "United Kingdom", code: "🇬🇧" },
  { id: "Canada", label: "Canada", code: "🇨🇦" },
  { id: "Australia", label: "Australia", code: "🇦🇺" },
  { id: "UAE", label: "UAE", code: "🇦🇪" },
  { id: "Germany", label: "Germany", code: "🇩🇪" },
  { id: "France", label: "France", code: "🇫🇷" },
  { id: "Singapore", label: "Singapore", code: "🇸🇬" },
];

export default function CountryPicker() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const updateProfile = useAuth((s) => s.updateProfile);
  const savedCountry = useAuth((s) => s.country);

  const [selectedCountry, setSelectedCountry] = useState(
    savedCountry || "India",
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleContinue = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await updateProfile({ country: selectedCountry });
      router.push("/(auth)/language-picker");
    } catch (e) {
      console.error("Failed to save country", e);
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#fff" }}
    >
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <View className="px-5 pt-8 pb-5">
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(auth)/role-picker");
              }
            }}
            className="mb-5 w-10"
          >
            <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
          </TouchableOpacity>

          <Text
            style={{
              fontFamily: "Rosehot",
              fontSize: 32,
              color: "#1a1a2e",
              marginBottom: 8,
            }}
          >
            Pick your country 📍
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 15,
              color: "#666",
            }}
          >
            We use this to personalize conversation context.
          </Text>
        </View>

        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
        >
          {countriesList.map((country) => {
            const isSelected = selectedCountry === country.id;
            return (
              <TouchableOpacity
                key={country.id}
                onPress={() => setSelectedCountry(country.id)}
                activeOpacity={0.7}
                className={`flex-row items-center justify-between p-4 mb-3 rounded-xl border ${isSelected ? "border-[#1a1a2e] bg-[#FAFAFA]" : "border-[#F0F0F0] bg-white"}`}
              >
                <View className="flex-row items-center">
                  <Text style={{ fontSize: 24, marginRight: 12 }}>
                    {country.code}
                  </Text>
                  <Text
                    style={{
                      fontFamily: isSelected
                        ? "Inter_500Medium"
                        : "Inter_500Medium",
                      fontSize: 16,
                      color: "#1a1a2e",
                    }}
                  >
                    {country.label}
                  </Text>
                </View>

                {isSelected && (
                  <View className="w-5 h-5 rounded-full bg-[#1a1a2e] items-center justify-center">
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 100 }} />
        </ScrollView>

        <View
          className="absolute bottom-0 w-full px-5 py-4 bg-white border-t border-gray-100"
          style={{ paddingBottom: Math.max(insets.bottom, 20) }}
        >
          <TouchableOpacity
            onPress={handleContinue}
            disabled={isSaving}
            className="w-full bg-[#1a1a2e] py-4 rounded-full items-center justify-center flex-row shadow-sm"
          >
            <Text
              style={{
                fontFamily: "Manrope_700Bold",
                fontSize: 16,
                color: "#fff",
                marginRight: 8,
              }}
            >
              {isSaving ? "Saving..." : "Continue"}
            </Text>
            {!isSaving && (
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
