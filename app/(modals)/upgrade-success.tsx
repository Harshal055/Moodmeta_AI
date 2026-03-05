import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
    Animated,
    Easing,
    StatusBar,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { logger } from "../utils/logger";
import { requestReviewPostPurchase } from "../utils/purchaseUtils";

export default function UpgradeSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Scale-in animation for crown with staggered sequence
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 40,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(slideUpAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Request review after purchase (delayed for better UX)
    const reviewTimer = setTimeout(() => {
      requestReviewPostPurchase(500).catch((error) => {
        logger.error("Error during review prompt:", error);
      });
    }, 2000);

    // Auto-redirect after 4 seconds
    const redirectTimer = setTimeout(() => {
      router.replace("/(main)/chat");
    }, 4000);

    return () => {
      clearTimeout(reviewTimer);
      clearTimeout(redirectTimer);
    };
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
        <Animated.Text
          style={{
            transform: [{ translateY: slideUpAnim }],
            opacity: opacityAnim,
          }}
          className="text-center mb-3"
          style={{
            fontFamily: "Rosehot",
            fontSize: 36,
            color: "#1a1a2e",
            lineHeight: 42,
          }}
        >
          You're Now{"\n"}Premium! ✨
        </Animated.Text>

        <Animated.Text
          style={{
            transform: [{ translateY: slideUpAnim }],
            opacity: opacityAnim,
          }}
          className="text-center"
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 18,
            color: "#D97706",
            marginBottom: 16,
          }}
        >
          ❤️ Unlimited Chats Unlocked
        </Animated.Text>

        <Animated.Text
          style={{
            transform: [{ translateY: slideUpAnim }],
            opacity: opacityAnim,
          }}
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
        </Animated.Text>

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

        {/* Continue Button */}
        <TouchableOpacity
          onPress={() => router.replace("/(main)/chat")}
          className="w-full bg-black py-4 rounded-full items-center justify-center mt-12 mb-4"
        >
          <Text
            style={{
              fontFamily: "Manrope_700Bold",
              fontSize: 15,
              color: "#fff",
            }}
          >
            Start Chatting Now
          </Text>
        </TouchableOpacity>

        {/* Auto-Redirect Message */}
        <Text
          className="text-center"
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 12,
            color: "#999",
          }}
        >
          Redirecting in 4 seconds...
        </Text>
      </View>
    </View>
  );
}
