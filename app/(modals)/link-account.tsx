import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { logger } from "../../utils/logger";

export default function LinkAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isLinking, setIsLinking] = useState(false);

  const handleGoogleLink = async () => {
    setIsLinking(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: {
          redirectTo: "moodmateai://",
        },
      });

      if (error) throw error;
    } catch (error: any) {
      logger.error("Link error:", error);
      const message = String(error?.message || "");
      if (message.toLowerCase().includes("cancel")) {
        // user cancelled OAuth flow
      } else if (message.toLowerCase().includes("already")) {
        Alert.alert("Already Linked", "This account is already linked.");
      } else {
        Alert.alert(
          "Linking Failed",
          error?.message || "Could not link account.",
        );
      }
    } finally {
      setIsLinking(false);
    }
  };

  const handleAppleLink = async () => {
    setIsLinking(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "apple",
        options: {
          redirectTo: "moodmateai://",
        },
      });

      if (error) throw error;
    } catch (error: any) {
      logger.error("Apple link error:", error);
      const message = String(error?.message || "");
      if (message.toLowerCase().includes("cancel")) {
        // user cancelled OAuth flow
      } else if (message.toLowerCase().includes("already")) {
        Alert.alert("Already Linked", "This Apple account is already linked.");
      } else {
        Alert.alert(
          "Linking Failed",
          error?.message || "Could not link Apple account.",
        );
      }
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.innerContainer, { paddingTop: Math.max(insets.top, 20) }]}>
        {/* Back button above card */}
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.backButton}
        >
          <Ionicons name="close" size={28} color="#0f172a" />
        </TouchableOpacity>

        {/* Main Card */}
        <View style={styles.card}>
          {/* Logo Area */}
          <View style={styles.logoContainer}>
            <View style={styles.logoIcon}>
              <Ionicons name="cloud-done" size={20} color="#fff" />
            </View>
            <Text style={styles.logoText}>Save Your Chats</Text>
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Never lose your companion</Text>
            <Text style={styles.subtitle}>
              Right now, you are using a temporary account. Link a permanent account below to save your companion securely.
            </Text>
          </View>

          {isLinking ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1337ec" />
              <Text style={styles.loadingText}>Securely linking...</Text>
            </View>
          ) : (
            <View style={styles.form}>
              {/* Apple Button (iOS Only visually prioritised) */}
              {Platform.OS === "ios" && (
                <TouchableOpacity
                  onPress={handleAppleLink}
                  activeOpacity={0.8}
                  style={styles.appleButton}
                >
                  <Ionicons name="logo-apple" size={20} color="#fff" style={styles.btnIcon} />
                  <Text style={styles.appleButtonText}>Continue with Apple</Text>
                </TouchableOpacity>
              )}

              {/* Google Button */}
              <TouchableOpacity
                onPress={handleGoogleLink}
                activeOpacity={0.8}
                style={styles.googleButton}
              >
                <Ionicons name="logo-google" size={20} color="#EA4335" style={styles.btnIcon} />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </TouchableOpacity>

              {/* Email Button */}
              <TouchableOpacity
                onPress={() => router.push("/(modals)/link-email")}
                activeOpacity={0.8}
                style={styles.emailButton}
              >
                <Ionicons name="mail" size={20} color="#0f172a" style={styles.btnIcon} />
                <Text style={styles.emailButtonText}>Continue with Email</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
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
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#64748b",
    textAlign: "center",
    paddingHorizontal: 10,
    lineHeight: 22,
  },
  form: {
    gap: 12,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  loadingText: {
    fontFamily: "Inter_500Medium",
    marginTop: 16,
    color: "#64748b",
  },
  btnIcon: {
    marginRight: 8,
  },
  appleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
    paddingVertical: 14,
    borderRadius: 8,
  },
  appleButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#fff",
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  googleButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#334155",
  },
  emailButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emailButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#0f172a",
  },
});
