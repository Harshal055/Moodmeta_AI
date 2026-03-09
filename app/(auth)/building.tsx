import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { logger } from "../../utils/logger";

const COMPANION_AVATARS: Record<string, any> = {
  friend: require("../../assets/images/avatar_friend.png"),
  boyfriend: require("../../assets/images/avatar_boyfriend.png"),
  girlfriend: require("../../assets/images/avatar_girlfriend.png"),
  mother: require("../../assets/images/avatar_mother.png"),
  father: require("../../assets/images/avatar_father.png"),
  default: require("../../assets/images/logo.png"),
};

export default function Building() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const updateProfile = useAuth((s) => s.updateProfile);
  const companionName =
    useAuth((s) => s.profile?.companion_name) || "Companion";

  const profile = useAuth((s) => s.profile);

  useEffect(() => {
    logger.info("SCREEN_VIEW: Building");
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
      // Hydration Guard: Wait for profile to load from Supabase
      if (!profile) return;

      try {
        // Strict Profile Validation
        if (!profile.companion_name || !profile.role || !profile.language) {
          console.error("Profile validation failed: Missing required fields", profile);
          Alert.alert("Setup Incomplete", "We couldn't find your companion details. Let's try setting them up again.");
          router.replace("/(auth)/welcome");
          return;
        }

        // Run the network request and the 5-sec animation timer concurrently
        const [updateSuccess] = await Promise.all([
          updateProfile({ onboarded: true }),
          new Promise((resolve) => setTimeout(resolve, 5000))
        ]);

        if (!updateSuccess) {
          console.error("Supabase failed to update onboarded status.");
          Alert.alert("Connection Error", "Failed to save your profile. Please check your internet and try again.");
          router.replace("/(auth)/welcome");
          return;
        }

        router.replace({
          pathname: "/(main)/chat",
          params: { companionName },
        });
      } catch (e) {
        console.error("Failed to complete onboarding", e);
        Alert.alert("Error", "An unexpected error occurred. Please try again.");
        router.replace("/(auth)/welcome");
      }
    };

    finalizeOnboarding();
  }, [profile]);

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
          {/* Pulsing Avatar */}
          <Animated.View
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              overflow: "hidden",
              marginBottom: 24,
              backgroundColor: "#f0f0f0",
              borderWidth: 2,
              borderColor: "#FF6B9D",
              transform: [{ scale: pulseAnim }],
            }}
          >
            <Image
              source={COMPANION_AVATARS[profile?.role || "default"] || COMPANION_AVATARS.default}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          </Animated.View>

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
