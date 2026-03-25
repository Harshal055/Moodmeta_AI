import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import "../global.css";
import { useAuth } from "../hooks/useAuth";
import { inAppUpdateService } from "../services/inAppUpdateService";
import { revenueCatService } from "../services/revenueCatService";
import { NotificationService } from "../utils/notificationService";

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
  const isInitialized = useAuth((s) => s.isInitialized);
  const [rcInitialized, setRcInitialized] = useState(false);
  const notificationResponseListener =
    useRef<Notifications.Subscription | null>(null);

  const [fontsLoaded] = useFonts({
    Inter_400Regular: require("../assets/fonts/Inter_400Regular.ttf"),
    Inter_500Medium: require("../assets/fonts/Inter_500Medium.ttf"),
    Inter_700Bold: require("../assets/fonts/Inter_700Bold.ttf"),
    Inter_800ExtraBold: require("../assets/fonts/Inter_800ExtraBold.ttf"),
    Manrope_500Medium: require("../assets/fonts/Manrope_500Medium.ttf"),
    Manrope_600SemiBold: require("../assets/fonts/Manrope_600SemiBold.ttf"),
    Manrope_700Bold: require("../assets/fonts/Manrope_700Bold.ttf"),
    Manrope_800ExtraBold: require("../assets/fonts/Manrope_800ExtraBold.ttf"),
    Rosehot: require("../assets/fonts/Rosehot.ttf"),
  });

  useEffect(() => {
    // Initialize RevenueCat SDK early
    if (!rcInitialized) {
      revenueCatService.initialize();
      setRcInitialized(true);
    }

    // Initialize anonymous auth immediately
    if (!isInitialized) {
      useAuth
        .getState()
        .initialize()
        .then(() => {
          // Initialize notifications after auth is ready
          NotificationService.init().then(() => {
            NotificationService.scheduleDailyReminder();
          });
        });
    } else {
      // Auth already initialized (subsequent mounts)
      NotificationService.scheduleDailyReminder();
    }

    // Check for Android Play Store updates (flexible update flow).
    inAppUpdateService.checkAndStartFlexibleUpdate();

    // ── Listen for notification taps ──────────────────────────────
    // When the user taps a push notification (whether the app was in
    // the background or killed), this listener fires and we navigate
    // them to the chat screen so they land in the right place.
    notificationResponseListener.current =
      Notifications.addNotificationResponseReceivedListener((_response) => {
        router.push("/(main)/chat");
      });

    return () => {
      inAppUpdateService.cleanup();
      if (notificationResponseListener.current) {
        notificationResponseListener.current.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Hide splash screen only after auth is initialized AND fonts are loaded
    if (isInitialized && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isInitialized, fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

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
