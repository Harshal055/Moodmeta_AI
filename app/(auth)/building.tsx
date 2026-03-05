import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
    Animated,
    Easing,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";

export default function Building() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const updateProfile = useAuth((s) => s.updateProfile);
  const companionName =
    useAuth((s) => s.profile?.companion_name) || "Companion";

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Pulsing heart animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  useEffect(() => {
    const finalizeOnboarding = async () => {
      try {
        await updateProfile({ onboarded: true });
        await new Promise((resolve) => setTimeout(resolve, 5000));
        router.replace({
          pathname: "/(main)/chat",
          params: { companionName },
        });
      } catch (e) {
        console.error("Failed to complete onboarding", e);
      }
    };

    finalizeOnboarding();
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#fff" }}
    >
      <StatusBar barStyle="dark-content" />
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {/* Top heading */}
        <View
          style={{
            paddingTop: insets.top + 60,
            paddingHorizontal: 30,
            alignItems: "center",
          }}
        >
          {/* Pulsing Heart */}
          <Animated.Text
            style={{
              fontSize: 80,
              marginBottom: 24,
              transform: [{ scale: pulseAnim }],
            }}
          >
            💖
          </Animated.Text>

          <Text
            className="text-center"
            style={{
              fontFamily: "Rosehot",
              fontSize: 32,
              color: "#1a1a2e",
              lineHeight: 40,
            }}
          >
            Building Your{"\n"}Companion...
          </Text>
        </View>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Building Animation Text */}
        <View
          style={{ paddingHorizontal: 30, paddingBottom: insets.bottom + 40 }}
        >
          <Text
            className="text-center mb-3"
            style={{
              fontFamily: "Manrope_600SemiBold",
              fontSize: 18,
              color: "#1a1a2e",
              lineHeight: 26,
            }}
          >
            Creating your perfect{"\n"}companion... 🩷
          </Text>
          <Text
            className="text-center mb-6"
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: "rgba(58, 58, 92, 0.6)",
            }}
          >
            Adapting to your city, mood & language
          </Text>

          <View className="flex-row justify-center" style={{ gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "#C9B8F0",
                  opacity: 0.3 + i * 0.25,
                }}
              />
            ))}
          </View>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
