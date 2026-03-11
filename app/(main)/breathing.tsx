import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { dashboardService } from "../../services/dashboardService";
import { logger } from "../../utils/logger";

type BreathMode = "box" | "478";
type Phase = "In" | "Hold" | "Out" | "HoldOut" | "Ready";

const MODES: Record<BreathMode, { label: string; desc: string; phases: Array<{ phase: Phase; duration: number }> }> = {
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
        desc: "4s in · 7s hold · 8s out — Dr. Weil's instant sleep & anxiety relief",
        phases: [
            { phase: "In", duration: 4000 },
            { phase: "Hold", duration: 7000 },
            { phase: "Out", duration: 8000 },
        ],
    },
};

const SESSION_DURATION = 60; // seconds

export default function BreathingScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const user = useAuth(s => s.currentUser);

    const [mode, setMode] = useState<BreathMode>("box");
    const [phase, setPhase] = useState<Phase>("Ready");
    const [secondsRemaining, setSecondsRemaining] = useState(SESSION_DURATION);
    const [isActive, setIsActive] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [phaseIndex, setPhaseIndex] = useState(0);

    const isActiveRef = useRef(false);
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(0.3)).current;
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const animRef = useRef<Animated.CompositeAnimation | null>(null);

    useEffect(() => {
        logger.info("SCREEN_VIEW: BreathingExercise");
        return () => {
            isActiveRef.current = false;
            if (timerRef.current) clearInterval(timerRef.current);
            if (animRef.current) animRef.current.stop();
        };
    }, []);

    const stopSession = useCallback(() => {
        isActiveRef.current = false;
        setIsActive(false);
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        if (animRef.current) { animRef.current.stop(); animRef.current = null; }
    }, []);

    const finishSession = useCallback(async () => {
        stopSession();
        setPhase("Ready");
        setCompleted(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (user?.id) {
            await dashboardService.logWellnessSession(user.id, "breathing", SESSION_DURATION);
        }
    }, [stopSession, user]);

    const runPhase = useCallback((idx: number) => {
        if (!isActiveRef.current) return;
        const modeConfig = MODES[mode];
        const current = modeConfig.phases[idx % modeConfig.phases.length];

        setPhase(current.phase);
        setPhaseIndex(idx % modeConfig.phases.length);

        // Haptic cue on phase change
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const toScale = (current.phase === "In") ? 1.6
            : (current.phase === "Out" || current.phase === "HoldOut") ? 1.0 : 1.6; // Hold keeps large
        const toOpacity = (current.phase === "In" || current.phase === "Hold") ? 0.8 : 0.3;

        const anim = Animated.parallel([
            Animated.timing(scaleAnim, {
                toValue: toScale,
                duration: current.duration,
                easing: (current.phase === "Hold" || current.phase === "HoldOut") ? Easing.linear : Easing.bezier(0.42, 0, 0.58, 1),
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
            if (!finished || !isActiveRef.current) return;
            runPhase(idx + 1);
        });
    }, [mode, scaleAnim, opacityAnim]);

    const startBreathing = useCallback(() => {
        isActiveRef.current = true;
        setIsActive(true);
        setCompleted(false);
        setSecondsRemaining(SESSION_DURATION);
        scaleAnim.setValue(1);
        opacityAnim.setValue(0.3);

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        runPhase(0);

        timerRef.current = setInterval(() => {
            setSecondsRemaining(prev => {
                if (prev <= 1) {
                    setTimeout(finishSession, 0);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [runPhase, finishSession, scaleAnim, opacityAnim]);

    const phaseLabel = () => {
        if (phase === "Ready") return "START";
        if (phase === "HoldOut") return "HOLD";
        return phase.toUpperCase();
    };

    const phaseInstruction = () => {
        if (!isActive) return MODES[mode].desc;
        if (phase === "In") return "Breathe in slowly through your nose...";
        if (phase === "Out") return "Breathe out slowly through your mouth...";
        return "Hold gently... stay still...";
    };

    const modePhases = MODES[mode].phases;

    return (
        <View className="flex-1 bg-slate-950">
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={["#020617", "#1E1B4B", "#1E293B"]}
                style={{ flex: 1, paddingTop: insets.top }}
            >
                {/* Header */}
                <View
                    className="mx-4 mt-2 px-4 py-3 rounded-3xl flex-row items-center justify-between"
                    style={{ backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}
                >
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="w-10 h-10 rounded-2xl bg-white/10 items-center justify-center"
                    >
                        <Ionicons name="chevron-back" size={24} color="#fff" />
                    </TouchableOpacity>

                    <Text style={{ fontFamily: "Manrope_600SemiBold", fontSize: 13, color: "#fff", letterSpacing: 1.5, textTransform: "uppercase" }}>
                        Breathing Space
                    </Text>

                    <View className="w-10 h-10 rounded-2xl bg-white/10 items-center justify-center">
                        <Ionicons name="information-circle-outline" size={22} color="#fff" />
                    </View>
                </View>

                {/* Mode Selector (only shown when not active) */}
                {!isActive && !completed && (
                    <View style={{ flexDirection: "row", marginHorizontal: 24, marginTop: 20, gap: 12 }}>
                        {(Object.keys(MODES) as BreathMode[]).map(m => (
                            <TouchableOpacity
                                key={m}
                                onPress={() => { setMode(m); Haptics.selectionAsync(); }}
                                style={{
                                    flex: 1,
                                    paddingVertical: 10,
                                    borderRadius: 16,
                                    alignItems: "center",
                                    backgroundColor: mode === m ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.05)",
                                    borderWidth: 1,
                                    borderColor: mode === m ? "#6366F1" : "rgba(255,255,255,0.1)",
                                }}
                            >
                                <Text style={{ fontFamily: "Manrope_700Bold", fontSize: 13, color: mode === m ? "#A5B4FC" : "#64748B" }}>
                                    {MODES[m].label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                <View className="flex-1 items-center justify-center px-10">
                    {completed ? (
                        /* ── Completion Screen ── */
                        <View className="items-center w-full">
                            <View className="w-24 h-24 rounded-3xl bg-emerald-500/20 border border-emerald-500/50 items-center justify-center mb-8">
                                <Ionicons name="checkmark-circle" size={56} color="#10B981" />
                            </View>
                            <Text style={{ fontFamily: "Rosehot", fontSize: 36, color: "#fff", textAlign: "center" }}>
                                Zen Attained
                            </Text>

                            <View className="bg-white/10 px-6 py-4 rounded-3xl border border-white/10 mt-6 items-center">
                                <View className="flex-row items-center mb-2">
                                    <Text style={{ fontSize: 18, marginRight: 8 }}>💎</Text>
                                    <Text style={{ fontFamily: "Manrope_700Bold", fontSize: 16, color: "#4ADE80" }}>+5 Karma</Text>
                                </View>
                                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#94A3B8" }}>Wellness session logged</Text>
                            </View>

                            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 15, color: "#94A3B8", textAlign: "center", marginTop: 24, lineHeight: 22 }}>
                                Your nervous system is settling into a restorative state. Carry this peace with you.
                            </Text>

                            <TouchableOpacity
                                onPress={() => { setCompleted(false); setPhase("Ready"); setSecondsRemaining(SESSION_DURATION); }}
                                style={{ marginTop: 32, width: "100%", paddingVertical: 16, borderRadius: 24, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.05)" }}
                            >
                                <Text style={{ fontFamily: "Manrope_600SemiBold", fontSize: 15, color: "#94A3B8" }}>Go Again</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => router.back()}
                                style={{ marginTop: 12, backgroundColor: "#fff", width: "100%", paddingVertical: 18, borderRadius: 24, alignItems: "center" }}
                            >
                                <Text style={{ fontFamily: "Manrope_600SemiBold", fontSize: 16, color: "#0F172A" }}>Continue to Sanctuary</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        /* ── Active / Ready Screen ── */
                        <>
                            {/* Title area */}
                            <View className="absolute top-10 items-center">
                                <Text style={{ fontFamily: "Manrope_600SemiBold", fontSize: 12, color: "#818CF8", textTransform: "uppercase", letterSpacing: 2.5 }}>
                                    {MODES[mode].label}
                                </Text>
                                <Text style={{ fontFamily: "Rosehot", fontSize: 32, color: "#fff", marginTop: 8 }}>
                                    {isActive ? `${secondsRemaining}s Left` : "Ready"}
                                </Text>
                            </View>

                            {/* Breathing circle */}
                            <View style={{ alignItems: "center", justifyContent: "center" }}>
                                <Animated.View style={{ width: 250, height: 250, borderRadius: 125, backgroundColor: "#4F46E5", opacity: Animated.multiply(opacityAnim, 0.15), transform: [{ scale: Animated.add(scaleAnim, 0.5) }], position: "absolute" }} />
                                <Animated.View style={{ width: 180, height: 180, borderRadius: 90, backgroundColor: "#6366F1", opacity: Animated.multiply(opacityAnim, 0.35), transform: [{ scale: Animated.add(scaleAnim, 0.25) }], position: "absolute" }} />
                                <Animated.View style={{ width: 160, height: 160, borderRadius: 80, overflow: "hidden", opacity: opacityAnim, transform: [{ scale: scaleAnim }], position: "absolute", shadowColor: "#3B82F6", shadowRadius: 30, shadowOpacity: 0.5 }}>
                                    <LinearGradient colors={["#3B82F6", "#6366F1"]} style={{ flex: 1 }} />
                                </Animated.View>

                                {/* Label ring */}
                                <View style={{ width: 176, height: 176, borderRadius: 88, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}>
                                    <View style={{ width: 144, height: 144, borderRadius: 72, backgroundColor: "rgba(15,23,42,0.5)", alignItems: "center", justifyContent: "center" }}>
                                        <Text style={{ fontFamily: "Rosehot", fontSize: 28, color: "#fff" }}>
                                            {phaseLabel()}
                                        </Text>
                                        {isActive && (
                                            <View style={{ flexDirection: "row", gap: 6, marginTop: 12 }}>
                                                {modePhases.map((p, i) => (
                                                    <View
                                                        key={i}
                                                        style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: phaseIndex === i ? "#fff" : "rgba(255,255,255,0.15)" }}
                                                    />
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>

                            {/* Instruction text */}
                            <View style={{ marginTop: 100, paddingHorizontal: 24 }}>
                                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 15, color: "#94A3B8", textAlign: "center", lineHeight: 24 }}>
                                    {phaseInstruction()}
                                </Text>
                            </View>

                            {/* Start / Stop button */}
                            {isActive ? (
                                <TouchableOpacity
                                    onPress={() => { stopSession(); setPhase("Ready"); }}
                                    activeOpacity={0.8}
                                    style={{ marginTop: 48, backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 48, paddingVertical: 18, borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" }}
                                >
                                    <Text style={{ fontFamily: "Manrope_700Bold", fontSize: 17, color: "#fff", letterSpacing: 0.5 }}>Stop</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    onPress={startBreathing}
                                    activeOpacity={0.8}
                                    style={{ marginTop: 48, backgroundColor: "#fff", paddingHorizontal: 48, paddingVertical: 18, borderRadius: 24, shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 8 }}
                                >
                                    <Text style={{ fontFamily: "Manrope_700Bold", fontSize: 17, color: "#0F172A", letterSpacing: 0.5 }}>Begin Guidance</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </View>
            </LinearGradient>
        </View>
    );
}
