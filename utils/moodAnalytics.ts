/**
 * Mood Analytics Service
 *
 * Tracks user mood data and generates insights/trends
 * Pro feature only
 */

import { supabase } from "../lib/supabase";
import { logger } from "./logger";

export interface MoodEntry {
  date: string; // YYYY-MM-DD
  mood: string; // "happy", "sad", "anxious", etc.
  intensity: number; // 1-10
  context?: string;
}

export interface MoodInsights {
  totalEntries: number;
  mostCommonMood: string;
  moodTrend: MoodEntry[];
  averageIntensity: number;
  weeklyPattern: Record<string, number>; // Day of week -> avg mood intensity
  improvementTrend: "improving" | "declining" | "stable";
}

/**
 * Get last 30 days of mood data for analytics
 */
export const getMoodAnalytics = async (
  userId: string,
): Promise<MoodInsights | null> => {
  try {
    // Get last 30 days of mood entries
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: moods, error } = await supabase
      .from("profiles")
      .select("id, mood, created_at")
      .eq("user_id", userId)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Error fetching mood data:", error);
      return null;
    }

    if (!moods || moods.length === 0) {
      logger.warn("No mood data found");
      return null;
    }

    // Process mood data
    const moodEntries: MoodEntry[] = moods.map((m: any) => ({
      date: new Date(m.created_at).toISOString().split("T")[0],
      mood: m.mood || "neutral",
      intensity: 5, // Default, would come from database if tracked
    }));

    // Calculate insights
    const mostCommonMood = getMostCommonMood(moodEntries);
    const weeklyPattern = getWeeklyPattern(moodEntries);
    const improvementTrend = calculateTrend(moodEntries);
    const averageIntensity =
      moodEntries.reduce((sum, m) => sum + m.intensity, 0) / moodEntries.length;

    return {
      totalEntries: moodEntries.length,
      mostCommonMood,
      moodTrend: moodEntries,
      averageIntensity,
      weeklyPattern,
      improvementTrend,
    };
  } catch (error: any) {
    logger.error("Error in getMoodAnalytics:", error.message);
    return null;
  }
};

/**
 * Get most common mood from entries
 */
const getMostCommonMood = (entries: MoodEntry[]): string => {
  if (entries.length === 0) return "neutral";

  const moodCounts = entries.reduce(
    (acc, entry) => {
      acc[entry.mood] = (acc[entry.mood] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    Object.entries(moodCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ||
    "neutral"
  );
};

/**
 * Get mood pattern by day of week
 */
const getWeeklyPattern = (entries: MoodEntry[]): Record<string, number> => {
  const daysOfWeek = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const pattern: Record<string, number> = {};

  entries.forEach((entry) => {
    const date = new Date(entry.date);
    const dayName = daysOfWeek[date.getDay()];
    pattern[dayName] = (pattern[dayName] || 0) + entry.intensity;
  });

  // Average out by day
  Object.keys(pattern).forEach((day) => {
    const count = entries.filter((e) => {
      const d = new Date(e.date);
      return daysOfWeek[d.getDay()] === day;
    }).length;
    pattern[day] = count > 0 ? pattern[day] / count : 0;
  });

  return pattern;
};

/**
 * Calculate mood improvement trend
 */
const calculateTrend = (
  entries: MoodEntry[],
): "improving" | "declining" | "stable" => {
  if (entries.length < 7) return "stable";

  const firstWeek =
    entries.slice(0, 7).reduce((sum, e) => sum + e.intensity, 0) / 7;
  const lastWeek =
    entries
      .slice(Math.max(0, entries.length - 7))
      .reduce((sum, e) => sum + e.intensity, 0) / 7;

  const diff = lastWeek - firstWeek;

  if (Math.abs(diff) < 1) return "stable";
  return diff > 0 ? "improving" : "declining";
};

/**
 * Log a mood entry
 */
export const logMood = async (
  userId: string,
  mood: string,
  intensity: number,
  context?: string,
): Promise<boolean> => {
  try {
    const { error } = await supabase.from("mood_logs").insert({
      user_id: userId,
      mood_score: intensity,
      notes: context || `Mood: ${mood}`,
    });

    if (error) {
      logger.error("Error logging mood:", error);
      return false;
    }

    logger.info(`Mood logged: ${mood} (${intensity}/10)`);
    return true;
  } catch (error: any) {
    logger.error("Error in logMood:", error.message);
    return false;
  }
};

export default {
  getMoodAnalytics,
  logMood,
};
