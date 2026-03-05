import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "../lib/supabase";
import { logger } from "./logger";

export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  let token: string | null = null;

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    if (!Device.isDevice) {
      logger.info(
        "Push notifications: Emulator/Simulator detected, skipping token request",
      );
      return null;
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    } else {
    }

    if (finalStatus !== "granted") {
      logger.warn("Failed to get push token: permission denied");
      return null;
    }

    // Get the EAS project ID explicitly, or fallback to the Expo manifest ID
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    if (!projectId) {
      logger.warn(
        "Project ID not found. Ensure app.json has expo.extra.eas.projectId",
      );
      return null;
    }

    const pushTokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    token = pushTokenData.data;
  } catch (e: any) {
    const message = typeof e?.message === "string" ? e.message : "";
    const isExpectedConfigError =
      message.includes("Fetching the token failed") ||
      message.includes("valid API key") ||
      message.includes("Firebase") ||
      message.includes("FCM");

    // Graceful degradation: If Firebase/FCM isn't configured correctly,
    // the app can still work without push notifications.
    if (isExpectedConfigError) {
      logger.warn(
        "Push notifications unavailable: Firebase not configured properly. " +
          "To enable push notifications, add a valid google-services.json file. " +
          "See: https://docs.expo.dev/push-notifications/fcm-credentials/",
      );
      return null;
    }

    logger.error("Unexpected push notification registration error:", e);
    return null; // App continues without push token
  }

  return token;
}

/**
 * Store or update the push token in the user's profile with a timestamp
 * Call this after successfully getting a push token
 */
export async function storePushTokenInDB(
  userId: string,
  pushToken: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({
        push_token: pushToken,
        push_token_updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      logger.error("Error storing push token:", error.message);
    } else {
      logger.info("Push token stored in DB");
    }
  } catch (e) {
    logger.error("Error updating push token:", e);
  }
}

/**
 * Mark a push token as invalid and remove it from the database
 * Call this when you get an ExpoPushTicket error for an invalid token
 */
export async function invalidatePushToken(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({
        push_token: null,
        push_token_updated_at: null,
      })
      .eq("user_id", userId);

    if (error) {
      logger.error("Error invalidating push token:", error.message);
    } else {
      logger.info("Invalid push token removed from DB");
    }
  } catch (e) {
    logger.error("Error invalidating push token:", e);
  }
}
