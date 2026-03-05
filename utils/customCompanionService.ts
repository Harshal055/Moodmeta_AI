/**
 * Custom Companion Service
 *
 * Pro feature: allows users to create and manage custom AI companions
 * Enables custom personality, name, avatar, and conversation style
 */

import { supabase } from "../lib/supabase";
import { logger } from "./logger";

export interface CustomCompanion {
  id: string;
  user_id: string;
  name: string;
  personality_description: string;
  avatar_url?: string | null;
  avatar_emoji?: string;
  tone: "casual" | "formal" | "playful" | "supportive" | "witty";
  specialties: string[]; // e.g., ["motivation", "counseling", "fitness"]
  conversation_style?: string;
  background_story?: string | null;
  created_at: string;
  updated_at?: string;
  is_active: boolean;
}

class CustomCompanionService {
  private companionsCache: Map<string, CustomCompanion[]> = new Map();

  /**
   * Create a new custom companion
   */
  async createCompanion(
    userId: string,
    companionData: Omit<CustomCompanion, "id" | "user_id" | "created_at">,
  ): Promise<CustomCompanion | null> {
    try {
      const newCompanion: CustomCompanion = {
        ...companionData,
        id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        created_at: new Date().toISOString(),
        is_active: true,
      };

      const { error } = await supabase
        .from("custom_companions")
        .insert(newCompanion);

      if (error) throw error;

      // Invalidate cache
      this.companionsCache.delete(userId);

      logger.info(`Created custom companion: ${newCompanion.name}`);
      return newCompanion;
    } catch (error) {
      logger.error("Failed to create companion:", error);
      return null;
    }
  }

  /**
   * Get all custom companions for a user
   */
  async getUserCompanions(userId: string): Promise<CustomCompanion[]> {
    // Check cache first
    if (this.companionsCache.has(userId)) {
      return this.companionsCache.get(userId)!;
    }

    try {
      const { data, error } = await supabase
        .from("custom_companions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const companions = (data || []) as CustomCompanion[];
      this.companionsCache.set(userId, companions);

      return companions;
    } catch (error) {
      logger.error("Failed to fetch user companions:", error);
      return [];
    }
  }

  /**
   * Get a specific companion
   */
  async getCompanion(
    userId: string,
    companionId: string,
  ): Promise<CustomCompanion | null> {
    try {
      const { data, error } = await supabase
        .from("custom_companions")
        .select("*")
        .eq("id", companionId)
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      return (data as CustomCompanion) || null;
    } catch (error) {
      logger.error("Failed to fetch companion:", error);
      return null;
    }
  }

  /**
   * Update custom companion details
   */
  async updateCompanion(
    userId: string,
    companionId: string,
    updates: Partial<Omit<CustomCompanion, "id" | "user_id" | "created_at">>,
  ): Promise<CustomCompanion | null> {
    try {
      const { data, error } = await supabase
        .from("custom_companions")
        .update(updates)
        .eq("id", companionId)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;

      // Invalidate cache
      this.companionsCache.delete(userId);

      logger.info(`Updated companion: ${companionId}`);
      return (data as CustomCompanion) || null;
    } catch (error) {
      logger.error("Failed to update companion:", error);
      return null;
    }
  }

  /**
   * Delete a custom companion
   */
  async deleteCompanion(userId: string, companionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("custom_companions")
        .delete()
        .eq("id", companionId)
        .eq("user_id", userId);

      if (error) throw error;

      // Invalidate cache
      this.companionsCache.delete(userId);

      logger.info(`Deleted companion: ${companionId}`);
      return true;
    } catch (error) {
      logger.error("Failed to delete companion:", error);
      return false;
    }
  }

