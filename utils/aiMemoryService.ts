/**
 * AI Memory Service
 *
 * Tracks user preferences, personality traits, and conversation context
 * Pro feature: AI remembers user details across sessions
 */

import { supabase } from "../lib/supabase";
import { logger } from "./logger";

export interface UserMemory {
  user_id: string;
  // Personal info
  name?: string | null;
  age?: number | null;
  interests: string[];
  // Emotional preferences
  preferred_tone: string;
  sensitivity_level: string;
  // Context
  current_mood?: string | null;
  recent_events: string[];
  // Relationship
  relationship_length_days?: number;
  favorite_topics: string[];
  // Meta
  created_at: string;
  last_updated: string;
}

class AIMemoryService {
  private memoryCache: Map<string, UserMemory> = new Map();

  /**
   * Get or create user memory
   */
  async getUserMemory(userId: string): Promise<UserMemory> {
    // Check cache first
    if (this.memoryCache.has(userId)) {
      return this.memoryCache.get(userId)!;
    }

    try {
      // Check database
      const { data: existing } = await supabase
        .from("user_memories")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (existing) {
        this.memoryCache.set(userId, existing as UserMemory);
        return existing;
      }

      // Create new memory record
      const newMemory: UserMemory = {
        user_id: userId,
        interests: [],
        preferred_tone: "friendly",
        sensitivity_level: "medium",
        recent_events: [],
        relationship_length_days: 0,
        favorite_topics: [],
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      };

      const { error } = await supabase.from("user_memories").insert(newMemory);

      if (error) throw error;

      this.memoryCache.set(userId, newMemory);
      return newMemory;
    } catch (error) {
      logger.error("Failed to get user memory:", error);
      // Return default memory on error
      return {
        user_id: userId,
        interests: [],
        preferred_tone: "friendly",
        sensitivity_level: "medium",
        recent_events: [],
        relationship_length_days: 0,
        favorite_topics: [],
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      };
    }
  }

  /**
   * Record user's interest or preference
   */
  async recordInterest(userId: string, interest: string) {
    try {
      const memory = await this.getUserMemory(userId);

      if (!memory.interests.includes(interest)) {
        memory.interests.push(interest);
        memory.last_updated = new Date().toISOString();

        const { error } = await supabase
          .from("user_memories")
          .update({
            interests: memory.interests,
            last_updated: memory.last_updated,
          })
          .eq("user_id", userId);

        if (error) throw error;

        this.memoryCache.set(userId, memory);
        logger.info(`Recorded interest: ${interest}`);
      }
    } catch (error) {
      logger.error("Failed to record interest:", error);
    }
  }

  /**
   * Record a significant event or conversation topic
   */
  async recordEvent(userId: string, event: string) {
    try {
      const memory = await this.getUserMemory(userId);

      memory.recent_events.push(event);
      // Keep only last 10 events
      if (memory.recent_events.length > 10) {
        memory.recent_events = memory.recent_events.slice(-10);
      }
      memory.last_updated = new Date().toISOString();

      const { error } = await supabase
        .from("user_memories")
        .update({
          recent_events: memory.recent_events,
          last_updated: memory.last_updated,
        })
        .eq("user_id", userId);

      if (error) throw error;

      this.memoryCache.set(userId, memory);
    } catch (error) {
      logger.error("Failed to record event:", error);
    }
  }

  /**
   * Record favorite conversation topics
   */
  async recordFavoriteTopic(userId: string, topic: string) {
    try {
      const memory = await this.getUserMemory(userId);

      if (!memory.favorite_topics.includes(topic)) {
        memory.favorite_topics.push(topic);
        // Keep top 5 topics
        if (memory.favorite_topics.length > 5) {
          memory.favorite_topics = memory.favorite_topics.slice(-5);
        }
        memory.last_updated = new Date().toISOString();

        const { error } = await supabase
          .from("user_memories")
          .update({
            favorite_topics: memory.favorite_topics,
            last_updated: memory.last_updated,
          })
          .eq("user_id", userId);

        if (error) throw error;

        this.memoryCache.set(userId, memory);
      }
    } catch (error) {
      logger.error("Failed to record favorite topic:", error);
    }
  }

  /**
   * Update user's current mood in memory
   */
  async recordCurrentMood(userId: string, mood: string) {
    try {
      const memory = await this.getUserMemory(userId);
      memory.current_mood = mood;
      memory.last_updated = new Date().toISOString();

      const { error } = await supabase
        .from("user_memories")
        .update({
          current_mood: mood,
          last_updated: memory.last_updated,
        })
        .eq("user_id", userId);

      if (error) throw error;

      this.memoryCache.set(userId, memory);
    } catch (error) {
      logger.error("Failed to record mood:", error);
    }
  }

  /**
   * Update personal preferences
   */
  async updatePreferences(
    userId: string,
    tone: UserMemory["preferred_tone"],
    sensitivity: UserMemory["sensitivity_level"],
  ) {
    try {
      const memory = await this.getUserMemory(userId);
      memory.preferred_tone = tone;
      memory.sensitivity_level = sensitivity;
      memory.last_updated = new Date().toISOString();

      const { error } = await supabase
        .from("user_memories")
        .update({
          preferred_tone: tone,
          sensitivity_level: sensitivity,
          last_updated: memory.last_updated,
        })
        .eq("user_id", userId);

      if (error) throw error;

      this.memoryCache.set(userId, memory);
    } catch (error) {
      logger.error("Failed to update preferences:", error);
    }
  }

  /**
   * Generate system prompt enhancement based on user memory
   * This is used to personalize AI responses
   */
  async getMemoryPrompt(userId: string): Promise<string> {
    try {
      const memory = await this.getUserMemory(userId);

      const parts: string[] = [];

      if (memory.name) {
        parts.push(`The user's name is ${memory.name}.`);
      }

      if (memory.interests.length > 0) {
        parts.push(`User's interests: ${memory.interests.join(", ")}.`);
      }

      if (memory.current_mood) {
        parts.push(`User is currently feeling: ${memory.current_mood}.`);
      }

      if (memory.favorite_topics.length > 0) {
        parts.push(
          `Topics user loves discussing: ${memory.favorite_topics.join(", ")}.`,
        );
      }

      if (memory.recent_events.length > 0) {
        const recentContext = memory.recent_events.slice(-3).join(" | ");
        parts.push(`Recent context: ${recentContext}`);
      }

      parts.push(
        `Preferred tone: ${memory.preferred_tone}. Sensitivity level: ${memory.sensitivity_level}.`,
      );

      return parts.join(" ");
    } catch (error) {
      logger.error("Failed to get memory prompt:", error);
      return "";
    }
  }

  /**
   * Clear user memory (for privacy/reset)
   */
  async clearMemory(userId: string) {
    try {
      await supabase.from("user_memories").delete().eq("user_id", userId);
      this.memoryCache.delete(userId);
      logger.info(`Cleared memory for user: ${userId}`);
    } catch (error) {
      logger.error("Failed to clear memory:", error);
    }
  }

  /**
   * Get relationship duration in days
   */
  async getRelationshipDays(userId: string): Promise<number> {
    try {
      const memory = await this.getUserMemory(userId);
      const startDate = new Date(memory.created_at);
      const now = new Date();
      const days = Math.floor(
        (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      return days;
    } catch (error) {
      logger.error("Failed to get relationship days:", error);
      return 0;
    }
  }
}

export const aiMemoryService = new AIMemoryService();
