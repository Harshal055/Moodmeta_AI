import { supabase } from "../lib/supabase";
import { logger } from "../utils/logger";

export type LeaderboardPeriod = "weekly" | "monthly" | "alltime";

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  karma: number;
  isMe: boolean;
}

export interface UserKarmaSummary {
  currentKarma: number;
  todayGain: number;
}

class LeaderboardService {
  async getLeaderboard(
    userId: string,
    period: LeaderboardPeriod,
    limit = 50,
  ): Promise<LeaderboardEntry[]> {
    try {
      const { data, error } = await (supabase as any).rpc("get_leaderboard", {
        p_period: period,
        p_user_id: userId,
        p_limit: limit,
      });

      if (error) {
        logger.error("LeaderboardService: get_leaderboard RPC failed", error);
        return [];
      }

      return ((data || []) as any[]).map((row) => ({
        rank: Number(row.rank || 0),
        displayName: String(row.display_name || "Anonymous"),
        karma: Number(row.karma || 0),
        isMe: Boolean(row.is_me),
      }));
    } catch (err) {
      logger.error("LeaderboardService: Unexpected leaderboard error", err);
      return [];
    }
  }

  async getUserKarmaSummary(
    userId: string,
    period: LeaderboardPeriod,
  ): Promise<UserKarmaSummary> {
    try {
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      // Monday as the start of week for consistency with weekly reset.
      const weekStart = new Date(now);
      const day = weekStart.getDay();
      const diffToMonday = (day + 6) % 7;
      weekStart.setDate(weekStart.getDate() - diffToMonday);
      weekStart.setHours(0, 0, 0, 0);

      const [profileRes, todayRes] = await Promise.all([
        (supabase as any)
          .from("profiles")
          .select("karma, weekly_karma")
          .eq("user_id", userId)
          .maybeSingle(),
        (supabase as any)
          .from("user_challenges")
          .select("karma_earned, completed_at")
          .eq("user_id", userId),
      ]);

      if (profileRes.error) {
        logger.error(
          "LeaderboardService: profile query failed for karma summary",
          profileRes.error,
        );
      }

      if (todayRes.error) {
        logger.error(
          "LeaderboardService: today karma query failed",
          todayRes.error,
        );
      }

      const profile = profileRes.data || {};
      const challengeRows = (todayRes.data || []) as Array<{
        karma_earned: number | null;
        completed_at: string | null;
      }>;

      const alltimeFromChallenges = challengeRows.reduce(
        (sum, row) => sum + Number(row.karma_earned || 0),
        0,
      );

      const weeklyFromChallenges = challengeRows.reduce((sum, row) => {
        if (!row.completed_at) return sum;
        const completedAt = new Date(row.completed_at);
        if (completedAt >= weekStart) {
          return sum + Number(row.karma_earned || 0);
        }
        return sum;
      }, 0);

      const todayGain = challengeRows.reduce((sum, row) => {
        if (!row.completed_at) return sum;
        const completedAt = new Date(row.completed_at);
        if (completedAt >= today) {
          return sum + Number(row.karma_earned || 0);
        }
        return sum;
      }, 0);

      const currentKarma =
        period === "weekly"
          ? Math.max(
              Number(profile.weekly_karma || 0),
              Number(weeklyFromChallenges || 0),
            )
          : Math.max(
              Number(profile.karma || 0),
              Number(alltimeFromChallenges || 0),
            );

      return { currentKarma, todayGain };
    } catch (err) {
      logger.error("LeaderboardService: user karma summary failed", err);
      return { currentKarma: 0, todayGain: 0 };
    }
  }
}

export const leaderboardService = new LeaderboardService();
