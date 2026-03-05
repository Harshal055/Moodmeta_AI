import { Ionicons } from "@expo/vector-icons";
import { decode } from "base64-arraybuffer";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";

const roles = [
    { id: "friend", label: "Friend", icon: "😌" },
    { id: "boyfriend", label: "Boyfriend", icon: "💑" },
    { id: "girlfriend", label: "Girlfriend", icon: "👧" },
    { id: "mother", label: "Mother", icon: "🥰" },
    { id: "father", label: "Father", icon: "👨‍👧" },
    { id: "custom", label: "Custom", icon: "✨" },
];

export default function CustomizeScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const user = useAuth((s) => s.currentUser);
    const profile = useAuth((s) => s.profile);
    const updateProfile = useAuth((s) => s.updateProfile);

    const [name, setName] = useState(profile?.companion_name || "");
    const [selectedRole, setSelectedRole] = useState(profile?.role || "friend");
    const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null);

    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const hasChanges = name.trim() !== profile?.companion_name || selectedRole !== profile?.role || avatarUrl !== profile?.avatar_url;

    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to upload an avatar.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images',
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
                base64: true,
            });

            if (!result.canceled && result.assets[0].base64 && user) {
                setIsUploading(true);
                const base64FileData = result.assets[0].base64;
                const ext = result.assets[0].uri.split('.').pop() || 'jpg';
                const filePath = `${user.id}.${ext}`;

                // Upload to Supabase Storage
                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, decode(base64FileData), {
                        contentType: `image/${ext}`,
                        upsert: true,
                    });

                if (uploadError) throw uploadError;

                // Get Public URL
                const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

                // Bust cache by appending a timestamp
                const finalUrl = `${data.publicUrl}?t=${new Date().getTime()}`;
                setAvatarUrl(finalUrl);
            }
        } catch (error) {
            console.error("Error uploading image:", error);
            Alert.alert("Error", "Could not upload image. Make sure you ran the SQL script to create the 'avatars' storage bucket.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        setIsSaving(true);
        try {
            await updateProfile({
                companion_name: name.trim(),
                role: selectedRole,
                avatar_url: avatarUrl // Save the avatar URL!
            });
            Alert.alert("Success", "Companion updated successfully!", [
                { text: "OK", onPress: () => router.back() }
            ]);
        } catch (e) {
            console.error("Failed to update companion", e);
            Alert.alert("Error", "Could not save your changes. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1, backgroundColor: "#F8FBFF" }}
        >
            <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4">
                        <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
                    </TouchableOpacity>
                    <Text style={{ fontFamily: "Manrope_700Bold", fontSize: 24, color: "#1a1a2e" }}>
                        Customize
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={handleSave}
                    disabled={!hasChanges || isSaving || !name.trim()}
                    style={{ opacity: hasChanges && name.trim() && !isSaving ? 1 : 0.5 }}
                >
                    {isSaving ? (
                        <ActivityIndicator size="small" color="#1a1a2e" />
                    ) : (
                        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 16, color: "#1a1a2e" }}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>

                {/* ── Avatar Picker ── */}
                <View className="items-center mb-8">
                    <TouchableOpacity
                        onPress={pickImage}
                        disabled={isUploading}
                        className="relative w-28 h-28 rounded-full bg-[#E5E7EB] items-center justify-center overflow-hidden border-2 border-[#1a1a2e]"
                    >
                        {avatarUrl ? (
                            <Image source={{ uri: avatarUrl }} className="w-full h-full" />
                        ) : (
                            <Ionicons name="person" size={40} color="#9CA3AF" />
                        )}

                        {isUploading && (
                            <View className="absolute inset-0 bg-black/40 items-center justify-center">
                                <ActivityIndicator color="#fff" />
                            </View>
                        )}

                        {!isUploading && (
                            <View className="absolute bottom-0 w-full bg-black/50 py-1 items-center">
                                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: "#fff" }}>EDIT</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#999", marginBottom: 12, marginLeft: 12 }}>
                    COMPANION NAME
                </Text>

                <View className="bg-white rounded-2xl border border-[#F0F0F0] p-4 mb-8">
                    <TextInput
                        value={name}
                        onChangeText={setName}
                        placeholder="e.g. Maya, Kai..."
                        placeholderTextColor="#bbb"
                        maxLength={20}
                        style={{
                            fontFamily: "Manrope_600SemiBold",
                            fontSize: 18,
                            color: "#1a1a2e",
                            padding: 0,
                        }}
                    />
                </View>

                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#999", marginBottom: 12, marginLeft: 12 }}>
                    RELATIONSHIP ROLE
                </Text>

                <View className="flex-row flex-wrap justify-between pb-10">
                    {roles.map((r) => {
                        const isSelected = selectedRole === r.id;
                        return (
                            <TouchableOpacity
                                key={r.id}
                                onPress={() => setSelectedRole(r.id)}
                                activeOpacity={0.8}
                                className="w-[48%] mb-3"
                            >
                                <View
                                    style={{
                                        backgroundColor: isSelected ? "#f0f0f0" : "#fff",
                                        borderWidth: isSelected ? 2 : 1,
                                        borderColor: isSelected ? "#1a1a2e" : "#EEEEEF",
                                        borderRadius: 18,
                                        paddingVertical: 18,
                                        paddingHorizontal: 14,
                                        alignItems: "center",
                                    }}
                                >
                                    <Text style={{ fontSize: 32, marginBottom: 8 }}>{r.icon}</Text>
                                    <Text
                                        style={{
                                            fontFamily: "Manrope_600SemiBold",
                                            fontSize: 14,
                                            color: "#1a1a2e",
                                        }}
                                    >
                                        {r.label}
                                    </Text>
                                    {isSelected && (
                                        <View
                                            style={{
                                                position: "absolute",
                                                top: 10,
                                                right: 10,
                                                width: 18,
                                                height: 18,
                                                borderRadius: 9,
                                                backgroundColor: "#1a1a2e",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <Text style={{ fontSize: 10, color: "#fff" }}>✓</Text>
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

            </ScrollView>
        </KeyboardAvoidingView>
    );
}
