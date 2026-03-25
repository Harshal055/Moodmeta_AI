import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
  Alert
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { logger } from "../../utils/logger";

const { width } = Dimensions.get("window");

const MOODS = [
  { id: 5, emoji: "😁", label: "Amazing", color: "#FEF3C7", iconColor: "#D97706" },
  { id: 4, emoji: "🙂", label: "Good", color: "#DCFCE7", iconColor: "#16A34A" },
  { id: 3, emoji: "😐", label: "Neutral", color: "#DBEAFE", iconColor: "#2563EB" },
  { id: 2, emoji: "😞", label: "Low", color: "#FFEDD5", iconColor: "#EA580C" },
  { id: 1, emoji: "😢", label: "Awful", color: "#FCE7F3", iconColor: "#DB2777" },
];

export default function MoodSelection() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.currentUser);

  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    logger.info("SCREEN_VIEW: MoodSelection (Onboarding)");
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleContinue = async () => {
    if (!selectedMood) return;

    // Optional: Log the mood immediately if user is signed in (even anonymously)
    if (user) {
      setIsSubmitting(true);
      try {
        const { error } = await supabase
          .from("mood_logs")
          .insert({ user_id: user.id, mood_score: selectedMood });

        if (error) {
           logger.warn("Failed to log initial onboarding mood:", error.message);
        }
      } catch (err) {
        logger.error("Error logging initial mood:", err);
      } finally {
        setIsSubmitting(false);
      }
    }

    // Proceed to the next step
    router.push("/(auth)/role-picker");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <Animated.ScrollView
        style={{ flex: 1, opacity: fadeAnim }}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 16, flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 48, height: 48, justifyContent: "center" }}>
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: "center", paddingRight: 48, fontFamily: "Inter_700Bold", fontSize: 17, color: "#1a1a2e" }}>
            MoodMateAI
          </Text>
        </View>

        <View style={{ paddingHorizontal: 24, flex: 1 }}>
          {/* Progress Indicator */}
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#64748B", marginBottom: 8 }}>
            Step 1 of 5
          </Text>
          <View style={{ height: 6, backgroundColor: "#E2E8F0", borderRadius: 3, marginBottom: 32, overflow: "hidden" }}>
            <View style={{ height: "100%", width: "20%", backgroundColor: "#312E81", borderRadius: 3 }} />
          </View>

          {/* Title Area */}
          <Text
            style={{
              fontFamily: "Rosehot",
              fontSize: 32,
              color: "#1a1a2e",
              textAlign: "center",
              marginBottom: 12,
              lineHeight: 40,
              letterSpacing: -0.5,
            }}
          >
            How are you feeling?
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: "#64748B",
              textAlign: "center",
              marginBottom: 32,
              paddingHorizontal: 24,
              lineHeight: 22,
            }}
          >
            Select the mood that best matches your current state.
          </Text>

          {/* Mood Grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 16 }}>
            {MOODS.map((mood, index) => {
              const isLastOdd = index === MOODS.length - 1 && MOODS.length % 2 !== 0;
              const cardWidth = isLastOdd ? "100%" : "47%";
              const isSelected = selectedMood === mood.id;

              return (
                <TouchableOpacity
                  key={mood.id}
                  onPress={() => setSelectedMood(mood.id)}
                  activeOpacity={0.8}
                  style={{
                    width: cardWidth as any,
                    backgroundColor: "#fff",
                    borderRadius: 16,
                    paddingVertical: 24,
                    alignItems: "center",
                    borderWidth: 2,
                    borderColor: isSelected ? "#312E81" : "#fff",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                >
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: mood.color,
                      justifyContent: "center",
                      alignItems: "center",
                      marginBottom: 16,
                    }}
                  >
                    <Text style={{ fontSize: 28 }}>{mood.emoji}</Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: "Inter_700Bold",
                      fontSize: 14,
                      color: "#1a1a2e",
                    }}
                  >
                    {mood.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Continue Button */}
        <View style={{ paddingHorizontal: 24, marginTop: 24, marginBottom: 16 }}>
          <TouchableOpacity
            onPress={handleContinue}
            disabled={!selectedMood || isSubmitting}
            style={{
              backgroundColor: selectedMood ? "#312E81" : "#E2E8F0",
              borderRadius: 16,
              paddingVertical: 18,
              alignItems: "center",
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_700Bold",
                fontSize: 16,
                color: selectedMood ? "#fff" : "#94A3B8",
              }}
            >
              {isSubmitting ? "Saving..." : "Continue"}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
    </View>
  );
}
