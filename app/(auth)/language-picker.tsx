import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";

const languages = [
  { id: "English", label: "English", desc: "Standard conversational English" },
  { id: "Hindi", label: "Hindi", desc: "Native Hindi chat" },
  {
    id: "Hinglish",
    label: "Hinglish",
    desc: "Mixed Hindi + English (Very Natural)",
  },
  { id: "Other", label: "Other", desc: "Type your own language" },
];

// Removed getDefaultCompanionName logic as name selection is moved to NameCompanion screen

export default function LanguagePicker() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const updateProfile = useAuth((s) => s.updateProfile);
  const savedLanguage = useAuth((s) => s.language);
  const savedCompanionName = useAuth((s) => s.profile?.companion_name) || "";
  const selectedRole = useAuth((s) => s.role);

  const isCommon = ["English", "Hindi", "Hinglish"].includes(
    savedLanguage || "",
  );
  const [selectedLanguage, setSelectedLanguage] = useState(
    isCommon ? savedLanguage || "Hinglish" : "Other",
  );
  const [customLanguage, setCustomLanguage] = useState(
    isCommon ? "" : savedLanguage || "",
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleNext = async () => {
    setIsSaving(true);
    try {
      const finalLang =
        selectedLanguage === "Other"
          ? customLanguage.trim() || "Other"
          : selectedLanguage;

      await updateProfile({ language: finalLang });
      if (useAuth.getState().onboarded) {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/(main)/settings");
        }
      } else {
        router.push("/(auth)/name-companion");
      }
    } catch (e) {
      console.error("Failed to save language", e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#fff" }}
    >
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20 }}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(auth)/role-picker");
              }
            }}
            style={{ width: 40, marginBottom: 20 }}
          >
            <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
          </TouchableOpacity>

          <Text
            style={{
              fontFamily: "Rosehot",
              fontSize: 36,
              color: "#1a1a2e",
              lineHeight: 44,
              marginBottom: 12,
            }}
          >
            How should they{"\n"}speak? 💬
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 16,
              color: "#64748b",
              lineHeight: 24,
            }}
          >
            Choose the primary language for your companion.
          </Text>
        </View>

        {/* Content */}
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {languages.map((lang) => {
            const isSelected = selectedLanguage === lang.id;

            return (
              <View key={lang.id} style={{ marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={() => setSelectedLanguage(lang.id)}
                  activeOpacity={0.7}
                  style={{
                    padding: 18,
                    borderRadius: 12,
                    borderWidth: isSelected ? 1.5 : 1.5,
                    borderColor: isSelected ? "#0f172a" : "transparent",
                    backgroundColor: isSelected ? "#fff" : "#F8FAFC",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 16 }}>
                    <Text
                      style={{
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 16,
                        color: "#0f172a",
                        marginBottom: 4,
                      }}
                    >
                      {lang.label}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 13,
                        color: "#64748b",
                      }}
                    >
                      {lang.desc}
                    </Text>
                  </View>

                  {/* Radio Button */}
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: isSelected ? "#0f172a" : "#CBD5E1",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#fff",
                    }}
                  >
                    {isSelected && (
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: "#0f172a",
                        }}
                      />
                    )}
                  </View>
                </TouchableOpacity>

                {/* Custom text input for Other */}
                {lang.id === "Other" && isSelected && (
                  <View style={{ marginTop: 8 }}>
                    <TextInput
                      value={customLanguage}
                      onChangeText={setCustomLanguage}
                      placeholder="E.g. Spanish, French, Marathi..."
                      placeholderTextColor="#94A3B8"
                      returnKeyType="done"
                      style={{
                        backgroundColor: "#F8FAFC",
                        borderWidth: 1,
                        borderColor: "#E2E8F0",
                        borderRadius: 12,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        fontSize: 15,
                        fontFamily: "Inter_500Medium",
                        color: "#0f172a",
                      }}
                    />
                  </View>
                )}
              </View>
            );
          })}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Footer */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 24,
            paddingVertical: 16,
            paddingBottom: Math.max(insets.bottom, 16),
            backgroundColor: "#fff",
            borderTopWidth: 1,
            borderColor: "#F1F5F9",
          }}
        >
          <TouchableOpacity
            onPress={handleNext}
            disabled={isSaving}
            style={{
              backgroundColor: "#1e1b4b", // Dark navy almost black
              paddingVertical: 16,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              shadowColor: "#1e1b4b",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_700Bold",
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
