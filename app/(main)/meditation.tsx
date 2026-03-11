import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { dashboardService } from "../../services/dashboardService";
import { logger } from "../../utils/logger";

export default function MeditationScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const user = useAuth(s => s.currentUser);

    const [seconds, setSeconds] = useState(300); // 5 minutes default
    const [isActive, setIsActive] = useState(false);
    const [completed, setCompleted] = useState(false);

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const timerRef = useRef<any>(null);

    useEffect(() => {
        logger.info("SCREEN_VIEW: MeditationTimer");
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const toggleTimer = () => {
        if (isActive) {
            if (timerRef.current) clearInterval(timerRef.current);
            setIsActive(false);
            pulseAnim.stopAnimation();
        } else {
            setIsActive(true);
            startPulse();
            timerRef.current = setInterval(() => {
                setSeconds(prev => {
                    if (prev <= 1) {
                        finishMeditation();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
    };

    const startPulse = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.05,
                    duration: 2000,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 2000,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                })
            ])
        ).start();
    };

    const finishMeditation = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsActive(false);
        setCompleted(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (user?.id) {
            await dashboardService.logWellnessSession(user.id, "meditation", 300 - seconds);
        }
    };

    const formatTime = (secs: number) => {
        const mins = Math.floor(secs / 60);
        const s = secs % 60;
        return `${mins}:${s < 10 ? "0" : ""}${s}`;
    };

    return (
        <View className="flex-1 bg-slate-950">
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={["#020617", "#1E1B4B", "#0F172A"]}
                style={{ flex: 1, paddingTop: insets.top }}
            >
                {/* Ambient Glows */}
                <View style={{ position: 'absolute', top: 200, left: -100, width: 300, height: 300, backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 150, zIndex: -1 }} />
                <View style={{ position: 'absolute', bottom: 100, right: -50, width: 250, height: 250, backgroundColor: 'rgba(168, 85, 247, 0.05)', borderRadius: 125, zIndex: -1 }} />

                {/* Header */}
                <View className="px-6 py-4 flex-row items-center justify-between">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}
                    >
                        <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={{ fontFamily: "Manrope_600SemiBold", fontSize: 13, color: "rgba(255,255,255,0.6)", letterSpacing: 1.5, textTransform: 'uppercase' }}>Quiet Moment</Text>
                    <View style={{ width: 44 }} />
                </View>

                <View className="flex-1 items-center justify-center px-10">
                    {completed ? (
                        <View className="items-center w-full">
                            <View style={{ width: 100, height: 100, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginBottom: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                                <Text style={{ fontSize: 48 }}>🧘‍♂️</Text>
                            </View>
                            <Text style={{ fontFamily: "Rosehot", fontSize: 36, color: "#fff", textAlign: "center" }}>Mind Filtered</Text>
                            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 16, color: "#94A3B8", textAlign: "center", marginTop: 20, lineHeight: 26 }}>
                                You've successfully cleared the mental noise. Carry this calm clarity with you throughout your day.
                            </Text>

                            <View style={{ width: '100%', marginTop: 48, padding: 24, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                    <Text style={{ fontSize: 20, marginRight: 8 }}>💎</Text>
                                    <Text style={{ fontFamily: "Manrope_700Bold", fontSize: 18, color: "#4ADE80" }}>+30 Karma</Text>
                                </View>
                                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#64748B" }}>Consistent Practice Reward</Text>
                            </View>

                            <TouchableOpacity
                                onPress={() => router.back()}
                                style={{ marginTop: 40, backgroundColor: '#fff', width: '100%', paddingVertical: 18, borderRadius: 24, alignItems: 'center', shadowColor: '#fff', shadowOpacity: 0.1, shadowRadius: 10 }}
                            >
                                <Text style={{ fontFamily: "Manrope_600SemiBold", fontSize: 17, color: "#020617" }}>Return to Sanctuary</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>


                            <Animated.View
                                style={{
                                    width: 280,
                                    height: 280,
                                    borderRadius: 140,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    transform: [{ scale: pulseAnim }],
                                    backgroundColor: 'rgba(255,255,255,0.02)',
                                    borderWidth: 1,
                                    borderColor: 'rgba(255,255,255,0.05)'
                                }}
                            >
                                <LinearGradient
                                    colors={["rgba(99, 102, 241, 0.1)", "rgba(168, 85, 247, 0.1)"]}
                                    style={{ position: 'absolute', width: 240, height: 240, borderRadius: 120, opacity: isActive ? 0.8 : 0.3 }}
                                />
                                <View style={{ width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(15, 23, 42, 0.4)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
                                    <Text style={{ fontFamily: "Rosehot", fontSize: 64, color: "#fff" }}>
                                        {formatTime(seconds)}
                                    </Text>
                                </View>
                            </Animated.View>

                            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 15, color: "#94A3B8", textAlign: "center", marginTop: 60, lineHeight: 26, paddingHorizontal: 20 }}>
                                {isActive
                                    ? "Notice your thoughts like passing clouds. Simply let them drift by without judgment."
                                    : "Take 5 minutes to sit in stillness. No goals, no pressure—just being present in the now."
                                }
                            </Text>

                            <TouchableOpacity
                                onPress={toggleTimer}
                                activeOpacity={0.8}
                                style={{
                                    marginTop: 48,
                                    paddingHorizontal: 48,
                                    paddingVertical: 18,
                                    borderRadius: 24,
                                    backgroundColor: isActive ? 'rgba(255,255,255,0.05)' : '#fff',
                                    borderWidth: isActive ? 1 : 0,
                                    borderColor: 'rgba(255,255,255,0.2)',
                                    shadowColor: isActive ? 'transparent' : '#818CF8',
                                    shadowOpacity: 0.2,
                                    shadowRadius: 15,
                                    elevation: isActive ? 0 : 8
                                }}
                            >
                                <Text style={{ fontFamily: "Manrope_700Bold", fontSize: 17, color: isActive ? "#fff" : "#020617" }}>
                                    {isActive ? "Pause Flow" : "Start Meditation"}
                                </Text>
                            </TouchableOpacity>

                            {isActive && (
                                <TouchableOpacity
                                    onPress={finishMeditation}
                                    style={{ marginTop: 24 }}
                                >
                                    <Text style={{ fontFamily: "Manrope_600SemiBold", fontSize: 13, color: "#475569", letterSpacing: 0.5 }}>END SESSION EARLY</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </View>
            </LinearGradient>
        </View>
    );
}
