/**
 * Early Access Service
 *
 * Pro feature: beta test new features and companions before general release
 * Manages feature versions and early access enrollment
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "./logger";

export interface BetaFeature {
  id: string;
  name: string;
  description: string;
  version: string; // e.g., "1.5.0-beta"
  release_date: string; // When it will go public
  category: "companion" | "feature" | "enhancement";
  status: "active" | "completed" | "cancelled";
  feedback_url?: string; // Link to feedback form
}

export interface EarlyAccessUser {
  user_id: string;
  enrolled_at: string;
  enrolled_features: string[]; // Feature IDs user is testing
  feedback_count: number;
  opt_out: boolean;
}

class EarlyAccessService {
  private betaFeatures: Map<string, BetaFeature> = new Map();
  private userEnrollment: Map<string, EarlyAccessUser> = new Map();

  // Mock data - in production, fetch from API/Supabase
  private mockBetaFeatures: BetaFeature[] = [
    {
      id: "beta_voice_emotions",
      name: "Emotional Voice Responses",
      description:
        "AI companion expresses emotions through voice pitch and tone variations",
      version: "1.5.0-beta",
      release_date: "2026-05-01",
      category: "enhancement",
      status: "active",
      feedback_url: "https://forms.gle/voice-emotions",
    },
    {
      id: "beta_companion_training",
      name: "Companion Personality Training",
      description:
        "Fine-tune your companion's personality with example conversations",
      version: "1.6.0-beta",
      release_date: "2026-07-01",
      category: "feature",
      status: "active",
      feedback_url: "https://forms.gle/companion-training",
    },
    {
      id: "beta_group_companions",
      name: "Group Chat with Companions",
      description:
        "Chat with multiple companions or friends in a shared conversation",
      version: "2.0.0-beta",
      release_date: "2026-09-01",
      category: "feature",
      status: "active",
      feedback_url: "https://forms.gle/group-chat",
    },
  ];

  async init() {
    // Load beta features
    for (const feature of this.mockBetaFeatures) {
      this.betaFeatures.set(feature.id, feature);
    }
    logger.info("Early Access service initialized");
  }

  /**
   * Get all available beta features
   */
  async getAvailableBetaFeatures(): Promise<BetaFeature[]> {
    return Array.from(this.betaFeatures.values()).filter(
      (f) => f.status === "active",
    );
  }

  /**
   * Check if user has early access enabled
   */
  async hasEarlyAccess(userId: string): Promise<boolean> {
    try {
      // Check if user is opted in to early access
      const enrollment = await this.getUserEnrollment(userId);
      return !enrollment.opt_out;
    } catch (error) {
      logger.error("Failed to check early access:", error);
      return false;
    }
  }

  /**
   * Get or create user enrollment record
   */
  async getUserEnrollment(userId: string): Promise<EarlyAccessUser> {
    if (this.userEnrollment.has(userId)) {
      return this.userEnrollment.get(userId)!;
    }

    try {
      const cached = await AsyncStorage.getItem(`@early_access_${userId}`);

      if (cached) {
        const enrollment = JSON.parse(cached) as EarlyAccessUser;
        this.userEnrollment.set(userId, enrollment);
        return enrollment;
      }

      // Create new enrollment
      const newEnrollment: EarlyAccessUser = {
        user_id: userId,
        enrolled_at: new Date().toISOString(),
        enrolled_features: [],
        feedback_count: 0,
        opt_out: false,
      };

      await AsyncStorage.setItem(
        `@early_access_${userId}`,
        JSON.stringify(newEnrollment),
      );

      this.userEnrollment.set(userId, newEnrollment);
      return newEnrollment;
    } catch (error) {
      logger.error("Failed to get enrollment:", error);
      return {
        user_id: userId,
        enrolled_at: new Date().toISOString(),
        enrolled_features: [],
        feedback_count: 0,
        opt_out: false,
      };
    }
  }

  /**
   * Enroll user in a beta feature
   */
  async enrollInFeature(userId: string, featureId: string): Promise<boolean> {
    try {
      const feature = this.betaFeatures.get(featureId);
      if (!feature || feature.status !== "active") {
        logger.warn(`Invalid or inactive feature: ${featureId}`);
        return false;
      }

      const enrollment = await this.getUserEnrollment(userId);

      if (!enrollment.enrolled_features.includes(featureId)) {
        enrollment.enrolled_features.push(featureId);
        enrollment.enrolled_at = new Date().toISOString();

        await AsyncStorage.setItem(
          `@early_access_${userId}`,
          JSON.stringify(enrollment),
        );

        this.userEnrollment.set(userId, enrollment);

        logger.info(`User ${userId} enrolled in beta feature: ${featureId}`);
        return true;
      }

      return true;
    } catch (error) {
      logger.error("Failed to enroll in feature:", error);
      return false;
    }
  }

  /**
   * Unenroll from a beta feature
   */
  async unenrollFromFeature(
    userId: string,
    featureId: string,
  ): Promise<boolean> {
    try {
      const enrollment = await this.getUserEnrollment(userId);

      const index = enrollment.enrolled_features.indexOf(featureId);
      if (index > -1) {
        enrollment.enrolled_features.splice(index, 1);

        await AsyncStorage.setItem(
          `@early_access_${userId}`,
          JSON.stringify(enrollment),
        );

        this.userEnrollment.set(userId, enrollment);

        logger.info(
          `User ${userId} unenrolled from beta feature: ${featureId}`,
        );
        return true;
      }

      return true;
    } catch (error) {
      logger.error("Failed to unenroll from feature:", error);
      return false;
    }
  }

  /**
   * Check if user has access to specific beta feature
   */
  async hasAccessToFeature(
    userId: string,
    featureId: string,
  ): Promise<boolean> {
    try {
      const hasEarlyAccess = await this.hasEarlyAccess(userId);
      if (!hasEarlyAccess) return false;

      const enrollment = await this.getUserEnrollment(userId);
      return enrollment.enrolled_features.includes(featureId);
    } catch (error) {
      logger.error("Failed to check feature access:", error);
      return false;
    }
  }

  /**
   * Record user feedback on beta feature
   */
  async recordFeedback(
    userId: string,
    featureId: string,
    feedback: string,
    rating: 1 | 2 | 3 | 4 | 5,
  ): Promise<boolean> {
    try {
      // In production, send to backend/analytics
      logger.info(`Feedback for ${featureId}: "${feedback}" (${rating}/5)`);

      const enrollment = await this.getUserEnrollment(userId);
      enrollment.feedback_count += 1;

      await AsyncStorage.setItem(
        `@early_access_${userId}`,
        JSON.stringify(enrollment),
      );

      this.userEnrollment.set(userId, enrollment);

      return true;
    } catch (error) {
      logger.error("Failed to record feedback:", error);
      return false;
    }
  }

  /**
   * Get user's enrolled features with details
   */
  async getUserBetaFeatures(userId: string): Promise<BetaFeature[]> {
    try {
      const enrollment = await this.getUserEnrollment(userId);
      return enrollment.enrolled_features
        .map((id) => this.betaFeatures.get(id))
        .filter((f): f is BetaFeature => f !== undefined);
    } catch (error) {
      logger.error("Failed to get user beta features:", error);
      return [];
    }
  }

  /**
   * Check if feature is in beta (not yet released)
   */
  isFeatureInBeta(feature: BetaFeature): boolean {
    const releaseDate = new Date(feature.release_date);
    return releaseDate > new Date() && feature.status === "active";
  }

  /**
   * Get days until feature public release
   */
  daysUntilRelease(feature: BetaFeature): number {
    const releaseDate = new Date(feature.release_date);
    const now = new Date();
    const days = Math.ceil(
      (releaseDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    return Math.max(0, days);
  }

  /**
   * Opt in/out of early access program
   */
  async setEarlyAccessPreference(
    userId: string,
    optIn: boolean,
  ): Promise<boolean> {
    try {
      const enrollment = await this.getUserEnrollment(userId);
      enrollment.opt_out = !optIn;

      await AsyncStorage.setItem(
        `@early_access_${userId}`,
        JSON.stringify(enrollment),
      );

      this.userEnrollment.set(userId, enrollment);

      logger.info(
        `User ${userId} ${optIn ? "opted in to" : "opted out of"} early access`,
      );
      return true;
    } catch (error) {
      logger.error("Failed to set early access preference:", error);
      return false;
    }
  }
}

export const earlyAccessService = new EarlyAccessService();
