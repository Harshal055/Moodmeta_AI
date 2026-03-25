import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { logger } from "../../utils/logger";

const { width, height } = Dimensions.get("window");

const SLIDES = [
  {
    title: "Find Your\nInner Calm",
    subtitle: "Your AI companion for emotional well-being, mindfulness, and daily mental support.",
    accent: "#6C63FF",
    bgFrom: "#F0EFFF",
    bgTo: "#FAFAFF",
    emoji: "🧘",
  },
  {
    title: "Track Your\nMood & Growth",
    subtitle: "Log emotions daily and uncover insights about your mental patterns over time.",
    accent: "#7C3AED",
    bgFrom: "#F5F0FF",
    bgTo: "#FDFAFF",
    emoji: "📊",
  },
  {
    title: "Never Feel\nAlone Again",
    subtitle: "Your AI friend is always here — ready to listen, support, and guide you forward.",
    accent: "#2563EB",
    bgFrom: "#EEF2FF",
    bgTo: "#F8FAFF",
    emoji: "🤝",
  },
];

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const emojiAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    logger.info("SCREEN_VIEW: Welcome");
    // Float emoji
    Animated.loop(
      Animated.sequence([
        Animated.timing(emojiAnim, { toValue: -10, duration: 1800, useNativeDriver: true }),
        Animated.timing(emojiAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -20, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
        slideAnim.setValue(20);
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();
      });
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const slide = SLIDES[currentSlide];

  return (
    <View style={{ flex: 1, backgroundColor: slide.bgFrom }}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Background gradient blob */}
      <View
        style={{
          position: "absolute",
          top: -height * 0.1,
          right: -width * 0.2,
          width: width * 0.8,
          height: width * 0.8,
          borderRadius: width * 0.4,
          backgroundColor: slide.accent + "18",
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: height * 0.2,
          left: -width * 0.15,
          width: width * 0.6,
          height: width * 0.6,
          borderRadius: width * 0.3,
          backgroundColor: slide.accent + "12",
        }}
      />

      <View style={{ flex: 1, paddingTop: insets.top + 20, paddingHorizontal: 28 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Image
              source={require("../../assets/images/logo.png")}
              style={{ width: 32, height: 32 }}
              resizeMode="contain"
            />
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 17, color: "#1a1a2e" }}>MoodMateAI</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/(auth)/role-picker")} style={{ paddingVertical: 4, paddingHorizontal: 8 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: slide.accent }}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Emoji hero */}
        <View style={{ alignItems: "center", marginTop: 24, marginBottom: 20 }}>
          <Animated.View
            style={{
              transform: [{ translateY: emojiAnim }],
              width: width * 0.72,
              height: width * 0.72,
              borderRadius: 32,
              backgroundColor: "#fff",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: slide.accent,
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.12,
              shadowRadius: 32,
              elevation: 8,
              borderWidth: 1,
              borderColor: slide.accent + "20",
            }}
          >
            <Text style={{ fontSize: 100 }}>{slide.emoji}</Text>
          </Animated.View>
        </View>

        {/* Slide text */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            alignItems: "center",
            paddingHorizontal: 8,
            flex: 1,
          }}
        >
          <Text
            style={{
              fontFamily: "Rosehot",
              fontSize: 38,
              color: "#0f172a",
              letterSpacing: -1,
              lineHeight: 46,
              textAlign: "center",
              marginBottom: 14,
            }}
          >
            {slide.title}
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 16,
              color: "#64748b",
              lineHeight: 26,
              textAlign: "center",
            }}
          >
            {slide.subtitle}
          </Text>
        </Animated.View>

        {/* Dots */}
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 28 }}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === currentSlide ? 20 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === currentSlide ? slide.accent : "#CBD5E1",
              }}
            />
          ))}
        </View>

        {/* Buttons */}
        <View style={{ paddingBottom: insets.bottom + 24, gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.push("/(auth)/mood-selection" as any)}
            activeOpacity={0.85}
            style={{
              backgroundColor: slide.accent,
              borderRadius: 16,
              paddingVertical: 18,
              alignItems: "center",
              shadowColor: slide.accent,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 12,
              elevation: 6,
            }}
          >
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 17, color: "#fff", letterSpacing: 0.3 }}>
              Get Started →
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={async () => {
              if (isLoadingGoogle) return;
              setIsLoadingGoogle(true);
              try {
                await useAuth.getState().signInWithGoogle();
                const { onboarded } = useAuth.getState();
                if (onboarded) {
                  router.replace("/(main)/chat");
                } else {
                  router.replace("/(auth)/mood-selection" as any);
                }
              } catch (e) {
                // Error handled in store
              } finally {
                setIsLoadingGoogle(false);
              }
            }}
            activeOpacity={0.8}
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: "center",
              borderWidth: 1.5,
              borderColor: "#E2E8F0",
              flexDirection: "row",
              justifyContent: "center",
              gap: 12,
              opacity: isLoadingGoogle ? 0.7 : 1,
            }}
          >
            {isLoadingGoogle ? (
              <ActivityIndicator color="#334155" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#EA4335" />
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#334155" }}>
                  Continue with Google
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/login")}
            activeOpacity={0.7}
            style={{ paddingVertical: 10, alignItems: "center" }}
          >
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#64748b" }}>
              Already a member?{" "}
              <Text style={{ color: slide.accent, fontFamily: "Inter_700Bold" }}>Log In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
