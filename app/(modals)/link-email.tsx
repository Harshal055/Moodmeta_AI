import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { Ionicons } from "@expo/vector-icons";

export default function LinkEmailScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLinking, setIsLinking] = useState(false);

    const handleEmailLink = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert("Missing Fields", "Please enter both an email and a password.");
            return;
        }

        setIsLinking(true);
        try {
            // Updating the user with an email and password attaches this identity 
            // to the current anonymous session permanently.
            const { data, error } = await supabase.auth.updateUser({
                email: email.trim(),
                password: password
            });

            if (error) {
                if (error.message.includes("already registered")) {
                    throw new Error("This email is already linked to another MoodMateAI account. Please use a different email or log out to sign into that account.");
                }
                throw error;
            }

            Alert.alert(
                "Account Saved! 🎉",
                "Your companion and chats are now safely stored with your email. We've sent a confirmation link to your inbox.",
                [{ text: "Awesome", onPress: () => router.navigate("/(main)/chat") }]
            );

        } catch (error: any) {
            console.error("Email link error:", error);
            Alert.alert("Could not save account", error.message || "An unexpected error occurred.");
        } finally {
            setIsLinking(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1, backgroundColor: "#fff" }}
        >
            <View style={{ flex: 1, paddingTop: insets.top + 20, paddingHorizontal: 20 }}>
                {/* Header */}
                <View className="flex-row items-center justify-between mb-8">
                    <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="arrow-back" size={28} color="#1a1a2e" />
                    </TouchableOpacity>
                    <Text style={{ fontFamily: "Manrope_700Bold", fontSize: 20, color: "#1a1a2e" }}>
                        Continue with Email
                    </Text>
                    <View style={{ width: 28 }} />
                </View>

                {/* Imagery & Pitch */}
                <View className="items-center mb-8 mt-2">
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#F7F7F8", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                        <Ionicons name="mail" size={36} color="#1a1a2e" style={{ textAlign: 'center' }} />
                    </View>
                    <Text className="text-center px-4" style={{ fontFamily: "Inter_400Regular", fontSize: 15, color: "#666", lineHeight: 22 }}>
                        Lock in your companion by creating a permanent password.
                    </Text>
                </View>

                <View className="space-y-4">
                    <View>
                        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#1a1a2e", marginBottom: 6, marginLeft: 4 }}>EMAIL</Text>
                        <TextInput
                            placeholder="you@example.com"
                            placeholderTextColor="#ccc"
                            autoCapitalize="none"
                            keyboardType="email-address"
                            value={email}
                            onChangeText={setEmail}
                            className="bg-[#F7F7F8] border border-[#E8E8EA] rounded-xl px-4 py-4 text-[16px]"
                            style={{ fontFamily: "Inter_500Medium", color: "#1a1a2e" }}
                        />
                    </View>

                    <View>
                        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#1a1a2e", marginBottom: 6, marginLeft: 4 }}>PASSWORD</Text>
                        <TextInput
                            placeholder="At least 6 characters"
                            placeholderTextColor="#ccc"
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                            className="bg-[#F7F7F8] border border-[#E8E8EA] rounded-xl px-4 py-4 text-[16px]"
                            style={{ fontFamily: "Inter_500Medium", color: "#1a1a2e" }}
                        />
                    </View>
                </View>

                <View style={{ flex: 1 }} />

                {/* Footer fixed */}
                <View className="py-4" style={{ paddingBottom: Math.max(insets.bottom, 20) }}>
                    <TouchableOpacity
                        onPress={handleEmailLink}
                        disabled={isLinking}
                        className="w-full bg-[#1a1a2e] py-4 rounded-xl items-center justify-center flex-row shadow-sm"
                    >
                        {isLinking ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={{ fontFamily: "Manrope_700Bold", fontSize: 16, color: "#fff" }}>
                                Save Account
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
