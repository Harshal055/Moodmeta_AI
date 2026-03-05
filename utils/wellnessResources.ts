/**
 * Wellness Resources
 *
 * Mental health articles, tips, and guided exercises
 * Pro feature only
 */

export interface WellnessResource {
  id: string;
  title: string;
  category: "article" | "exercise" | "tip" | "guide";
  description: string;
  content: string;
  duration?: number; // minutes
  difficulty?: "beginner" | "intermediate" | "advanced";
  tags: string[];
}

export const WELLNESS_RESOURCES: WellnessResource[] = [
  {
    id: "anxiety-breathing",
    title: "5-4-3 Breathing for Anxiety",
    category: "exercise",
    description: "Quick breathing technique to calm anxiety in 2 minutes",
    content: `1. Breathe in for 5 counts
2. Hold for 4 counts
3. Exhale for 3 counts
4. Repeat 5-10 times

This activates your parasympathetic nervous system, helping you relax.`,
    duration: 2,
    difficulty: "beginner",
    tags: ["anxiety", "stress", "breathing"],
  },
  {
    id: "sleep-hygiene",
    title: "Better Sleep Habits",
    category: "guide",
    description: "Science-backed tips for better sleep quality",
    content: `1. Consistent bedtime (even weekends)
2. Dark, cool room (65-68°F)
3. No screens 1 hour before bed
4. Avoid caffeine after 2 PM
5. Exercise daily (but not before bed)
6. Limit naps to 20 minutes

Track how these affect your mood over 2 weeks!`,
    difficulty: "beginner",
    tags: ["sleep", "wellness", "routine"],
  },
  {
    id: "gratitude-practice",
    title: "Daily Gratitude Practice",
    category: "exercise",
    description: "Shift your mood with a 5-minute gratitude exercise",
    content: `1. Find a quiet place
2. Write down 3 things you're grateful for
3. For each, explain why it matters to you
4. Spend 1 minute reflecting on each

Science shows this rewires your brain toward positivity.`,
    duration: 5,
    difficulty: "beginner",
    tags: ["mindfulness", "gratitude", "mental-health"],
  },
  {
    id: "stress-management",
    title: "Understanding Stress",
    category: "article",
    description: "Learn how stress affects your body and mind",
    content: `Stress is your body's fight-or-flight response. While useful in short bursts, chronic stress can:
- Weaken your immune system
- Increase anxiety and depression
- Disrupt sleep
- Cause physical aches

The good news? Regular exercise, meditation, and good sleep can reduce stress significantly.`,
    tags: ["stress", "mental-health", "education"],
  },
  {
    id: "body-scan",
    title: "Progressive Body Scan",
    category: "exercise",
    description: "Relax your body and mind with this guided scan",
    content: `1. Lie down comfortably
2. Close your eyes
3. Focus on your toes - relax them
4. Move up: feet, ankles, calves, thighs
5. Torso, arms, shoulders, neck, face
6. Breathe and enjoy the calm

Perfect before bed or when anxious.`,
    duration: 10,
    difficulty: "beginner",
    tags: ["relaxation", "mindfulness", "sleep"],
  },
  {
    id: "mood-tracking",
    title: "Why Track Your Mood",
    category: "guide",
    description: "Understand patterns in your emotional well-being",
    content: `Tracking mood helps you:
- Identify triggers (what makes you sad/happy?)
- Notice patterns (better on weekends? mornings?)
- Celebrate progress
- Make informed decisions

Your Pro analytics dashboard does this automatically!`,
    tags: ["mood-tracking", "self-awareness", "wellness"],
  },
];

/**
 * Get resources by category
 */
export const getResourcesByCategory = (
  category: WellnessResource["category"],
): WellnessResource[] => {
  return WELLNESS_RESOURCES.filter((r) => r.category === category);
};

/**
 * Search resources
 */
export const searchResources = (query: string): WellnessResource[] => {
  const lowerQuery = query.toLowerCase();
  return WELLNESS_RESOURCES.filter(
    (r) =>
      r.title.toLowerCase().includes(lowerQuery) ||
      r.description.toLowerCase().includes(lowerQuery) ||
      r.tags.some((t) => t.toLowerCase().includes(lowerQuery)),
  );
};

/**
 * Get resource by ID
 */
export const getResource = (id: string): WellnessResource | null => {
  return WELLNESS_RESOURCES.find((r) => r.id === id) || null;
};

/**
 * Get all tags
 */
export const getAllTags = (): string[] => {
  const tags = new Set<string>();
  WELLNESS_RESOURCES.forEach((r) => {
    r.tags.forEach((t) => tags.add(t));
  });
  return Array.from(tags).sort();
};

/**
 * Get recommended resources based on user mood
 */
export const getRecommendedResources = (
  userMood: string,
): WellnessResource[] => {
  const moodMap: Record<string, string[]> = {
    happy: ["gratitude-practice", "mood-tracking"],
    sad: ["body-scan", "breathing-exercise"],
    anxious: ["anxiety-breathing", "body-scan"],
    stressed: ["stress-management", "anxiety-breathing"],
    tired: ["sleep-hygiene", "body-scan"],
  };

  const recommendedIds = moodMap[userMood.toLowerCase()] || [
    "gratitude-practice",
    "body-scan",
  ];

  return recommendedIds
    .map((id) => getResource(id))
    .filter((r) => r !== null) as WellnessResource[];
};

export default {
  WELLNESS_RESOURCES,
  getResourcesByCategory,
  searchResources,
  getResource,
  getAllTags,
  getRecommendedResources,
};
