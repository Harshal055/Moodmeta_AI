import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import { Image, View } from "react-native";
import { useAuth } from "../hooks/useAuth";
import { logger } from "../utils/logger";

export default function Index() {
  const router = useRouter();
  const isInitialized = useAuth((s) => s.isInitialized);
  const isLoading = useAuth((s) => s.isLoading);
  const onboarded = useAuth((s) => s.onboarded);
  const currentUser = useAuth((s) => s.currentUser);
  const profile = useAuth((s) => s.profile);

  useEffect(() => {
    logger.info("SCREEN_VIEW: RootIndex");
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isInitialized || isLoading) return;

      // Avoid onboarding race conditions right after login:
      // if we have a signed-in user but profile hasn't hydrated yet,
      // wait on this screen instead of routing to auth flow.
      if (currentUser && !profile) return;

      if (onboarded && currentUser) {
        router.replace("/(main)/dashboard");
      } else {
        router.replace("/(auth)/welcome");
      }
    }, [
      isInitialized,
      isLoading,
      onboarded,
      currentUser?.id,
      profile?.id,
      router,
    ]),
  );

  // Always show a loading indicator while the initial layout decides where to route
  return (
    <View className="flex-1 justify-center items-center bg-[#f6f6f8]">
      <Image
        source={require("../assets/images/logo.png")}
        style={{ width: 80, height: 80 }}
        resizeMode="contain"
      />
    </View>
  );
}
