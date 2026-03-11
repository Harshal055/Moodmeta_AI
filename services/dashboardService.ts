import { supabase } from "../lib/supabase";
import { aiMemoryService } from "../utils/aiMemoryService";
import { logger } from "../utils/logger";
import { getMoodAnalytics } from "../utils/moodAnalytics";

export interface DailyChallenge {
    id: string;
    title: string;
    description: string;
    reward: string;
    karmaValue: number;
    type: "wellness" | "action" | "mindfulness";
}

export interface CoachingTip {
    id: string;
    category: string;
    content: string;
}

// 14 challenges — rotates over 2 weeks so no daily repeat
const DAILY_CHALLENGES: DailyChallenge[] = [
    { id: "breath_1", title: "Gentle Breathing", description: "Take 3 slow, deep breaths right now and notice how your body feels.", reward: "+20 Karma", karmaValue: 20, type: "mindfulness" },
    { id: "gratitude_1", title: "Gratitude Moment", description: "Think of one small thing that went well today, no matter how tiny.", reward: "+15 Karma", karmaValue: 15, type: "wellness" },
    { id: "posture_1", title: "Posture Check", description: "Straighten your back and release the tension in your shoulders.", reward: "+10 Karma", karmaValue: 10, type: "wellness" },
    { id: "water_1", title: "Hydration Break", description: "Drink a full glass of water right now. Your mood and brain will thank you.", reward: "+10 Karma", karmaValue: 10, type: "wellness" },
    { id: "walk_1", title: "Mindful Walk", description: "Take a 5-minute walk outside — no phone, just notice what's around you.", reward: "+25 Karma", karmaValue: 25, type: "action" },
    { id: "journal_1", title: "Thought Release", description: "Write down one worry on paper, then fold it away. Let it go with intention.", reward: "+20 Karma", karmaValue: 20, type: "mindfulness" },
    { id: "smile_1", title: "Smile Practice", description: "Hold a genuine smile for 30 seconds. Science says it shifts your mood.", reward: "+10 Karma", karmaValue: 10, type: "wellness" },
    { id: "breathe_478", title: "4-7-8 Breath", description: "Breathe in for 4s, hold for 7s, breathe out for 8s. Repeat 3 times. Instantly calming.", reward: "+20 Karma", karmaValue: 20, type: "mindfulness" },
    { id: "stretch_1", title: "Body Scan Stretch", description: "Stand up, reach your arms wide, and stretch every muscle group for 2 minutes.", reward: "+15 Karma", karmaValue: 15, type: "wellness" },
    { id: "kindness_1", title: "Kindness Act", description: "Send a kind message to someone you haven't spoken to in a while.", reward: "+25 Karma", karmaValue: 25, type: "action" },
    { id: "screen_break", title: "Screen Reset", description: "Look away from all screens and focus on something 20 feet away for 20 seconds.", reward: "+10 Karma", karmaValue: 10, type: "wellness" },
    { id: "affirmation_1", title: "Power Affirmation", description: "Say out loud: \"I am capable, I am growing, and today I choose peace.\"", reward: "+15 Karma", karmaValue: 15, type: "mindfulness" },
    { id: "music_1", title: "Mood Reset Song", description: "Play your favourite uplifting song and let yourself feel it completely.", reward: "+20 Karma", karmaValue: 20, type: "wellness" },
    { id: "meditation_1", title: "2-Minute Stillness", description: "Close your eyes and sit in complete silence for 2 minutes. Notice the peace.", reward: "+20 Karma", karmaValue: 20, type: "mindfulness" },
];

const COACHING_TIPS: CoachingTip[] = [
    { id: "tip_1", category: "Resilience", content: "Connecting with others is key to resilience. Try reaching out to a friend or simply telling me about your day." },
    { id: "tip_2", category: "Self-Care", content: "Hydration impacts your mood more than you think. Have you had a glass of water recently?" },
    { id: "tip_3", category: "Focus", content: "If you're feeling overwhelmed, try the 5-4-3-2-1 technique to ground yourself in the present moment." },
    { id: "tip_4", category: "Sleep", content: "Quality sleep is the single most impactful thing you can do for your mental health. Aim for a consistent bedtime." },
    { id: "tip_5", category: "Mindfulness", content: "You cannot pour from an empty cup. Rest is not laziness — it's maintenance." },
    { id: "tip_6", category: "Growth", content: "Progress, not perfection. One small positive action today compounds into major change over the next month." },
    { id: "tip_7", category: "Anxiety", content: "Box breathing (4s in, hold, 4s out, hold) activates your parasympathetic nervous system in under 60 seconds." },
];

class DashboardService {
    getDailyChallenge(): DailyChallenge {
        const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
        return DAILY_CHALLENGES[dayOfYear % DAILY_CHALLENGES.length];
    }

    getRandomTip(): CoachingTip {
        return COACHING_TIPS[Math.floor(Math.random() * COACHING_TIPS.length)];
    }

    async getMemoryHighlight(userId: string): Promise<string | null> {
        try {
            const memory = await aiMemoryService.getUserMemory(userId);
            if (memory.recent_events && memory.recent_events.length > 0) {
                return memory.recent_events[Math.floor(Math.random() * memory.recent_events.length)];
            }
            return null;
        } catch (error) {
            logger.error("DashboardService: Error fetching memory highlight", error);
            return null;
        }
    }

