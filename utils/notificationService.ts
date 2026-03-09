import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import { Platform } from "react-native";
import { logger } from "./logger";

/**
 * Re-engagement Notification Service
 * Schedules a local notification to remind the user to check in.
 */
export class NotificationService {
    private static CHANNEL_ID = "daily-reminders";

    static async init() {
        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== "granted") {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== "granted") {
                logger.warn("Notification permissions not granted");
                return false;
            }

            if (Platform.OS === "android") {
                await Notifications.setNotificationChannelAsync(this.CHANNEL_ID, {
                    name: "Daily Reminders",
                    importance: Notifications.AndroidImportance.DEFAULT,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: "#FF6B9D",
                });
            }

            // Configure behavior
            Notifications.setNotificationHandler({
                handleNotification: async () => ({
                    shouldShowAlert: true,
                    shouldPlaySound: true,
                    shouldSetBadge: true,
                    shouldShowBanner: true,
                    shouldShowList: true,
                }),
            });

            return true;
        } catch (err) {
            logger.error("NotificationService.init error:", err);
            return false;
        }
    }

    /**
     * Schedules a reminder for 24 hours after the last app open.
     * Resets the timer every time the app is opened.
     */
    static async scheduleDailyReminder(companionName: string = "Your Companion") {
        try {
            // Clear all existing reminders first so we only have one
            await Notifications.cancelAllScheduledNotificationsAsync();

            const messages = [
                "Thinking of you! How has your day been? ✨",
                "It's been a while. Want to talk for a bit? ❤️",
                "Your companion is waiting for you. Shall we chat? 😊",
                "Don't forget to log your mood today! 📊",
            ];

            const randomMessage = messages[Math.floor(Math.random() * messages.length)];

            await Notifications.scheduleNotificationAsync({
                content: {
                    title: companionName,
                    body: randomMessage,
                    data: { screen: "chat" },
                    sound: true,
                },
                trigger: {
                    type: SchedulableTriggerInputTypes.TIME_INTERVAL,
                    seconds: 24 * 60 * 60,
                    repeats: false,
                } as any,
            });

            logger.info("Daily reminder scheduled for 24h from now");
        } catch (err) {
            logger.error("scheduleDailyReminder error:", err);
        }
    }
}
