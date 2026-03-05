import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Easing, StatusBar, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function UpgradeSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Scale-in animation for crown
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-redirect after 3 seconds
    const timer = setTimeout(() => {
      router.replace("/(main)/chat");
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View className="flex-1" style={{ backgroundColor: "#fff" }}>
      <StatusBar barStyle="dark-content" />

      <View className="flex-1 justify-center items-center px-6">
        {/* Animated Crown */}
        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
            marginBottom: 32,
          }}
        >
          <Text style={{ fontSize: 120 }}>👑</Text>
        </Animated.View>

        {/* Success Text */}
        <Text
          className="text-center mb-3"
          style={{
            fontFamily: "Rosehot",
            fontSize: 36,
            color: "#1a1a2e",
            lineHeight: 42,
          }}
        >
          You're Now{"\n"}Premium! ✨
        </Text>

        <Text
          className="text-center"
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 18,
            color: "#D97706",
            marginBottom: 16,
          }}
        >
          ❤️ Unlimited Chats Unlocked
        </Text>

        <Text
          className="text-center"
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 15,
            color: "#666",
            lineHeight: 22,
          }}
        >
          No more limits. Chat as much as you want with your{"\n"}perfect
          companion. Enjoy every moment! 💬
        </Text>

        {/* Features */}
        <View style={{ marginTop: 40, width: "100%" }}>
          {[
            { icon: "♾️", text: "Unlimited messages" },
            { icon: "💾", text: "Cloud chat backup" },
            { icon: "⭐", text: "No promotional nudges" },
          ].map((feature, i) => (
            <View
              key={i}
              className="flex-row items-center mb-4"
              style={{ gap: 12 }}
            >
              <Text style={{ fontSize: 24 }}>{feature.icon}</Text>
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 15,
                  color: "#1a1a2e",
                }}
              >
                {feature.text}
              </Text>
            </View>
          ))}
        </View>

        {/* Loading Message */}
        <View style={{ marginTop: 60, alignItems: "center" }}>
          <Text
            className="text-center"
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              color: "#999",
            }}
          >
            Returning to chat...
          </Text>
        </View>
      </View>
    </View>
  );
}
