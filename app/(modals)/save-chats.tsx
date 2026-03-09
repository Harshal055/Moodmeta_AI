import { useRouter } from "expo-router";
import { Image, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";

export default function SaveChats() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.currentUser);
  const isAnonymous = user?.is_anonymous ?? true;

  return (
    <View
      className="flex-1 justify-end"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
    >
      <StatusBar barStyle="light-content" />
      <View
        style={{
          backgroundColor: "#fff",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: 24,
          paddingTop: 14,
          paddingBottom: insets.bottom + 20,
        }}
      >
        {/* Handle */}
        <View
          className="self-center mb-8"
          style={{
            width: 48,
            height: 5,
            borderRadius: 3,
            backgroundColor: "#E8E8EA",
          }}
        />

        {/* Icon */}
        <View className="items-center mb-6">
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: "#F7F7F8",
              borderWidth: 1,
              borderColor: "#EEEEEF",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <Image
              source={require("../../assets/images/logo.png")}
              style={{ width: 50, height: 50 }}
              resizeMode="contain"
            />
          </View>
          <Text
            className="text-center mb-3"
            style={{
              fontFamily: "Rosehot",
              fontSize: 24,
              color: "#1a1a2e",
            }}
          >
            Save this conversation?
          </Text>
          <Text
            className="text-center px-4"
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 15,
              lineHeight: 22,
              color: "#999",
            }}
          >
            You can continue this chat later from exactly where you left off.
          </Text>
        </View>

        {/* Buttons */}
        <View style={{ gap: 12 }}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              // If the user is anonymous, prompt them to link a
              // permanent account so their chats survive app deletion.
              // If already linked, just dismiss — their chats are safe.
              router.back();
              if (isAnonymous) {
                setTimeout(() => router.push("/(modals)/link-account"), 300);
              }
            }}
            style={{
              backgroundColor: "#1a1a2e",
              borderRadius: 999,
              paddingVertical: 16,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope_600SemiBold",
                fontSize: 17,
                color: "#fff",
              }}
            >
              {isAnonymous ? "Link Account & Save" : "Already Saved ✓"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.back()}
            style={{
              backgroundColor: "#F5F5F5",
              borderRadius: 999,
              paddingVertical: 16,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope_600SemiBold",
                fontSize: 17,
                color: "#999",
              }}
            >
              Not Now
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
