/**
 * Feature Flags for MoodMateAI Pro
 *
 * Centralized system to enable/disable features based on subscription tier
 */

export type ProFeature =
  | "voiceMessages"
  | "moodAnalytics"
  | "chatExport"
  | "skipAds"
  | "aiMemory"
  | "customCompanion"
  | "offlineChat"
  | "earlyAccess"
  | "wellnessResources"
  | "priorityAccess";

interface FeatureData {
  name: string;
  description: string;
  tier: "free" | "pro";
}

export const FEATURES: Record<ProFeature, FeatureData> = {
  voiceMessages: {
    name: "Voice Companion Messages",
    description: "AI responses with natural emotional voice",
    tier: "pro",
  },
  moodAnalytics: {
    name: "Mood Analytics Dashboard",
    description: "Track mood trends and emotional insights",
    tier: "pro",
  },
  chatExport: {
    name: "Export Chat History",
    description: "Download conversations as PDF or text",
    tier: "pro",
  },
  skipAds: {
    name: "Zero Ads",
    description: "Ad-free experience",
    tier: "pro",
  },
  aiMemory: {
    name: "AI Memory & Continuity",
    description: "Companion remembers your preferences and details",
    tier: "pro",
  },
  customCompanion: {
    name: "Custom Companion Creation",
    description: "Create your own AI companion with custom personality",
    tier: "pro",
  },
  offlineChat: {
    name: "Offline Chat Mode",
    description: "Chat offline, sync when back online",
    tier: "pro",
  },
  earlyAccess: {
    name: "Early Access to Features",
    description: "Beta test new companions and features first",
    tier: "pro",
  },
  wellnessResources: {
    name: "Wellness Resources",
    description: "Curated mental health articles and guided audios",
    tier: "pro",
  },
  priorityAccess: {
    name: "Priority Response Speed",
    description: "Faster AI response times (1-2 sec vs 3-5 sec)",
    tier: "pro",
  },
};

/**
 * Check if a feature is enabled for the current user
 * @param feature - Feature to check
 * @param isPro - Is user a Pro subscriber
 * @returns boolean - Feature enabled?
 */
export const isFeatureEnabled = (
  feature: ProFeature,
  isPro: boolean,
): boolean => {
  const featureConfig = FEATURES[feature];
  if (!featureConfig) {
    console.warn(`Unknown feature: ${feature}`);
    return false;
  }

  // Pro features require Pro subscription
  if (featureConfig.tier === "pro") {
    return isPro;
  }

  // Free features available to all
  return true;
};

/**
 * Get all Pro features (for paywall display)
 */
export const getProFeatures = (): ProFeature[] => {
  return Object.keys(FEATURES).filter(
    (key) => FEATURES[key as ProFeature].tier === "pro",
  ) as ProFeature[];
};

/**
 * Get all features with details
 */
export const getAllFeatures = () => FEATURES;

export default {
  FEATURES,
  isFeatureEnabled,
  getProFeatures,
  getAllFeatures,
};
