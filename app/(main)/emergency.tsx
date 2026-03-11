import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { logger } from "../../utils/logger";

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function EmergencyScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const profile = useAuth(s => s.profile);

    const [step, setStep] = useState(0);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    const GROUNDING_STEPS = [
        {
            title: "5 Things You See",
            description: "Look around and name 5 specific objects you can see right now.",
            icon: "eye-outline",
            color: "#3B82F6"
        },
        {
            title: "4 Things You Touch",
            description: "Notice 4 things you can feel — the fabric of your clothes, the surface under you.",
            icon: "hand-left-outline",
            color: "#10B981"
        },
        {
            title: "3 Things You Hear",
            description: "Listen closely. Name 3 distinct sounds in your environment.",
            icon: "volume-high-outline",
            color: "#F59E0B"
        },
        {
            title: "2 Things You Smell",
            description: "Notice 2 scents. If you can't smell anything, name your favorite smells.",
            icon: "color-filter-outline",
            color: "#EC4899"
        },
        {
            title: "1 Thing You Taste",
            description: "Notice the taste in your mouth, or recall a pleasant flavor.",
            icon: "restaurant-outline",
            color: "#8B5CF6"
        }
    ];

    useEffect(() => {
        logger.info("SCREEN_VIEW: EmergencyGrounding");

        // Subtle pulse for the SOS CTA
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.05,
                    duration: 1500,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1500,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                })
            ])
        ).start();
    }, []);

    const nextStep = () => {
        if (step < GROUNDING_STEPS.length - 1) {
            setStep(step + 1);
        } else {
            router.back();
        }
    };

    const current = GROUNDING_STEPS[step];

    return (
        <View className="flex-1 bg-slate-950">
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={["#064e3b", "#0f172a"]}
                style={{ flex: 1, paddingTop: insets.top }}
            >
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center justify-between">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}
                    >
                        <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={{ fontFamily: "Manrope_600SemiBold", fontSize: 13, color: "rgba(255,255,255,0.6)", letterSpacing: 1.5, textTransform: 'uppercase' }}>Calm Now 🆘</Text>
                    <View style={{ width: 44 }} />
                </View>

                <View className="flex-1 px-8 justify-center">
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 32, borderRadius: 48, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }}>
                        <View
                            style={{ backgroundColor: current.color + "20", width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", marginBottom: 32, borderWidth: 1, borderColor: current.color + "40" }}
                        >
                            <Ionicons name={current.icon as any} size={44} color={current.color} />
                        </View>

                        <Text style={{ fontFamily: "Rosehot", fontSize: 32, color: "#fff", textAlign: "center", marginBottom: 12 }}>
                            {current.title}
                        </Text>

                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 16, color: "#94A3B8", textAlign: "center", lineHeight: 26, marginBottom: 40 }}>
                            {current.description}
                        </Text>

                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 48 }}>
                            {GROUNDING_STEPS.map((_, i) => (
                                <View
                                    key={i}
                                    style={{
                                        width: 12,
                                        height: 4,
                                        borderRadius: 2,
                                        backgroundColor: i === step ? current.color : "rgba(255,255,255,0.1)"
                                    }}
                                />
                            ))}
                        </View>

                        <TouchableOpacity
                            onPress={nextStep}
                            style={{ backgroundColor: '#fff', width: '100%', paddingVertical: 20, borderRadius: 24, alignItems: "center", shadowColor: current.color, shadowOpacity: 0.3, shadowRadius: 15 }}
                        >
                            <Text style={{ fontFamily: "Manrope_700Bold", fontSize: 18, color: "#0F172A" }}>
                                {step === 4 ? "I feel better" : "Next Step"}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Quick Breathing Link - SOS Glass Button */}
                    <AnimatedTouchableOpacity
                        onPress={() => router.push("/(main)/breathing")}
                        style={{
                            marginTop: 40,
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            padding: 24,
                            borderRadius: 32,
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.1)',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transform: [{ scale: pulseAnim }]
                        }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                                <Text style={{ fontSize: 24 }}>🫁</Text>
                            </View>
                            <View>
                                <Text style={{ fontFamily: "Manrope_700Bold", fontSize: 16, color: "#fff" }}>Panic Relief</Text>
                                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Immediate Box Breathing</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
                    </AnimatedTouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.push("/(main)/chat")}
                        style={{ marginTop: 32, paddingVertical: 10, alignItems: 'center' }}
                    >
                        <Text style={{ fontFamily: "Manrope_600SemiBold", fontSize: 14, color: "rgba(255,255,255,0.4)", letterSpacing: 0.5 }}>
                            TALK TO {profile?.companion_name?.toUpperCase() || "COMPANION"} INSTEAD?
                        </Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        </View>
    );
}
