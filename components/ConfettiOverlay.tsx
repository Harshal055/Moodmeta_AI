import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";

const { width: SW, height: SH } = Dimensions.get("window");

// Confetti colours — vibrant and celebratory
const COLORS = ["#FF6B9D", "#6366F1", "#10B981", "#F59E0B", "#EC4899", "#3B82F6", "#A855F7", "#22D3EE"];
const PARTICLE_COUNT = 30;

interface Particle {
    x: Animated.Value;
    y: Animated.Value;
    rotate: Animated.Value;
    opacity: Animated.Value;
    scale: Animated.Value;
    color: string;
    size: number;
    shape: "circle" | "square" | "ribbon";
}

export interface ConfettiRef {
    burst: (originY?: number) => void;
}

/** Drop-in confetti overlay. Call `ref.burst()` to trigger. */
const ConfettiOverlay = forwardRef<ConfettiRef>((_, ref) => {
    const particles = useRef<Particle[]>(
        Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
            x: new Animated.Value(SW / 2),
            y: new Animated.Value(0),
            rotate: new Animated.Value(0),
            opacity: new Animated.Value(0),
            scale: new Animated.Value(0),
            color: COLORS[i % COLORS.length],
            size: 6 + Math.random() * 8,
            shape: (["circle", "square", "ribbon"] as const)[i % 3],
        }))
    ).current;

    const burst = useCallback((originY?: number) => {
        const startY = originY ?? SH * 0.35;

        // Reset all particles
        particles.forEach(p => {
            p.x.setValue(SW / 2 + (Math.random() - 0.5) * 80);
            p.y.setValue(startY);
            p.rotate.setValue(0);
            p.opacity.setValue(0);
            p.scale.setValue(0);
        });

        const anims = particles.map((p, i) => {
            const angle = (Math.random() * 360 * Math.PI) / 180;
            const distance = 80 + Math.random() * 180;
            const targetX = SW / 2 + (Math.random() - 0.5) * SW * 0.9;
            const fallY = startY + 80 + Math.random() * SH * 0.5;
            const delay = i * 15;
            const duration = 900 + Math.random() * 500;

            return Animated.sequence([
                Animated.delay(delay),
                Animated.parallel([
                    // Burst up & out
                    Animated.timing(p.x, {
                        toValue: targetX,
                        duration,
                        easing: Easing.out(Easing.quad),
                        useNativeDriver: true,
                    }),
                    Animated.timing(p.y, {
                        toValue: fallY,
                        duration,
                        easing: Easing.bezier(0, -0.4, 0.7, 1.2), // arc up then fall
                        useNativeDriver: true,
                    }),
                    Animated.timing(p.rotate, {
                        toValue: 1,
                        duration,
                        easing: Easing.linear,
                        useNativeDriver: true,
                    }),
                    Animated.sequence([
                        Animated.timing(p.opacity, { toValue: 1, duration: 80, useNativeDriver: true }),
                        Animated.timing(p.scale, { toValue: 1, duration: 200, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
                        Animated.delay(duration - 350),
                        Animated.timing(p.opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
                    ]),
                ]),
            ]);
        });

        Animated.parallel(anims).start();
    }, [particles]);

    useImperativeHandle(ref, () => ({ burst }), [burst]);

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {particles.map((p, i) => {
                const spin = p.rotate.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", `${(Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360)}deg`],
                });

                return (
                    <Animated.View
                        key={i}
                        style={{
                            position: "absolute",
                            width: p.size,
                            height: p.shape === "ribbon" ? p.size * 3 : p.size,
                            borderRadius: p.shape === "circle" ? p.size / 2 : p.shape === "ribbon" ? 2 : 2,
                            backgroundColor: p.color,
                            opacity: p.opacity,
                            transform: [
                                { translateX: p.x },
                                { translateY: p.y },
                                { rotate: spin },
                                { scale: p.scale },
                            ],
                            left: -p.size / 2,
                            top: -p.size / 2,
                        }}
                    />
                );
            })}
        </View>
    );
});

export default ConfettiOverlay;
