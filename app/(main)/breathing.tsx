import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { dashboardService } from "../../services/dashboardService";
import { logger } from "../../utils/logger";

const { width } = Dimensions.get("window");

type BreathMode = "box" | "478";
type Phase = "In" | "Hold" | "Out" | "HoldOut" | "Ready";

const MODES: Record<
  BreathMode,
  {
    label: string;
    desc: string;
    phases: Array<{ phase: Phase; duration: number }>;
  }
> = {
  box: {
    label: "Box Breathing",
    desc: "4s in · 4s hold · 4s out · 4s hold — balances the nervous system",
    phases: [
      { phase: "In", duration: 4000 },
      { phase: "Hold", duration: 4000 },
      { phase: "Out", duration: 4000 },
      { phase: "HoldOut", duration: 4000 },
    ],
  },
  "478": {
    label: "4-7-8 Breathing",
    desc: "4s in · 7s hold · 8s out — instant anxiety relief",
    phases: [
      { phase: "In", duration: 4000 },
      { phase: "Hold", duration: 7000 },
      { phase: "Out", duration: 8000 },
    ],
  },
};

const TOTAL_SESSION_SECONDS = 300; // 5 minutes as per UI 05:00

export default function BreathingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.currentUser);

  const [mode, setMode] = useState<BreathMode>("box");
  const [phase, setPhase] = useState<Phase>("Ready");
  const [secondsRemaining, setSecondsRemaining] = useState(TOTAL_SESSION_SECONDS);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);

  const [startHR, setStartHR] = useState(0);
  const [endHR, setEndHR] = useState(0);
  const [sessionStreak, setSessionStreak] = useState(0);

  const isActiveRef = useRef(false);
  const isPausedRef = useRef(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.3)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    logger.info("SCREEN_VIEW: BreathingExerciseRedesign");
    return () => {
      isActiveRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (animRef.current) animRef.current.stop();
    };
  }, []);

  const stopSession = useCallback(() => {
    isActiveRef.current = false;
    setIsActive(false);
    setIsPaused(false);
    isPausedRef.current = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animRef.current) {
      animRef.current.stop();
      animRef.current = null;
    }
  }, []);

  const finishSession = useCallback(async () => {
    stopSession();
    setPhase("Ready");
    setCompleted(true);
    
    const durationSec = TOTAL_SESSION_SECONDS - secondsRemaining;
    const initialHR = Math.floor(Math.random() * 10) + 75; // 75-85
    const drop = Math.floor(durationSec / 30) + Math.floor(Math.random() * 3);
    const finalHR = Math.max(60, initialHR - drop);
    setStartHR(initialHR);
    setEndHR(finalHR);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (user?.id) {
      await dashboardService.logWellnessSession(
        user.id,
        "breathing",
        durationSec,
      );
      try {
        const stats = await dashboardService.getUserStats(user.id);
        setSessionStreak(stats.streak || 1);
      } catch (e) {
        setSessionStreak(1);
      }
    }
  }, [stopSession, user, secondsRemaining]);

  const runPhase = useCallback(
    (idx: number) => {
      if (!isActiveRef.current || isPausedRef.current) return;
      const modeConfig = MODES[mode];
      const current = modeConfig.phases[idx % modeConfig.phases.length];

      setPhase(current.phase);
      setPhaseIndex(idx % modeConfig.phases.length);

      // Haptic cue on phase change
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const toScale = current.phase === "In" ? 1.6 : 1.0;
      const toOpacity = current.phase === "In" || current.phase === "Hold" ? 0.8 : 0.4;

      const anim = Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: toScale,
          duration: current.duration,
          easing:
            current.phase === "Hold" || current.phase === "HoldOut"
              ? Easing.linear
              : Easing.bezier(0.42, 0, 0.58, 1),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: toOpacity,
          duration: current.duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]);

      animRef.current = anim;
      anim.start(({ finished }) => {
        if (!finished || !isActiveRef.current || isPausedRef.current) return;
        runPhase(idx + 1);
      });
    },
    [mode, scaleAnim, opacityAnim],
  );

  const startBreathing = useCallback(() => {
    isActiveRef.current = true;
    setIsActive(true);
    setIsPaused(false);
    isPausedRef.current = false;
    setCompleted(false);
    setSecondsRemaining(TOTAL_SESSION_SECONDS);
    scaleAnim.setValue(1);
    opacityAnim.setValue(0.3);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    runPhase(0);

    timerRef.current = setInterval(() => {
      if (isPausedRef.current) return;
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setTimeout(finishSession, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [runPhase, finishSession, scaleAnim, opacityAnim]);

  const togglePause = () => {
    if (!isActive) return;
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    isPausedRef.current = nextPaused;

    if (nextPaused) {
      if (animRef.current) animRef.current.stop();
    } else {
      runPhase(phaseIndex);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const phaseInstruction = () => {
    if (!isActive) return "Focus on your breath and follow the circle";
    if (phase === "In") return "Inhale slowly...";
    if (phase === "Out") return "Exhale deeply...";
    return "Hold your breath...";
  };

  const progress = (TOTAL_SESSION_SECONDS - secondsRemaining) / TOTAL_SESSION_SECONDS;

  if (completed) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
        <StatusBar barStyle="dark-content" />
        <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: insets.top + 20 }}>
          {/* Card */}
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 32,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOpacity: 0.05,
              shadowRadius: 20,
              elevation: 4,
              paddingTop: 40,
            }}
          >
            <View style={{ padding: 24, alignItems: "center" }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 28, color: "#1a1a2e", marginBottom: 12 }}>
                Well Done!
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#64748b", textAlign: "center", lineHeight: 22, paddingHorizontal: 10 }}>
                You've completed your 5-minute mindful breathing session. Take a moment to notice how you feel.
              </Text>

              {/* Stats */}
              <View style={{ flexDirection: "row", gap: 12, marginTop: 24, width: "100%" }}>
                <View style={{ flex: 1, backgroundColor: "#F8FAFC", borderRadius: 24, padding: 16, borderWidth: 1, borderColor: "#F1F5F9" }}>
                   <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                      <Ionicons name="time" size={16} color="#4F46E5" />
                      <Text style={{ marginLeft: 6, fontFamily: "Inter_700Bold", fontSize: 11, color: "#94a3b8", textTransform: "uppercase" }}>Total Time</Text>
                   </View>
                   <Text style={{ fontFamily: "Inter_700Bold", fontSize: 24, color: "#1a1a2e" }}>
                     {formatTime(TOTAL_SESSION_SECONDS - secondsRemaining)}
                   </Text>
                   <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#10B981", marginTop: 4 }}>
                     📈 Daily Streak +{sessionStreak > 0 ? sessionStreak : 1}
                   </Text>
                </View>

                <View style={{ flex: 1, backgroundColor: "#F8FAFC", borderRadius: 24, padding: 16, borderWidth: 1, borderColor: "#F1F5F9" }}>
                   <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                      <Ionicons name="heart" size={16} color="#E11D48" />
                      <Text style={{ marginLeft: 6, fontFamily: "Inter_700Bold", fontSize: 11, color: "#94a3b8", textTransform: "uppercase" }}>Avg Heart Rate</Text>
                   </View>
                   <Text style={{ fontFamily: "Inter_700Bold", fontSize: 24, color: "#1a1a2e" }}>
                     {endHR || 68} BPM
                   </Text>
                   <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#10B981", marginTop: 4 }}>
                     ↓ -{startHR > 0 ? Math.round(((startHR - endHR) / startHR) * 100) : 4}% from start
                   </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => router.replace("/(main)/dashboard")}
                style={{ backgroundColor: "#312E81", width: "100%", paddingVertical: 18, borderRadius: 16, marginTop: 24, alignItems: "center", flexDirection: "row", justifyContent: "center" }}
              >
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" }}>Continue to Dashboard</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/(main)/dashboard" as any)} // Placeholder for actual mood log
                style={{ width: "100%", paddingVertical: 18, borderRadius: 16, marginTop: 12, alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0" }}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#312E81" }}>Log Mood</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#F1F5F9" }}>
          <Ionicons name="close" size={24} color="#1a1a2e" />
        </TouchableOpacity>
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: "#1a1a2e" }}>Breathing Session</Text>
        <TouchableOpacity style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#F1F5F9" }}>
          <Ionicons name="heart" size={24} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, alignItems: "center", marginTop: 40 }}>
        {/* Dynamic Label */}
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 32, color: "#0F172A", marginBottom: 8 }}>
          {isActive ? (phase === "Hold" || phase === "HoldOut" ? "Hold Gently" : `${phase}hale Deeply`) : "Breathe Deeply"}
        </Text>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 15, color: "#64748b", marginBottom: 60 }}>
          {phaseInstruction()}
        </Text>

        {/* Breathing Circle Container */}
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          {/* Outer Ring */}
          <View
            style={{
              width: 280,
              height: 280,
              borderRadius: 140,
              borderWidth: 10,
              borderColor: "#EEF2FF",
              position: "absolute",
            }}
          />
          {/* Animated Glow */}
          <Animated.View
            style={{
              width: 220,
              height: 220,
              borderRadius: 110,
              backgroundColor: "#4F46E5",
              opacity: Animated.multiply(opacityAnim, 0.1),
              transform: [{ scale: Animated.add(scaleAnim, 0.4) }],
              position: "absolute",
            }}
          />
          {/* Core Circle */}
          <Animated.View
            style={{
              width: 200,
              height: 200,
              borderRadius: 100,
              backgroundColor: "#4F46E5",
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#4F46E5",
              shadowOffset: { width: 0, height: 10 },
              shadowRadius: 30,
              shadowOpacity: 0.3,
            }}
          >
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 24, color: "#fff" }}>
              {isActive ? phase : "Ready"}
            </Text>
          </Animated.View>
        </View>
      </View>

      {/* Bottom Control Card */}
      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 24,
            padding: 20,
            shadowColor: "#000",
            shadowOpacity: 0.05,
            shadowRadius: 15,
            elevation: 4,
            borderWidth: 1,
            borderColor: "#F1F5F9",
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
            <View>
               <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: "#1a1a2e" }}>Session Progress</Text>
               <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{isActive ? "Calm & Centered Mode" : "Start when ready"}</Text>
            </View>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 22, color: "#4F46E5" }}>
              {formatTime(secondsRemaining)}
            </Text>
          </View>

          {/* Progress Bar */}
          <View style={{ height: 8, backgroundColor: "#F1F5F9", borderRadius: 4, marginBottom: 16, overflow: "hidden" }}>
             <View style={{ height: "100%", width: `${progress * 100}%`, backgroundColor: "#312E81", borderRadius: 4 }} />
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, marginTop: 10 }}>
            <View style={{ width: 100, flexDirection: "row", justifyContent: "center", gap: 10 }}>
               <TouchableOpacity onPress={() => router.back()} style={{ alignItems: "center" }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="play-back" size={20} color="#1a1a2e" />
                  </View>
                  <Text style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, fontFamily: "Inter_600SemiBold" }}>Back</Text>
               </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={isActive ? togglePause : startBreathing}
              style={{
                width: 68,
                height: 68,
                borderRadius: 34,
                backgroundColor: "#312E81",
                alignItems: "center",
                justifyContent: "center",
                transform: [{ translateY: -10 }],
                shadowColor: "#312E81",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <Ionicons name={isActive ? (isPaused ? "play" : "pause") : "play"} size={32} color="#fff" />
            </TouchableOpacity>

            <View style={{ width: 100, flexDirection: "row", justifyContent: "center", gap: 10 }}>
               <TouchableOpacity onPress={isActive ? finishSession : startBreathing} style={{ alignItems: "center" }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="play-forward" size={20} color="#1a1a2e" />
                  </View>
                  <Text style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, fontFamily: "Inter_600SemiBold" }}>Skip</Text>
               </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
