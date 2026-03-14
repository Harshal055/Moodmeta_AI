import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import { Platform } from "react-native";
import { logger } from "./logger";

/**
 * Notification Service
 * Handles daily companion reminders + challenge + streak nudges.
 */
export class NotificationService {
  private static CHANNEL_ID = "daily-reminders";
  private static CHALLENGE_CHANNEL_ID = "challenge-reminders";

  static async init() {
    try {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
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
        await Notifications.setNotificationChannelAsync(
          this.CHALLENGE_CHANNEL_ID,
          {
            name: "Challenge Reminders",
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 500, 250, 500],
            lightColor: "#6366F1",
          },
        );
      }

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
   * Schedule a companion check-in reminder for 24h from now.
   * Replaces any existing companion reminder.
   */
  static async scheduleDailyReminder(companionName: string = "Your Companion") {
    try {
      // Cancel only companion reminders (tag-based)
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const n of scheduled) {
        if ((n.content.data as any)?.tag === "companion") {
          await Notifications.cancelScheduledNotificationAsync(n.identifier);
        }
      }

      const messages = [
        `Thinking of you! How has your day been? ✨`,
        `It's been a while. Want to talk for a bit? ❤️`,
        `${companionName} is waiting for you. Shall we chat? 😊`,
        `Don't forget to log your mood today! 📊`,
        `A quick check-in can make all the difference. I'm here. 🌿`,
      ];

      await Notifications.scheduleNotificationAsync({
        content: {
          title: companionName,
          body: messages[Math.floor(Math.random() * messages.length)],
          data: { screen: "chat", tag: "companion" },
          sound: true,
        },
        trigger: {
          type: SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 24 * 60 * 60,
          repeats: false,
        } as any,
      });

      logger.info("Daily companion reminder scheduled for 24h from now");
    } catch (err) {
      logger.error("scheduleDailyReminder error:", err);
    }
  }

  /**
   * Schedule a daily 9am challenge reminder.
   * Only schedules if one isn't already set for today.
   */
  static async scheduleChallengeReminder() {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const alreadySet = scheduled.some(
        (n) => (n.content.data as any)?.tag === "challenge",
      );
      if (alreadySet) return;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🎯 Daily Challenge Ready!",
          body: "Your new challenge is waiting. Complete it to earn Karma points! 💎",
          data: { screen: "dashboard", tag: "challenge" },
          sound: true,
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DAILY,
          hour: 9,
          minute: 0,
        } as any,
      });

      logger.info("Daily challenge reminder scheduled for 9am");
    } catch (err) {
      logger.error("scheduleChallengeReminder error:", err);
    }
  }

  /**
   * Schedule a streak protection reminder for 8pm.
   * Reminds the user to take an action before the day ends.
   */
  static async scheduleStreakReminder(streak: number) {
    try {
      if (streak < 2) return; // only nudge if they have something to protect

      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const alreadySet = scheduled.some(
        (n) => (n.content.data as any)?.tag === "streak",
      );
      if (alreadySet) return;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🔥 ${streak}-Day Streak!`,
          body: "Don't break your streak today — complete a challenge to keep it alive! 💪",
          data: { screen: "dashboard", tag: "streak" },
          sound: true,
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DAILY,
          hour: 20,
          minute: 0,
        } as any,
      });

      logger.info(`Streak reminder scheduled (streak: ${streak})`);
    } catch (err) {
      logger.error("scheduleStreakReminder error:", err);
    }
  }

  /**
   * Schedule a mood-aware idle re-engagement notification for 24h from now.
   * Personalizes the message based on the user's last known mood context.
   * Replaces any existing idle reminder.
   */
  static async scheduleMoodAwareCheckIn(
    companionName: string = "Your Companion",
    moodContext?: string,
  ): Promise<void> {
    try {
      // Cancel existing idle notifications
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const n of scheduled) {
        if ((n.content.data as any)?.tag === "companion-idle") {
          await Notifications.cancelScheduledNotificationAsync(n.identifier);
        }
      }

      const moodMessages: Record<string, string[]> = {
        Terrible: [
          `You seemed really down earlier. I've been thinking of you 💙 Want to talk?`,
          `Hey, I've been worried about you. How are you feeling now? 🌸`,
        ],
        Bad: [
          `You had a rough time — wanna check in and see how today's going? 💭`,
          `I've been thinking about you. Feeling any better? 💙`,
        ],
        Okay: [
          `Hey, how's your day going? I'm always here to chat ✨`,
          `${companionName} is thinking of you — let's catch up? 😊`,
        ],
        Good: [`Hey you! Missing our chats 😊 How's life treating you today?`],
        Great: [`Still riding that good mood? 🌊 Come tell me everything ✨`],
      };

      const pool =
        moodContext && moodMessages[moodContext]
          ? moodMessages[moodContext]
          : [
              `${companionName} is thinking of you... how have you been? 💙`,
              `Hey you! It's been a while. Wanna catch up? ✨`,
              `I've been waiting for you. How are you feeling today? 🌸`,
            ];

      const body = pool[Math.floor(Math.random() * pool.length)];

      await Notifications.scheduleNotificationAsync({
        content: {
          title: companionName,
          body,
          data: { screen: "chat", tag: "companion-idle" },
          sound: true,
        },
        trigger: {
          type: SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 24 * 60 * 60,
          repeats: false,
        } as any,
      });

      logger.info("Mood-aware idle check-in scheduled for 24h from now");
    } catch (err) {
      logger.error("scheduleMoodAwareCheckIn error:", err);
    }
  }

  static async cancelAll() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
}
