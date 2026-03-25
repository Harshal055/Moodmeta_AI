import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

export default function LinkEmailScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLinking, setIsLinking] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleEmailLink = async () => {
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || !password.trim()) {
            Alert.alert("Missing Fields", "Please enter both an email and a password.");
            return;
        }

        // ISSUE 2 FIX: Password strength validation
        if (password.length < 8) {
            Alert.alert("Weak Password", "Password must be at least 8 characters long.");
            return;
        }

        setIsLinking(true);
        try {
            // ISSUE 3 FIX: Admin isolation
            // Prevent falls-through to updateUser for admin email
            if (cleanEmail === "admin@example.com") {
                const { error: adminSignInError } = await supabase.auth.signInWithPassword({
                    email: cleanEmail,
                    password: password,
                });

                if (adminSignInError) {
                    Alert.alert("Admin Access Denied", "Invalid admin credentials.");
                    return; // Explicitly block fallback to updateUser
                }

                Alert.alert("Welcome back, Owner", "Accessing Admin Console...");
                router.replace("/(admin)/dashboard");
                return;
            }

            // Normal User Flow
            // STEP 1: Try to sign in first (in case account already exists)
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password: password,
            });

            if (!signInError) {
                // SUCCESSFUL LOGIN
                Alert.alert("Logged In", "You've been signed into your existing account.");
                router.replace("/(main)/chat");
                return;
            }

            // STEP 2: If sign in failed because user doesn't exist, try to link current anonymous session
            if (signInError.message.toLowerCase().includes("invalid login credentials")) {
                const { error: linkError } = await supabase.auth.updateUser({
                    email: cleanEmail,
                    password: password
                });

                if (linkError) {
                    if (linkError.message.toLowerCase().includes("already registered") || linkError.message.toLowerCase().includes("already taken")) {
                        throw new Error("This email is already taken. Try logging in instead.");
                    }
                    throw linkError;
                }

                // ISSUE 1 FIX: Show 'Please verify' alert
                Alert.alert(
                    "Verify Your Email 📧",
                    "Your companion is saved! However, we've sent a verification link to your email. Please verify to fully secure your account.",
                    [{ text: "Will do!", onPress: () => router.navigate("/(main)/chat") }]
                );
            } else {
                throw signInError;
            }

        } catch (error: any) {
            console.error("Email link error:", error);
            Alert.alert("Action Failed", error.message || "An unexpected error occurred.");
        } finally {
            setIsLinking(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
        >
            <View style={[styles.innerContainer, { paddingTop: Math.max(insets.top, 20) }]}>

                {/* Back button above card */}
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#0f172a" />
                </TouchableOpacity>

                {/* Main Card */}
                <View style={styles.card}>
                    {/* Logo Area */}
                    <View style={styles.logoContainer}>
                        <Image
                            source={require("../../assets/images/logo.png")}
                            style={{ width: 40, height: 40, marginRight: 8 }}
                            resizeMode="contain"
                        />
                        <Text style={styles.logoText}>Connect Email</Text>
                    </View>

                    <View style={styles.header}>
                        <Text style={styles.title}>Save Account</Text>
                        <Text style={styles.subtitle}>Lock in your companion by creating a permanent password</Text>
                    </View>

                    <View style={styles.form}>
                        {/* Email Input */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                placeholder="you@example.com"
                                placeholderTextColor="#94a3b8"
                                autoCapitalize="none"
                                keyboardType="email-address"
                                style={styles.input}
                            />
                        </View>

                        {/* Password Input */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Password</Text>
                            <View style={styles.passwordInputContainer}>
                                <TextInput
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="At least 8 characters"
                                    placeholderTextColor="#94a3b8"
                                    secureTextEntry={!showPassword}
                                    style={styles.passwordInput}
                                />
                            </View>
                        </View>

                        {/* Submit Button */}
                        <TouchableOpacity
                            onPress={handleEmailLink}
                            disabled={isLinking}
                            style={styles.loginButton}
                        >
                            {isLinking ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.loginButtonText}>Save Account</Text>
                            )}
                        </TouchableOpacity>
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
    backButton: {
        marginBottom: 20,
        marginLeft: 4,
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
        paddingHorizontal: 10,
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
});