  /**
   * Set active companion (only one can be active at a time)
   */
  async setActiveCompanion(
    userId: string,
    companionId: string,
  ): Promise<boolean> {
    try {
      // Deactivate all other companions
      const { error: deactivateError } = await supabase
        .from("custom_companions")
        .update({ is_active: false })
        .eq("user_id", userId);

      if (deactivateError) throw deactivateError;

      // Activate the selected one
      const { error: activateError } = await supabase
        .from("custom_companions")
        .update({ is_active: true })
        .eq("id", companionId)
        .eq("user_id", userId);

      if (activateError) throw activateError;

      // Invalidate cache
      this.companionsCache.delete(userId);

      logger.info(`Set active companion: ${companionId}`);
      return true;
    } catch (error) {
      logger.error("Failed to set active companion:", error);
      return false;
    }
  }

  /**
   * Get the currently active companion
   */
  async getActiveCompanion(userId: string): Promise<CustomCompanion | null> {
    try {
      const companions = await this.getUserCompanions(userId);
      const active = companions.find((c) => c.is_active);
      return active || null;
    } catch (error) {
      logger.error("Failed to get active companion:", error);
      return null;
    }
  }

  /**
   * Generate system prompt for custom companion
   * Customizes AI behavior based on companion definition
   */
  generateCompanionSystemPrompt(companion: CustomCompanion): string {
    const parts: string[] = [
      `You are ${companion.name}, a custom AI companion created by the user.`,
      "",
      `Personality & Background:`,
      companion.personality_description,
      "",
      `Conversation Style: ${companion.conversation_style}`,
      `Tone: ${companion.tone}`,
    ];

    if (companion.specialties.length > 0) {
      parts.push(
        `Your specialties include: ${companion.specialties.join(", ")}`,
      );
    }

    if (companion.background_story) {
      parts.push(`Background: ${companion.background_story}`);
    }

    parts.push(
      "",
      "Be authentic, engaging, and maintain this personality consistently.",
    );

    return parts.join("\n");
  }

  /**
   * Check if user can create more companions
   * Free users limited to 1, Pro users unlimited
   */
  async canCreateCompanion(userId: string, isPro: boolean): Promise<boolean> {
    try {
      if (isPro) return true; // No limit for Pro

      const companions = await this.getUserCompanions(userId);
      return companions.length < 1; // Free users limited to 1
    } catch (error) {
      logger.error("Failed to check companion limit:", error);
      return false;
    }
  }

  /**
   * Get companion templates for inspiration
   */
  getCompanionTemplates(): Array<
    Omit<CustomCompanion, "id" | "user_id" | "created_at" | "is_active">
  > {
    return [
      {
        name: "Life Coach",
        personality_description:
          "Motivational and goal-oriented, always encouraging users to reach their potential",
        tone: "supportive",
        specialties: ["motivation", "goal-setting", "accountability"],
        conversation_style:
          "Positive, action-oriented, celebrates small wins and acknowledges challenges",
        background_story:
          "A seasoned coach with 15 years of helping people transform their lives",
      },
      {
        name: "Best Friend",
        personality_description:
          "Casual, fun, and deeply empathetic - like talking to your closest friend",
        tone: "playful",
        specialties: ["venting", "advice", "humor"],
        conversation_style:
          "Relaxed, uses humor appropriately, genuinely cares about your wellbeing",
        background_story: "Your ride-or-die friend who knows you inside out",
      },
      {
        name: "Wellness Expert",
        personality_description:
          "Knowledgeable about mental health, fitness, nutrition, and holistic wellness",
        tone: "supportive",
        specialties: ["mental-health", "fitness", "nutrition", "mindfulness"],
        conversation_style:
          "Informative yet accessible, evidence-based recommendations, non-judgmental",
        background_story:
          "Certified wellness coach passionate about helping others live their best lives",
      },
      {
        name: "Creative Muse",
        personality_description:
          "Imaginative, artistic, and inspiring creativity",
        tone: "witty",
        specialties: ["creativity", "writing", "brainstorming", "art"],
        conversation_style:
          "Poetic, thought-provoking, encourages creative exploration",
        background_story:
          "An artist and writer who believes everyone has creative potential",
      },
    ];
  }
}

export const customCompanionService = new CustomCompanionService();
