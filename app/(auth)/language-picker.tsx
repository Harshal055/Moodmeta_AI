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

function getDefaultCompanionName(role: string | null): string {
  switch (role) {
    case "boyfriend": {
      const names = ["Ryan", "Alex", "Kai", "Ethan", "Noah"];
      return names[Math.floor(Math.random() * names.length)];
    }
    case "girlfriend": {
      const names = ["Maya", "Luna", "Aria", "Zara", "Sophie"];
      return names[Math.floor(Math.random() * names.length)];
    }
    case "mother": {
      const names = ["Mom", "Mummy", "Mama"];
      return names[Math.floor(Math.random() * names.length)];
    }
    case "father": {
      const names = ["Dad", "Papa", "Daddy"];
      return names[Math.floor(Math.random() * names.length)];
    }
    case "friend": {
      const names = ["Sam", "Jamie", "Taylor", "Jordan"];
      return names[Math.floor(Math.random() * names.length)];
    }
    default:
      return "Companion";
  }
}

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
  const [companionName, setCompanionName] = useState(savedCompanionName);
  const [isSaving, setIsSaving] = useState(false);

  const handleNext = async () => {
    setIsSaving(true);
    try {
      const finalLang =
        selectedLanguage === "Other"
          ? customLanguage.trim() || "Other"
          : selectedLanguage;

      if (selectedRole === "custom" && !companionName.trim()) {
        Alert.alert(
          "Name Required",
          "Please enter a name for your custom companion.",
        );
        setIsSaving(false);
        return;
      }

      const finalName =
        companionName.trim() || getDefaultCompanionName(selectedRole);

      await updateProfile({ language: finalLang, companion_name: finalName });
      router.push({
        pathname: "/(auth)/building",
        params: { companionName: finalName },
      });
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
        <View className="px-5 pt-8 pb-6">
          <TouchableOpacity onPress={() => router.back()} className="mb-6 w-10">
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
            How should they speak? 💬
          </Text>
          <Text
            style={{ fontFamily: "Inter_400Regular", fontSize: 16, color: "#666" }}
          >
            Choose the primary language for your companion.
          </Text>
        </View>

        {/* Content */}
        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
        >
          {languages.map((lang) => {
            const isSelected = selectedLanguage === lang.id;

            return (
              <View key={lang.id} className="mb-4">
                <TouchableOpacity
                  onPress={() => setSelectedLanguage(lang.id)}
                  activeOpacity={0.7}
                  className={`p-5 rounded-xl border-2 ${isSelected
                    ? "border-[#1a1a2e] bg-[#FAFAFA]"
                    : "border-transparent bg-[#F7F7F8]"
                    }`}
                >
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text
                        style={{
                          fontFamily: isSelected
                            ? "Inter_500Medium"
                            : "Inter_500Medium",
                          fontSize: 18,
                          color: "#1a1a2e",
                          marginBottom: 4,
                        }}
                      >
                        {lang.label}
                      </Text>
                      <Text
                        style={{
                          fontFamily: "Inter_400Regular",
                          fontSize: 14,
                          color: isSelected ? "#444" : "#888",
                        }}
                      >
                        {lang.desc}
                      </Text>
                    </View>

                    {/* Custom Radio Button */}
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: isSelected ? "#1a1a2e" : "#ccc",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isSelected && (
                        <View
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: "#1a1a2e",
                          }}
                        />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Custom text input for Other */}
                {lang.id === "Other" && isSelected && (
                  <View className="mt-3 px-1">
                    <TextInput
                      value={customLanguage}
                      onChangeText={setCustomLanguage}
                      placeholder="E.g. Spanish, French, Marathi..."
                      placeholderTextColor="#999"
                      returnKeyType="done"
                      className="bg-[#F7F7F8] border border-[#E8E8EA] rounded-xl px-4 py-4 text-[16px]"
                      style={{ fontFamily: "Inter_500Medium", color: "#1a1a2e" }}
                    />
                  </View>
                )}
              </View>
            );
          })}
          <View className="bg-[#F7F7F8] border border-[#E8E8EA] rounded-xl p-4 mt-2 mb-2">
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 13,
                color: "#1a1a2e",
                marginBottom: 8,
              }}
            >
              Companion Name {selectedRole === "custom" ? "*" : "(optional)"}
            </Text>
            <TextInput
              value={companionName}
              onChangeText={setCompanionName}
              placeholder="e.g. Maya, Luna, Kai..."
              placeholderTextColor="#999"
              maxLength={20}
              className="bg-white border border-[#E8E8EA] rounded-xl px-4 py-4 text-[16px]"
              style={{ fontFamily: "Inter_500Medium", color: "#1a1a2e" }}
            />
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                color: "#888",
                marginTop: 8,
              }}
            >
              Leave blank to auto-generate a name.
            </Text>
          </View>

          <View style={{ height: 140 }} />
        </ScrollView>

        {/* Footer fixed */}
        <View
          className="absolute bottom-0 w-full px-5 py-4 bg-white border-t border-gray-100"
          style={{ paddingBottom: Math.max(insets.bottom, 20) }}
        >
          <TouchableOpacity
            onPress={handleNext}
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
