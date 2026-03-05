import { useRouter } from "expo-router";
import { StatusBar, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1" style={{ backgroundColor: "#fff" }}>
      <StatusBar barStyle="dark-content" />

      <View
        style={{ flex: 1, paddingTop: insets.top + 70, paddingHorizontal: 28 }}
      >
        <View className="items-center mb-8">
          <Text style={{ fontSize: 72, marginBottom: 16 }}>❤️</Text>
          <Text
            className="text-center mb-2"
            style={{
              fontFamily: "Rosehot",
              fontSize: 34,
              color: "#1a1a2e",
              lineHeight: 42,
            }}
          >
            Welcome to MoodMateAI
          </Text>
          <Text
            className="text-center"
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 16,
              color: "#777",
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
              fontFamily: "Inter_400Regular",
              fontSize: 15,
              color: "#999",
              lineHeight: 24,
            }}
          >
            Let’s personalize your companion in a few quick steps.
          </Text>
        </View>

        <View style={{ paddingBottom: insets.bottom + 24 }}>
          <TouchableOpacity
            onPress={() => router.push("/(auth)/role-picker")}
            activeOpacity={0.85}
            style={{
              backgroundColor: "#1a1a2e",
              borderRadius: 999,
              paddingVertical: 17,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope_600SemiBold",
                fontSize: 18,
                color: "#fff",
              }}
            >
              Continue
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
