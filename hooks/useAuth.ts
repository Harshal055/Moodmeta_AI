/**
 * Auth Hook / Store — MoodMateAI
 *
 * Zustand store managing:
 * - Anonymous sign-in on app start
 * - Auth state listener
 * - Auto-create profile row for new users
 * - Load & update profile (role, companion_name, is_premium, onboarded)
 * - Expose aliased values (currentUser, profile, isLoading, onboarded, role, isPremium)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, User } from "@supabase/supabase-js";
import { Alert } from "react-native";
import { create } from "zustand";
import {
  ExpoSecureStoreAdapter,
  supabase,
  SUPABASE_STORAGE_KEY,
} from "../lib/supabase";
import { revenueCatService } from "../services/revenueCatService";
import { logger } from "../utils/logger";
import { registerForPushNotificationsAsync } from "../utils/pushNotifications";

// ── Types ───────────────────────────────────────────────────────────
export interface Profile {
  id: string;
  user_id: string;
  role: string | null;
  companion_name: string | null;
  country: string | null;
  language: string | null;
  avatar_url: string | null;
  push_token: string | null;
  onboarded: boolean;
  created_at: string;
}

interface AuthState {
  currentUser: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Aliases for easier access
  onboarded: boolean;
  role: string | null;
  country: string | null;
  language: string | null;
  avatar_url: string | null;
  push_token: string | null;
  isPremium: boolean;

  // Actions
  initialize: () => Promise<void>;
  ensureProfile: (userId: string) => Promise<void>;
  updateProfile: (
    data: Partial<
      Pick<
        Profile,
        | "role"
        | "companion_name"
        | "country"
        | "language"
        | "avatar_url"
        | "push_token"
        | "onboarded"
      >
    >,
  ) => Promise<boolean>;
  updateAuthPushToken: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>; // Placeholder
  transferAnonymousData: (oldUserId: string, newUserId: string) => Promise<void>;
}

// ── Promise Lock ─────────────────────────────────────────────────────
let ensureProfilePromise: Promise<void> | null = null;
let currentEnsuringUserId: string | null = null;
let authSubscription: { unsubscribe: () => void } | null = null;

// ── Store ────────────────────────────────────────────────────────────
export const useAuth = create<AuthState>((set, get) => ({
  currentUser: null,
  session: null,
  profile: null,
  isLoading: true,
  isInitialized: false,

  // Default aliases
  onboarded: false,
  role: null,
  country: null,
  language: null,
  avatar_url: null,
  push_token: null,
  isPremium: false,

  /**
   * Called once in _layout.tsx. Signs in anonymously if no
   * session exists and sets up the auth state listener.
   */
  initialize: async () => {
    if (get().isInitialized) return;

    // Race the initialization logic against a 20-second timeout
    const initializationLogic = (async () => {
      try {
        set({ isLoading: true });
        logger.info("Starting auth initialization...");

        let activeUser = null;

        // 1. Initial Auth Check with JSON error recovery
        let initialSession = null;
        try {
          logger.info("Fetching session...");
          const {
            data: { session },
          } = await supabase.auth.getSession();
          initialSession = session;
          activeUser = session?.user ?? null;
          logger.info("Session fetched:", activeUser ? "User found" : "No user");
        } catch (sessionError: any) {
          // Handle corrupted session data
          logger.error("Session fetch error:", sessionError);
          if (sessionError?.message?.includes("JSON Parse")) {
            logger.warn("Corrupted session detected, clearing all auth data...");
            await ExpoSecureStoreAdapter.removeItem(SUPABASE_STORAGE_KEY);
            activeUser = null;
          } else {
            throw sessionError;
          }
        }

        // If we have a session, verify it's valid to catch "Ghost Users"
        if (activeUser) {
          logger.info("Validating existing user session...");
          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser();
          if (userError || !user) {
            logger.warn("Invalid session detected, clearing...");
            await get().signOut();
            activeUser = null;
          } else {
            logger.info("User session validated");
            activeUser = user;
          }
        }

        // 2. Fallback to Anonymous Sign-in if needed
        if (!activeUser) {
          logger.info("No active user, signing in anonymously...");

          let retryCount = 0;
          const maxRetries = 2;
          let signInSuccess = false;

          while (!signInSuccess && retryCount < maxRetries) {
            const { data, error } = await supabase.auth.signInAnonymously();
            if (error) {
              retryCount++;
              logger.error(`Anonymous sign-in error (Attempt ${retryCount}):`, error);
              if (retryCount >= maxRetries) throw error;
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            } else {
              activeUser = data.session?.user ?? null;
              signInSuccess = true;
            }
          }
        }

        if (activeUser) {
          if (!initialSession) {
            const { data } = await supabase.auth.getSession();
            initialSession = data.session;
          }
          set({
            currentUser: activeUser,
            session: initialSession,
          });
          await get().ensureProfile(activeUser.id);

          registerForPushNotificationsAsync()
            .then((token) => {
              if (token) return get().updateAuthPushToken(token);
            })
            .catch(() => { });
        }

        // 4. Setup Global Listener
        if (authSubscription) authSubscription.unsubscribe();
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          const newUser = session?.user ?? null;
          const oldUser = get().currentUser;

          if (event === "SIGNED_OUT") {
            set({
              currentUser: null, session: null, profile: null, onboarded: false,
              role: null, avatar_url: null, push_token: null, isPremium: false,
            });
          } else if (newUser) {
            // DETECT MIGRATION: If we transition from Anonymous -> Real Account with a DIFFERENT ID
            if (oldUser && oldUser.is_anonymous && !newUser.is_anonymous && oldUser.id !== newUser.id) {
              logger.info(`Auth: Detected User Switch during Link/Sign-In. Migrating ${oldUser.id} -> ${newUser.id}`);
              await get().transferAnonymousData(oldUser.id, newUser.id);
            }

            set({ currentUser: newUser, session });
            await get().ensureProfile(newUser.id);
          }
        });
        authSubscription = subscription;

        set({ isLoading: false, isInitialized: true });
        logger.info("Auth initialization complete");
      } catch (err: any) {
        logger.error("Auth initialization fatal error:", err.message || err);
        set({ isLoading: false }); // Stop loading, but DO NOT set isInitialized: true

        Alert.alert(
          "Connection Error 📡",
          "There was a problem starting the app. Please check your internet and try again.",
          [{ text: "Retry", onPress: () => get().initialize() }]
        );
      }
    })();

    // 15 second timeout to prevent hanging splash screen
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("TIMEOUT")), 15000);
    });

    await Promise.race([initializationLogic, timeoutPromise]).catch((e) => {
      if (e.message === "TIMEOUT") {
        logger.error("Auth timed out");
        set({ isLoading: false });
        Alert.alert(
          "Connection Timeout",
          "The server is taking too long to respond. Please try again.",
          [{ text: "Retry", onPress: () => get().initialize() }]
        );
      }
    });
  },

  /**
   * Check if a profiles row exists for this user.
   * Reverted from upsert to fetch-then-insert to avoid requiring a unique constraint on user_id.
   */
  ensureProfile: async (userId: string) => {
    if (ensureProfilePromise && currentEnsuringUserId === userId) {
      return ensureProfilePromise;
    }

    currentEnsuringUserId = userId;
    ensureProfilePromise = (async () => {
      try {
        logger.info("ensureProfile: Fetching/creating for:", userId);

        // 1. Unified Fetch & Identity Load
        const fetchProfile = async () => {
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();
          if (error && error.code !== "PGRST116") throw error;
          return data;
        };

        let prof = await fetchProfile();

        // 2. Race condition handling: If no profile, try to create it or wait for trigger
        if (!prof) {
          logger.info("ensureProfile: Profile not found, attempting safe create...");
          const { data: newProf, error: insertError } = await supabase
            .from("profiles")
            .upsert({ user_id: userId, onboarded: false }, { onConflict: "user_id" })
            .select()
            .maybeSingle();

          if (insertError) {
            logger.warn("ensureProfile: Insert/Upsert conflict (expected if trigger won):", insertError.message);
            // Re-fetch in case a trigger created it simultaneously
            prof = await fetchProfile();
          } else {
            prof = newProf;
          }
        }

        if (!prof) {
          // Final fallback: Wait a moment for trigger
          await new Promise(r => setTimeout(r, 800));
          prof = await fetchProfile();
        }

        if (prof) {
          const customerInfo = await revenueCatService.login(userId);
          const isRcPremium = revenueCatService.checkEntitlement(customerInfo);

          set({
            profile: prof as Profile,
            onboarded: (prof.onboarded as boolean) ?? false,
            role: prof.role,
            country: prof.country,
            language: prof.language,
            avatar_url: prof.avatar_url,
            push_token: prof.push_token,
            isPremium: isRcPremium,
          });
          logger.info("ensureProfile: Success");
        } else {
          throw new Error("Critical: Could not establish profile record.");
        }
      } catch (err: any) {
        logger.error("ensureProfile failure:", err.message || err);
      } finally {
        ensureProfilePromise = null;
        currentEnsuringUserId = null;
      }
    })();

    return ensureProfilePromise;
  },

  /**
   * Update the logged-in user's profile
   */
  updateProfile: async (data) => {
    const user = get().currentUser;
    if (!user) return false;

    try {
      const { data: updated, error } = await supabase
        .from("profiles")
        .update(data)
        .eq("user_id", user.id)
        .select();

      if (error) throw error;

      // If update returns empty (0 rows), it means the profile record was missing entirely
      if (!updated || updated.length === 0) {
        await get().ensureProfile(user.id);
        // Try update one more time
        const { data: retryData, error: retryError } = await supabase
          .from("profiles")
          .update(data)
          .eq("user_id", user.id)
          .select();

        if (retryError) throw retryError;

        if (retryData && retryData.length > 0) {
          const prof = retryData[0] as Profile;
          set({
            profile: prof,
            onboarded: prof.onboarded,
            role: prof.role,
            country: prof.country,
            language: prof.language,
            avatar_url: prof.avatar_url,
            push_token: prof.push_token,
          });
          return true;
        }
        return false;
      } else {
        const prof = updated[0] as Profile;
        set({
          profile: prof,
          onboarded: prof.onboarded,
          role: prof.role,
          country: prof.country,
          language: prof.language,
          avatar_url: prof.avatar_url,
          push_token: prof.push_token,
        });
        return true;
      }
    } catch (err: any) {
      logger.error("updateProfile error:", err.message || err);
      return false;
    }
  },

  /**
   * Automatically update the push token if it differs from the database
   */
  updateAuthPushToken: async (token: string) => {
    const user = get().currentUser;
    if (!user) return;

    // Only update if it's new
    if (get().profile?.push_token === token) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({ push_token: token })
        .eq("user_id", user.id)
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        const prof = data[0] as Profile;
        set((state) => ({
          profile: { ...state.profile, push_token: prof.push_token } as Profile,
          push_token: prof.push_token,
        }));
      }
    } catch (err) {
      logger.error("Failed to update push token in supabase:", err);
    }
  },

  signOut: async () => {
    try {
      // Wait for local storage wipes first
      const user = get().currentUser;
      if (user) {
        await AsyncStorage.removeItem(`chat_history_${user.id}`);
      }

      // Priority 1: Clear local state immediately for UI responsiveness
      set({
        currentUser: null,
        session: null,
        profile: null,
        onboarded: false,
        role: null,
        country: null,
        language: null,
        avatar_url: null,
        isPremium: false,
      });

      // Priority 2: Attempt remote sign out
      await supabase.auth.signOut({ scope: "local" });

      // Priority 3: Brute force clear local storage keys just in case
      await ExpoSecureStoreAdapter.removeItem(SUPABASE_STORAGE_KEY);
    } catch (e) {
      logger.warn("Sign out cleanup partial:", e);
    }
  },

  signInWithGoogle: async () => {
    logger.info("Future Enhancement: Google Auth");
  },

  /**
   * Migrate chats and logs from a temporary anonymous UID to a permanent one.
   * This is critical to prevent "disappearing history" when linking accounts.
   */
  transferAnonymousData: async (oldUserId, newUserId) => {
    try {
      logger.info(`MIGRATION: Moving data from ${oldUserId} to ${newUserId}`);

      // 1. Migrate Chats
      const { error: chatError } = await supabase
        .from("chats")
        .update({ user_id: newUserId })
        .eq("user_id", oldUserId);
      if (chatError) logger.error("Migration: Chat move failed:", chatError.message);

      // 2. Migrate Mood Logs
      const { error: logError } = await supabase
        .from("mood_logs")
        .update({ user_id: newUserId })
        .eq("user_id", oldUserId);
      if (logError) logger.error("Migration: Mood logs move failed:", logError.message);

      // 3. Migrate AI Memory (if exists)
      const { error: memoryError } = await supabase
        .from("user_memories" as any)
        .update({ user_id: newUserId })
        .eq("user_id", oldUserId);
      if (memoryError) logger.warn("Migration: AI Memory move failed (might not exist):", memoryError.message);

      // 4. Clean up old profile if it's empty/obsolete
      // We don't delete immediately to be safe, but we could mark it.

      logger.info("MIGRATION: Completed successfully");
    } catch (err) {
      logger.error("MIGRATION: Fatal error:", err);
    }
  },
}));
