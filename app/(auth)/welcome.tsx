import { useRouter } from "expo-router";
import { StatusBar, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1" style={{ backgroundColor: "#f6f6f8" }}>
      <StatusBar barStyle="dark-content" />

      <View
        style={{ flex: 1, paddingTop: insets.top + 70, paddingHorizontal: 28 }}
      >
        <View className="items-center mb-8">
          <Text style={{ fontSize: 72, marginBottom: 16 }}>✨</Text>
          <Text
            className="text-center mb-2"
            style={{
              fontFamily: "Inter_800ExtraBold",
              fontSize: 34,
              color: "#0f172a",
              lineHeight: 42,
              letterSpacing: -1,
            }}
          >
            MoodMateAI
          </Text>
          <Text
            className="text-center"
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 16,
              color: "#64748b",
              lineHeight: 24,
            }}
          >
            Your emotional AI companion for every day.
          </Text>
        </View>

        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text
            className="text-center"
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 15,
              color: "#94a3b8",
              lineHeight: 24,
            }}
          >
            Let's personalize your companion in a few quick steps.
          </Text>
        </View>

        <View style={{ paddingBottom: insets.bottom + 24 }}>
          <TouchableOpacity
            onPress={() => router.push("/(auth)/role-picker")}
            activeOpacity={0.8}
            style={{
              backgroundColor: "#1337ec",
              borderRadius: 12,
              paddingVertical: 18,
              alignItems: "center",
              marginBottom: 16,
              shadowColor: "#1337ec",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_700Bold",
                fontSize: 18,
                color: "#fff",
                letterSpacing: 0.5,
              }}
            >
              Get Started
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/login")}
            activeOpacity={0.7}
            style={{
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 15,
                color: "#64748b",
              }}
            >
              Already a member? <Text style={{ color: "#1337ec", fontFamily: "Inter_700Bold" }}>Log In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
