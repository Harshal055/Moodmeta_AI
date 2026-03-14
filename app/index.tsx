import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { logger } from "../utils/logger";

export default function Index() {
  const isInitialized = useAuth((s) => s.isInitialized);
  const isLoading = useAuth((s) => s.isLoading);
  const onboarded = useAuth((s) => s.onboarded);
  const currentUser = useAuth((s) => s.currentUser);
  const profile = useAuth((s) => s.profile);
  const hasNavigated = useRef(false);

  useEffect(() => {
    logger.info("SCREEN_VIEW: RootIndex");
  }, []);

  useEffect(() => {
    if (!isInitialized || isLoading) return;

    // Avoid onboarding race conditions right after login:
    // if we have a signed-in user but profile hasn't hydrated yet,
    // wait on this screen instead of routing to auth flow.
    if (currentUser && !profile) return;

    if (hasNavigated.current) return;
    hasNavigated.current = true;

    if (onboarded && currentUser) {
      router.replace("/(main)/dashboard");
    } else {
      router.replace("/(auth)/welcome");
    }
  }, [isInitialized, isLoading, onboarded, currentUser, profile]);

  return null;
}
