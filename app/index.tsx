import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../hooks/useAuth";

export default function Index() {
  const router = useRouter();
  const isInitialized = useAuth((s) => s.isInitialized);
  const onboarded = useAuth((s) => s.onboarded);
  const currentUser = useAuth((s) => s.currentUser);

  useFocusEffect(
    useCallback(() => {
      if (isInitialized) {
        if (onboarded && currentUser) {
          router.replace("/(main)/chat");
        } else {
          router.replace("/(auth)/welcome");
        }
      }
    }, [isInitialized, onboarded, currentUser?.id, router])
  );

  // Always show a loading indicator while the initial layout decides where to route
  return (
    <View className="flex-1 justify-center items-center bg-white">
      <ActivityIndicator size="large" color="#FF3B30" />
    </View>
  );
}
