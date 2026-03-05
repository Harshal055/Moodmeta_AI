import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { logger } from "../../utils/logger";

export default function LinkAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isLinking, setIsLinking] = useState(false);

  const handleGoogleLink = async () => {
    setIsLinking(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: {
          redirectTo: "moodmateai://",
        },
      });

      if (error) throw error;
    } catch (error: any) {
      logger.error("Link error:", error);
      const message = String(error?.message || "");
      if (message.toLowerCase().includes("cancel")) {
        // user cancelled OAuth flow
      } else if (message.toLowerCase().includes("already")) {
        Alert.alert("Already Linked", "This account is already linked.");
      } else {
        Alert.alert(
          "Linking Failed",
          error?.message || "Could not link account.",
        );
      }
    } finally {
      setIsLinking(false);
    }
  };

  const handleAppleLink = async () => {
    setIsLinking(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "apple",
        options: {
          redirectTo: "moodmateai://",
        },
      });

      if (error) throw error;
    } catch (error: any) {
      logger.error("Apple link error:", error);
      const message = String(error?.message || "");
      if (message.toLowerCase().includes("cancel")) {
        // user cancelled OAuth flow
      } else if (message.toLowerCase().includes("already")) {
        Alert.alert("Already Linked", "This Apple account is already linked.");
      } else {
        Alert.alert(
          "Linking Failed",
          error?.message || "Could not link Apple account.",
        );
      }
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View
        style={{
          paddingTop: insets.top + 20,
          paddingHorizontal: 20,
          paddingBottom: 20,
        }}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-8">
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={28} color="#1a1a2e" />
          </TouchableOpacity>
          <Text
            style={{
              fontFamily: "Manrope_700Bold",
              fontSize: 20,
              color: "#1a1a2e",
            }}
          >
            Save Your Chats
          </Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Imagery & Pitch */}
        <View className="items-center mb-10 mt-6">
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: "#F7F7F8",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <Ionicons name="cloud-done" size={48} color="#1a1a2e" />
          </View>
          <Text
            className="text-center"
            style={{
              fontFamily: "Rosehot",
              fontSize: 26,
              color: "#1a1a2e",
              marginBottom: 12,
            }}
          >
            Never lose your companion.
          </Text>
          <Text
            className="text-center px-4"
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 15,
              color: "#666",
              lineHeight: 22,
            }}
          >
            Right now, you are using a temporary account. If you delete the app
            or get a new phone, your companion and all your chats will be lost
            forever.
            {"\n\n"}Link a permanent account below to save them securely.
          </Text>
        </View>

        {isLinking ? (
          <View className="items-center justify-center py-10">
            <ActivityIndicator size="large" color="#1a1a2e" />
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                marginTop: 16,
                color: "#666",
              }}
            >
              Securely linking...
            </Text>
          </View>
        ) : (
          <View className="space-y-4">
            {/* Apple Button (iOS Only visually prioritised) */}
            {Platform.OS === "ios" && (
              <TouchableOpacity
                onPress={handleAppleLink}
                activeOpacity={0.8}
                className="w-full flex-row items-center justify-center bg-black py-4 rounded-xl mb-3"
              >
                <Ionicons
                  name="logo-apple"
                  size={20}
                  color="#fff"
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 16,
                    color: "#fff",
                  }}
                >
                  Continue with Apple
                </Text>
              </TouchableOpacity>
            )}

            {/* Google Button */}
            <TouchableOpacity
              onPress={handleGoogleLink}
              activeOpacity={0.8}
              className="w-full flex-row items-center justify-center bg-white py-4 rounded-xl border border-gray-300 shadow-sm mb-3"
            >
              <Ionicons
                name="logo-google"
                size={20}
                color="#EA4335"
                style={{ marginRight: 8 }}
              />
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 16,
                  color: "#333",
                }}
              >
                Continue with Google
              </Text>
            </TouchableOpacity>

            {/* Email Button */}
            <TouchableOpacity
              onPress={() => router.push("/(modals)/link-email")}
              activeOpacity={0.8}
              className="w-full flex-row items-center justify-center bg-[#F7F7F8] py-4 rounded-xl border border-[#E8E8EA]"
            >
              <Ionicons
                name="mail"
                size={20}
                color="#1a1a2e"
                style={{ marginRight: 8 }}
              />
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 16,
                  color: "#1a1a2e",
                }}
              >
                Continue with Email
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}
