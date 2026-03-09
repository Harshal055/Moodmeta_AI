import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { logger } from "../../utils/logger";

const ADMIN_EMAIL = "harsh@moodmateai.com";

export default function LoginScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async () => {
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || !password) {
            Alert.alert("Missing Info", "Please enter both email and password.");
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password,
            });

            if (error) throw error;

            // Redirect logic (B4: Use robust store-based check)
            if (useAuth.getState().isAdmin) {
                router.replace("/(admin)/dashboard");
            } else {
                router.replace("/(main)/chat");
            }
        } catch (error: any) {
            logger.error("Login Error:", error);
            Alert.alert("Login Failed", error.message || "Please check your credentials.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
        >
            <View style={[styles.innerContainer, { paddingTop: Math.max(insets.top, 20) }]}>

                {/* Main Card */}
                <View style={styles.card}>
                    {/* Logo Area */}
                    <View style={styles.logoContainer}>
                        <Image
                            source={require("../../assets/images/logo.png")}
                            style={{ width: 40, height: 40, marginRight: 8 }}
                            resizeMode="contain"
                        />
                        <Text style={styles.logoText}>MoodMateAI</Text>
                    </View>

                    <View style={styles.header}>
                        <Text style={styles.title}>Welcome Back</Text>
                        <Text style={styles.subtitle}>Enter your details to log in to your account</Text>
                    </View>

                    <View style={styles.form}>
                        {/* Email Input */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                placeholder="name@example.com"
                                placeholderTextColor="#94a3b8"
                                autoCapitalize="none"
                                keyboardType="email-address"
                                style={styles.input}
                            />
                        </View>

                        {/* Password Input */}
                        <View style={styles.inputGroup}>
                            <View style={styles.passwordLabelRow}>
                                <Text style={styles.label}>Password</Text>
                                <TouchableOpacity>
                                    <Text style={styles.forgotPassword}>Forgot password?</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.passwordInputContainer}>
                                <TextInput
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="Enter your password"
                                    placeholderTextColor="#94a3b8"
                                    secureTextEntry={!showPassword}
                                    style={styles.passwordInput}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                                    <Ionicons name={showPassword ? "eye" : "eye-off"} size={20} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Login Button */}
                        <TouchableOpacity
                            onPress={handleLogin}
                            disabled={loading}
                            style={styles.loginButton}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.loginButtonText}>Log In</Text>
                            )}
                        </TouchableOpacity>

                        {/* Divider */}
                        <View style={styles.dividerContainer}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* Social Buttons */}
                        <View style={styles.socialRow}>
                            <TouchableOpacity
                                style={styles.socialButton}
                                onPress={async () => {
                                    setLoading(true);
                                    try {
                                        await useAuth.getState().signInWithGoogle();
                                        // Router should handle the rest via store state, 
                                        // but we force it here for immediate response
                                        const { onboarded, isAdmin } = useAuth.getState();
                                        if (isAdmin) {
                                            router.replace("/(admin)/dashboard");
                                        } else if (onboarded) {
                                            router.replace("/(main)/chat");
                                        } else {
                                            router.replace("/(auth)/role-picker");
                                        }
                                    } catch (e) {
                                        // Error handled in store
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                            >
                                <Ionicons name="logo-google" size={18} color="#EA4335" />
                                <Text style={styles.socialButtonText}>Google</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.socialButton}
                                onPress={() => Alert.alert("Coming Soon 🍎", "Apple Login will be available in the next update! We are currently working on the final approval.")}
                            >
                                <Ionicons name="logo-apple" size={18} color="#000" />
                                <Text style={styles.socialButtonText}>Apple</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Sign Up Link */}
                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Don't have an account? </Text>
                            <TouchableOpacity onPress={() => router.push("/(auth)/role-picker")}>
                                <Text style={styles.signupLink}>Sign up for free</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f6f6f8",
    },
    innerContainer: {
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: 20,
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 24,
        paddingVertical: 32,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 15,
        elevation: 2,
    },
    logoContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 24,
        gap: 8,
    },
    logoIcon: {
        backgroundColor: "#1337ec",
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    logoText: {
        fontSize: 18,
        fontFamily: "Inter_700Bold",
        color: "#0f172a",
        letterSpacing: -0.5,
    },
    header: {
        alignItems: "center",
        marginBottom: 32,
    },
    title: {
        fontSize: 24,
        fontFamily: "Inter_800ExtraBold",
        color: "#0f172a",
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 14,
        fontFamily: "Inter_500Medium",
        color: "#64748b",
        textAlign: "center",
    },
    form: {
        gap: 20,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 13,
        fontFamily: "Inter_700Bold",
        color: "#0f172a",
    },
    input: {
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 15,
        fontFamily: "Inter_500Medium",
        color: "#0f172a",
    },
    passwordLabelRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    forgotPassword: {
        fontSize: 13,
        fontFamily: "Inter_500Medium",
        color: "#1337ec",
    },
    passwordInputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 8,
    },
    passwordInput: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 15,
        fontFamily: "Inter_500Medium",
        color: "#0f172a",
    },
    eyeIcon: {
        padding: 14,
    },
    loginButton: {
        backgroundColor: "#1337ec",
        borderRadius: 8,
        paddingVertical: 16,
        alignItems: "center",
        shadowColor: "#1337ec",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 3,
        marginTop: 4,
    },
    loginButtonText: {
        color: "#fff",
        fontSize: 16,
        fontFamily: "Inter_700Bold",
    },
    dividerContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 4,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: "#e2e8f0",
    },
    dividerText: {
        paddingHorizontal: 12,
        fontSize: 11,
        fontFamily: "Inter_600SemiBold",
        color: "#94a3b8",
        letterSpacing: 0.5,
    },
    socialRow: {
        flexDirection: "row",
        gap: 12,
    },
    socialButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 8,
        paddingVertical: 14,
        gap: 8,
    },
    socialButtonText: {
        fontSize: 14,
        fontFamily: "Inter_600SemiBold",
        color: "#334155",
    },
    footer: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 8,
    },
    footerText: {
        fontSize: 13,
        fontFamily: "Inter_500Medium",
        color: "#64748b",
    },
    signupLink: {
        fontSize: 13,
        fontFamily: "Inter_700Bold",
        color: "#1337ec",
    },
});