    async getMoodSnapshot(userId: string) {
        try {
            return await getMoodAnalytics(userId);
        } catch (error) {
            logger.error("DashboardService: Error fetching mood snapshot", error);
            return null;
        }
    }

    async completeChallenge(userId: string, challengeId: string, reward: string) {
        try {
            const challenge = DAILY_CHALLENGES.find(c => c.id === challengeId);
            const karmaValue = challenge?.karmaValue ?? 10;

            const { error } = await (supabase as any).from("user_challenges").insert({
                user_id: userId,
                challenge_id: challengeId,
                karma_earned: karmaValue,
                completed_at: new Date().toISOString(),
            });

            if (error) {
                logger.error("DashboardService: completeChallenge insert failed", error);
                return false;
            }
            return true;
        } catch (error) {
            logger.error("DashboardService: Error completing challenge", error);
            return false;
        }
    }

    async isChallengeCompletedToday(userId: string, challengeId: string) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const { data, error } = await (supabase as any)
                .from("user_challenges")
                .select("id")
                .eq("user_id", userId)
                .eq("challenge_id", challengeId)
                .gte("completed_at", today.toISOString())
                .limit(1);

            if (error) {
                logger.warn("DashboardService: isChallengeCompletedToday error", error);
                return false;
            }
            return data && data.length > 0;
        } catch {
            return false;
        }
    }

    async logWellnessSession(userId: string, type: "breathing" | "meditation", duration: number) {
        try {
            await (supabase as any).from("wellness_logs").insert({
                user_id: userId,
                activity_type: type,
                duration_seconds: duration,
            });

            // Award karma once per activity type per day
            const today = new Date().toISOString().split("T")[0];
            const challengeId = `wellness_${type}_${today}`;
            const alreadyAwarded = await this.isChallengeCompletedToday(userId, challengeId);

            if (!alreadyAwarded) {
                await (supabase as any).from("user_challenges").insert({
                    user_id: userId,
                    challenge_id: challengeId,
                    karma_earned: 5,
                    completed_at: new Date().toISOString(),
                });
            }
            return true;
        } catch (error) {
            logger.error("DashboardService: Error logging wellness session", error);
            return false;
        }
    }

    async getUserStats(userId: string) {
        try {
            const { data: challenges, error } = await (supabase as any)
                .from("user_challenges")
                .select("karma_earned, completed_at")
                .eq("user_id", userId)
                .order("completed_at", { ascending: false });

            if (error) {
                logger.warn("DashboardService: getUserStats error", error);
                return { totalKarma: 0, streak: 0 };
            }

            const totalKarma = (challenges || []).reduce(
                (acc: number, curr: any) => acc + (Number(curr.karma_earned) || 0),
                0
            );

            // Calculate CONSECUTIVE day streak properly
            const streak = this._calculateStreak(challenges || []);

            return { totalKarma, streak };
        } catch (error) {
            logger.error("DashboardService: getUserStats error", error);
            return { totalKarma: 0, streak: 0 };
        }
    }

    /** Count consecutive days with activity counting back from today */
    private _calculateStreak(entries: Array<{ completed_at: string }>): number {
        if (!entries.length) return 0;

        // Get unique days (YYYY-MM-DD in local time)
        const uniqueDays = [...new Set(
            entries
                .map(e => e.completed_at?.split("T")[0])
                .filter(Boolean)
        )].sort().reverse(); // most recent first

        if (!uniqueDays.length) return 0;

        const today = new Date().toISOString().split("T")[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

        // Streak must include today or yesterday to be "active"
        if (uniqueDays[0] !== today && uniqueDays[0] !== yesterday) return 0;

        let streak = 1;
        for (let i = 1; i < uniqueDays.length; i++) {
            const prev = new Date(uniqueDays[i - 1]);
            const curr = new Date(uniqueDays[i]);
            const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);
            if (diffDays === 1) {
                streak++;
            } else {
                break; // gap found — streak ends
            }
        }
        return streak;
    }

    async getUserBadges(userId: string, preFetchedStats?: any) {
        const stats = preFetchedStats || await this.getUserStats(userId);
        const badges = [];
        if (stats.totalKarma >= 50) badges.push({ id: "starter", name: "Early Bird", icon: "🌱" });
        if (stats.totalKarma >= 200) badges.push({ id: "zen", name: "Zen Master", icon: "🧘" });
        if (stats.totalKarma >= 500) badges.push({ id: "healer", name: "Soul Healer", icon: "✨" });
        return badges;
    }

    async getMoodHistory(userId: string) {
        try {
            const { data } = await (supabase as any)
                .from("mood_logs")
                .select("intensity, created_at")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(7);
            return (data || []).reverse();
        } catch {
            return [];
        }
    }

    getEmpathyMessage(intensity: number, companionName: string): string {
        if (intensity >= 8) return `You've been doing great lately, I love seeing you so happy! ✨`;
        if (intensity >= 6) return `I'm here if you want to chat about anything on your mind. 🍵`;
        if (intensity >= 4) return `Everything's going to be okay. Remember to breathe. 🕊️`;
        return `I'm holding space for you today. You're not alone. ❤️`;
    }
}

export const dashboardService = new DashboardService();
