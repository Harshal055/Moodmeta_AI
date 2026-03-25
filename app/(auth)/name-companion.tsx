import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { logger } from "../../utils/logger";

const ACCENT = "#3114D3"; // Matches the deep blue button
const SUGGESTED_NAMES = ["Nova", "Atlas", "Luna", "Echo", "Sage", "Zephyr"];

export default function NameCompanion() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const updateProfile = useAuth((s) => s.updateProfile);
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    logger.info("SCREEN_VIEW: NameCompanion");
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -8, duration: 1600, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const canContinue = name.trim().length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F9FA" }}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingTop: insets.top + 16, paddingHorizontal: 24 }}>

          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 32 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.7}
              style={{ marginRight: 16 }}
            >
              <Ionicons name="arrow-back" size={24} color="#0f172a" />
            </TouchableOpacity>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: "#0f172a" }}>
              Companion Setup
            </Text>
          </View>

          {/* Floating icon */}
          <View style={{ alignItems: "center", marginBottom: 28 }}>
            <Animated.View
              style={{
                transform: [{ translateY: floatAnim }, { scale: pulseAnim }],
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: "#EBEAFC",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="sparkles" size={44} color={ACCENT} />
            </Animated.View>
          </View>

          {/* Heading */}
          <Text
            style={{
              fontFamily: "Inter_800ExtraBold",
              fontSize: 28,
              color: "#0f172a",
              textAlign: "center",
              lineHeight: 36,
              letterSpacing: -0.5,
              marginBottom: 12,
            }}
          >
            What should we call{"\n"}your companion?
          </Text>
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 15,
              color: "#64748b",
              textAlign: "center",
              lineHeight: 22,
              marginBottom: 36,
            }}
          >
            Give your new friend a unique identity that{"\n"}fits their personality.
          </Text>

          {/* Input */}
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 13,
              color: "#475569",
              marginBottom: 8,
            }}
          >
            Companion Name
          </Text>
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 12,
              paddingLeft: 18,
              paddingRight: 6,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: canContinue ? ACCENT : "#E2E8F0",
              marginBottom: 8,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <TextInput
              placeholder="Type a name..."
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={setName}
              maxLength={20}
              autoFocus
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 16,
                color: "#0f172a",
                padding: 0,
                flex: 1,
                minHeight: 40,
              }}
            />
            <View style={{ backgroundColor: "#F5F3FF", borderRadius: 8, padding: 8 }}>
              <Image
                source={require("../../assets/images/logo.png")}
                style={{ width: 68, height: 28, tintColor: ACCENT }}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Suggested names */}
          <Text
            style={{
              fontFamily: "Inter_700Bold",
              fontSize: 11,
              color: "#64748b",
              letterSpacing: 1.5,
              marginTop: 24,
              marginBottom: 14,
            }}
          >
            SUGGESTED NAMES
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {SUGGESTED_NAMES.map((n) => (
              <TouchableOpacity
                key={n + refreshKey}
                onPress={() => setName(n)}
                activeOpacity={0.7}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: name === n ? ACCENT : "#fff",
                  borderWidth: 1,
                  borderColor: name === n ? ACCENT : "#E2E8F0",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 14,
                    color: name === n ? "#fff" : "#334155",
                  }}
                >
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setRefreshKey((k) => k + 1)}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: "#EBEAFC",
              }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: ACCENT }}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Continue button */}
        <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 20, paddingTop: 16 }}>
          <TouchableOpacity
            disabled={!canContinue}
            onPress={async () => {
              await updateProfile({ companion_name: name.trim() });
              router.push({ pathname: "/(auth)/building", params: { companionName: name.trim() } });
            }}
            activeOpacity={0.85}
            style={{
              backgroundColor: canContinue ? ACCENT : "#CBD5E1",
              borderRadius: 16,
              paddingVertical: 18,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_700Bold",
                fontSize: 17,
                color: "#fff",
                letterSpacing: 0.3,
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
