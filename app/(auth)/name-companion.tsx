import { View, Text, TextInput, TouchableOpacity, StatusBar, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";

export default function NameCompanion() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [name, setName] = useState("");
    const updateProfile = useAuth((s) => s.updateProfile);

    return (
        <View className="flex-1" style={{ backgroundColor: "#fff" }}>
            <StatusBar barStyle="dark-content" />
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <View style={{ flex: 1, paddingTop: insets.top + 50, paddingHorizontal: 28 }}>
                    {/* Emoji */}
                    <View className="items-center mb-6">
                        <View
                            style={{
                                width: 100,
                                height: 100,
                                borderRadius: 50,
                                backgroundColor: "#F7F7F8",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Text style={{ fontSize: 50 }}>💬</Text>
                        </View>
                    </View>

                    {/* Heading */}
                    <Text
                        className="text-center mb-2"
                        style={{
                            fontFamily: "Rosehot",
                            fontSize: 28,
                            color: "#1a1a2e",
                            lineHeight: 36,
                        }}
                    >
                        What would you like{"\n"}to call me? 😊
                    </Text>
                    <Text
                        className="text-center mb-10"
                        style={{
                            fontFamily: "Inter_400Regular",
                            fontSize: 15,
                            color: "#999",
                        }}
                    >
                        Give your companion a name
                    </Text>

                    {/* Input */}
                    <View
                        style={{
                            backgroundColor: "#F7F7F8",
                            borderRadius: 16,
                            paddingHorizontal: 20,
                            paddingVertical: 16,
                            borderWidth: 1,
                            borderColor: name.length > 0 ? "#1a1a2e" : "#EEEEEF",
                        }}
                    >
                        <TextInput
                            placeholder="e.g. Maya, Luna, Kai..."
                            placeholderTextColor="#bbb"
                            value={name}
                            onChangeText={setName}
                            maxLength={20}
                            autoFocus
                            style={{
                                fontFamily: "Manrope_600SemiBold",
                                fontSize: 20,
                                color: "#1a1a2e",
                                textAlign: "center",
                                padding: 0,
                            }}
                        />
                    </View>
                    <Text
                        className="text-center mt-3"
                        style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#ccc" }}
                    >
                        You can always change this later
                    </Text>
                </View>

                {/* Continue button */}
                <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 20, paddingTop: 16 }}>
                    <TouchableOpacity
                        disabled={name.trim().length === 0}
                        onPress={async () => {
                            await updateProfile({ companion_name: name.trim() });
                            router.push({ pathname: "/(auth)/building", params: { companionName: name.trim() } });
                        }}
                        activeOpacity={0.85}
                        style={{
                            backgroundColor: name.trim().length > 0 ? "#1a1a2e" : "#E8E8EA",
                            borderRadius: 999,
                            paddingVertical: 18,
                            alignItems: "center",
                        }}
                    >
                        <Text
                            style={{
                                fontFamily: "Manrope_600SemiBold",
                                fontSize: 18,
                                color: name.trim().length > 0 ? "#fff" : "#aaa",
                            }}
                        >
                            Continue
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}
