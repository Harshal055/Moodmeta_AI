import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";

const MOODS = [
  { score: 1, emoji: "😢", label: "Terrible" },
  { score: 2, emoji: "😞", label: "Bad" },
  { score: 3, emoji: "😐", label: "Okay" },
  { score: 4, emoji: "🙂", label: "Good" },
  { score: 5, emoji: "😁", label: "Great" },
];

const CHAT_SESSION_COUNT_KEY_PREFIX = "chat_sessions_";
const MIN_CHAT_SESSIONS_FOR_MOOD_PROMPT = 3;

export function MoodModal() {
  const user = useAuth((s) => s.currentUser);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkTodayMood() {
      if (!user) return;
      try {
        if (isMounted) setIsLoading(true);

        const sessionCountKey = `${CHAT_SESSION_COUNT_KEY_PREFIX}${user.id}`;
        const rawSessionCount = await AsyncStorage.getItem(sessionCountKey);
        const sessionCount = Number.parseInt(rawSessionCount || "0", 10) || 0;

        if (sessionCount < MIN_CHAT_SESSIONS_FOR_MOOD_PROMPT) {
          if (isMounted) setIsVisible(false);
          return;
        }

        // Get start of today in UTC
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
          .from("mood_logs")
          .select("id")
          .eq("user_id", user.id)
          .gte("created_at", today.toISOString())
          .limit(1);

        if (error) {
          // 525 = Supabase/network unavailable (graceful degradation)
          // PGRST116 = Table doesn't exist (expected on first setup)
          if (
            error.code !== "PGRST116" &&
            error.message !== "error code: 525"
          ) {
            console.error("Error checking mood:", error);
          }
          // On any error, don't show the modal - app continues normally
          if (isMounted) setIsVisible(false);
          return;
        }

        // If no logs today and user has enough chat sessions, show the modal
        if (isMounted && (!data || data.length === 0)) {
          setIsVisible(true);
        }
      } catch (err) {
        console.error("Failed to check mood:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    checkTodayMood();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleSelectMood = async (score: number) => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("mood_logs")
        .insert({ user_id: user.id, mood_score: score });

      if (error) throw error;
      setIsVisible(false);
    } catch (err) {
      console.error("Error saving mood:", err);
      Alert.alert(
        "Error",
        "Could not save your mood right now. Or the SQL script hasn't been run yet.",
      );
      setIsVisible(false); // Close it anyway so it's not a hard blocker
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !isVisible) return null;

  return (
    <Modal transparent animationType="fade" visible={isVisible}>
      <View className="flex-1 bg-black/50 items-center justify-center p-5">
        <View className="bg-white w-full rounded-3xl p-6 items-center">
          <Text
            style={{
              fontFamily: "Manrope_700Bold",
              fontSize: 24,
              color: "#1a1a2e",
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            How are you feeling today?
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: "#666",
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            Your companion will tailor their responses to your mood.
          </Text>

          <View className="flex-row justify-between w-full mb-6">
            {MOODS.map((m) => (
              <TouchableOpacity
                key={m.score}
                onPress={() => handleSelectMood(m.score)}
                disabled={isSubmitting}
                className="items-center justify-center p-2 rounded-2xl active:bg-[#FCDCE4]"
              >
                <Text style={{ fontSize: 40, marginBottom: 8 }}>{m.emoji}</Text>
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 11,
                    color: "#1a1a2e",
                  }}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isSubmitting ? (
            <ActivityIndicator color="#1a1a2e" />
          ) : (
            <TouchableOpacity
              onPress={() => setIsVisible(false)}
              className="py-2 px-4 rounded-full bg-[#f5f5f5]"
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 14,
                  color: "#666",
                }}
              >
                Skip for now
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}
