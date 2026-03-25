import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
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

const { width } = Dimensions.get("window");
const ACCENT = "#1337ec";

const FEATURES = [
  {
    icon: "sparkles",
    title: "Smart Automation",
    desc: "AI-driven workflows for efficiency",
    bgColor: "#EEF2FF",
    iconColor: "#4F46E5",
  },
  {
    icon: "shield-checkmark",
    title: "Secure Sync",
    desc: "End-to-end encrypted data handling",
    bgColor: "#F5F3FF",
    iconColor: "#4338CA",
  },
  {
    icon: "analytics",
    title: "Real-time Analytics",
    desc: "Initializing data streams...",
    bgColor: "#F8FAFC",
    iconColor: "#94A3B8",
  },
];

const STATUS_TEXTS = [
  "Connecting to secure servers...",
  "Loading language models...",
  "Personalizing your workspace...",
  "Initializing data streams...",
  "Finalizing setup...",
];

export default function Building() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const updateProfile = useAuth((s) => s.updateProfile);
  const companionName = useAuth((s) => s.profile?.companion_name) || "Companion";
  const profile = useAuth((s) => s.profile);

  useEffect(() => {
    logger.info("SCREEN_VIEW: Building");

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Setup Progress Animation over ~4.5 seconds
    Animated.timing(progressAnim, {
      toValue: 100,
      duration: 4500,
      useNativeDriver: false, // width animation doesn't support native driver
    }).start();

    // Listen to progress to update percentage text
    progressAnim.addListener(({ value }) => {
      setProgress(Math.floor(value));
      // Update status text based on progress brackets
      if (value > 80) setStatusIndex(4);
      else if (value > 60) setStatusIndex(3);
      else if (value > 40) setStatusIndex(2);
      else if (value > 20) setStatusIndex(1);
    });

    return () => progressAnim.removeAllListeners();
  }, []);

  const finalizingRef = useRef(false);

  useEffect(() => {
    const finalizeOnboarding = async () => {
      if (!profile || finalizingRef.current) return;

      finalizingRef.current = true;
      try {
        if (!profile.companion_name || !profile.role || !profile.language) {
          console.error("Profile validation failed: Missing required fields", profile);
          Alert.alert("Setup Incomplete", "We couldn't find your companion details. Let's try setting them up again.");
          router.replace("/(auth)/welcome");
          return;
        }

        const [updateSuccess] = await Promise.all([
          updateProfile({ onboarded: true }),
          new Promise((resolve) => setTimeout(resolve, 5000)), // 5s ensures progress bar fills
        ]);

        if (!updateSuccess) {
          console.error("Supabase failed to update onboarded status.");
          Alert.alert("Connection Error", "Failed to save your profile. Please check your internet and try again.");
          router.replace("/(auth)/welcome");
          return;
        }

        // Force clear the auth navigation stack before replacing
        if (router.canDismiss()) {
            router.dismissAll();
        }
        router.replace("/(main)/dashboard");
      } catch (e) {
        console.error("Failed to complete onboarding", e);
        Alert.alert("Error", "An unexpected error occurred. Please try again.");
        router.replace("/(auth)/welcome");
      }
    };

    finalizeOnboarding();
  }, [profile]);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <Animated.ScrollView
        style={{ flex: 1, opacity: fadeAnim }}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 16, flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 48, height: 48, justifyContent: "center" }}>
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: "center", paddingRight: 48, fontFamily: "Inter_700Bold", fontSize: 17, color: "#1a1a2e" }}>
            How It Works
          </Text>
        </View>

        <View style={{ paddingHorizontal: 24 }}>
          {/* Header Image replacing old avatar */}
          <View
            style={{
              width: "100%",
              height: 200,
              backgroundColor: "#E2E8F0",
              borderRadius: 20,
              marginBottom: 32,
              justifyContent: "center",
              alignItems: "center",
              overflow: "hidden",
            }}
          >
            {/* Using a placeholder gradient/icon setup as we don't have the exact bar chart asset */}
            <View style={{ width: "100%", height: "100%", backgroundColor: "#CBD5E1", flex: 1, justifyContent: 'flex-end', flexDirection: 'row', alignItems: 'flex-end', padding: 20, gap: 4 }}>
                {Array.from({length: 30}).map((_, i) => (
                    <View key={i} style={{ width: (width - 88) / 30 - 4, height: Math.max(10, Math.random() * 100 + (i * 4)), backgroundColor: "#3B82F6", borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
                ))}
            </View>
          </View>

          <Text style={{ fontFamily: "Rosehot", fontSize: 32, color: "#0f172a", marginBottom: 20, letterSpacing: -0.5, lineHeight: 40 }}>
            Building your experience
          </Text>

          {/* Progress Bar Area */}
          <View style={{ marginBottom: 32 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8, alignItems: "flex-end" }}>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: "#475569" }}>
                Setting up features...
              </Text>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: ACCENT }}>
                {progress}%
              </Text>
            </View>

            <View style={{ height: 8, backgroundColor: "#F1F5F9", borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
              <Animated.View
                style={{
                  height: "100%",
                  backgroundColor: ACCENT,
                  borderRadius: 4,
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ["0%", "100%"]
                  })
                }}
              />
            </View>

            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#94A3B8", fontStyle: "italic", textAlign: "center" }}>
              {STATUS_TEXTS[statusIndex]}
            </Text>
          </View>

          {/* Features List */}
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: "#0f172a", marginBottom: 16 }}>
            Key Features
          </Text>

          <View style={{ gap: 12 }}>
            {FEATURES.map((feature, idx) => (
              <View
                key={idx}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 16,
                  backgroundColor: "#fff",
                  borderWidth: 1,
                  borderColor: "#F1F5F9",
                  borderRadius: 16,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: feature.bgColor,
                    justifyContent: "center",
                    alignItems: "center",
                    marginRight: 16,
                  }}
                >
                  <Ionicons name={feature.icon as any} size={22} color={feature.iconColor} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#0f172a", marginBottom: 4 }}>
                    {feature.title}
                  </Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#64748b" }}>
                    {feature.desc}
                  </Text>
                </View>
              </View>
            ))}
          </View>

        </View>
      </Animated.ScrollView>
    </View>
  );
}
