import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import "../global.css";
import { useAuth } from "../hooks/useAuth";
import { revenueCatService } from "../services/revenueCatService";

// ── Notification handler ────────────────────────────────────────────
// This tells the OS what to do when a push notification arrives while
// the app is in the FOREGROUND. Without this, foreground notifications
// are silently dropped — the user sees nothing.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, // Show the banner / heads-up notification
    shouldShowList: true, // Show in notification center
    shouldPlaySound: true, // Play the default notification sound
    shouldSetBadge: false, // We don't use badge counts in this app
  }),
});

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const isInitialized = useAuth((s) => s.isInitialized);
  const [rcInitialized, setRcInitialized] = useState(false);
  const notificationResponseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    // Initialize RevenueCat SDK early
    if (!rcInitialized) {
      revenueCatService.initialize();
      setRcInitialized(true);
    }

    // Initialize anonymous auth immediately
    if (!isInitialized) {
      useAuth.getState().initialize();
    }

    // ── Listen for notification taps ──────────────────────────────
    // When the user taps a push notification (whether the app was in
    // the background or killed), this listener fires and we navigate
    // them to the chat screen so they land in the right place.
    notificationResponseListener.current =
      Notifications.addNotificationResponseReceivedListener((_response) => {
        router.push("/(main)/chat");
      });

    return () => {
      if (notificationResponseListener.current) {
        notificationResponseListener.current.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Hide splash screen only after auth is initialized
    if (isInitialized) {
      SplashScreen.hideAsync();
    }
  }, [isInitialized]);

  return (
    <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(main)" />
        <Stack.Screen name="(modals)" options={{ presentation: "modal" }} />
      </Stack>
    </ErrorBoundary>
  );
}
