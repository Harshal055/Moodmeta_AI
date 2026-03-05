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
  ) => Promise<void>;
  updateAuthPushToken: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>; // Placeholder
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

    // Add a safety timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      logger.error("Auth initialization timeout - forcing completion");
      set({ isLoading: false, isInitialized: true });
    }, 10000); // 10 second timeout

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
          // Clear SecureStore manually
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
          await get().signOut(); // Clears everything locally and remotely
          activeUser = null;
        } else {
          logger.info("User session validated");
          activeUser = user;
        }
      }

      // 2. Fallback to Anonymous Sign-in if needed
      if (!activeUser) {
        logger.info("No active user, signing in anonymously...");
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
          logger.error("Anonymous sign-in error:", error);
          throw error;
        }
        activeUser = data.session?.user ?? null;
        logger.info("Anonymous sign-in successful");
      }

      // 3. Set Initial State (reuse session from step 1, avoid double getSession)
      if (activeUser) {
        logger.info("Setting up user state...");
        // If we signed in anonymously, fetch the fresh session
        if (!initialSession) {
          const { data } = await supabase.auth.getSession();
          initialSession = data.session;
        }
        set({
          currentUser: activeUser,
          session: initialSession,
        });
        logger.info("Ensuring profile exists...");
        await get().ensureProfile(activeUser.id);
        logger.info("Profile setup complete");

        // Register for push notifications and save to Supabase (non-blocking)
        logger.info("Registering for push notifications...");
        registerForPushNotificationsAsync()
          .then((token) => {
            if (token) {
              logger.info("Push token received, updating profile");
              return get().updateAuthPushToken(token);
            }
          })
          .catch((pushErr) => {
            logger.warn("Push token registration skipped:", pushErr);
          });
      }

      // 4. Setup Global Listener for subsequent changes
      logger.info("Setting up auth state listener...");
      // Unsubscribe previous listener to prevent leaks
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        const user = session?.user ?? null;
        if (event === "SIGNED_OUT") {
          set({
            currentUser: null,
            session: null,
            profile: null,
            onboarded: false,
            role: null,
            avatar_url: null,
            push_token: null,
            isPremium: false,
          });
        } else if (user) {
          set({ currentUser: user, session });
          await get().ensureProfile(user.id);

          // Register for push on sign in as well (non-blocking)
          try {
            const token = await registerForPushNotificationsAsync();
            if (token) await get().updateAuthPushToken(token);
          } catch (pushErr) {
            logger.warn("Push token registration skipped:", pushErr);
          }
        }
      });
      authSubscription = subscription;
    } catch (err: any) {
      logger.error("Auth initialization failure:", err.message || err);

      // If it's a JSON Parse error from Supabase fetch, it's the Cloudflare 525 issue from the India outage
      if (err.message && err.message.includes("JSON Parse error")) {
        Alert.alert(
          "Network Outage 📡",
          "Unable to connect to MoodMate AI servers. If you are in India, this is due to an ongoing network outage with our database provider (Supabase).\n\nPlease try using a VPN, changing your DNS to 1.1.1.1, or trying again later.",
        );
      }
    } finally {
      clearTimeout(timeoutId); // Clear the safety timeout
      logger.info("Auth initialization complete");
      set({ isLoading: false, isInitialized: true });
    }
  },

  /**
   * Check if a profiles row exists for this user.
   * Reverted from upsert to fetch-then-insert to avoid requiring a unique constraint on user_id.
   */
  ensureProfile: async (userId: string) => {
    if (ensureProfilePromise && currentEnsuringUserId === userId) {
      logger.info("ensureProfile: Reusing existing promise");
      return ensureProfilePromise; // deduplicate concurrent calls
    }

    logger.info("ensureProfile: Starting for user:", userId);
    currentEnsuringUserId = userId;
    ensureProfilePromise = (async () => {
      try {
        // 1. Try to load existing profile
        logger.info("ensureProfile: Fetching profile from DB");
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", userId)
          .limit(1);

        if (error) {
          logger.error("ensureProfile: DB error:", error);
          throw error;
        }

        if (data && data.length > 0) {
          logger.info("ensureProfile: Profile found, logging into RevenueCat");
          const prof = data[0] as Profile;

          // Login to RevenueCat and check entitlement
          const customerInfo = await revenueCatService.login(userId);
          const isRcPremium = revenueCatService.checkEntitlement(customerInfo);

          logger.info("ensureProfile: Setting profile state");
          set({
            profile: prof,
            onboarded: prof.onboarded,
            role: prof.role,
            country: prof.country,
            language: prof.language,
            avatar_url: prof.avatar_url,
            push_token: prof.push_token,
            isPremium: isRcPremium, // Override DB with RC truth
          });

          logger.info("ensureProfile: Complete");
          return;
        }

        // 2. No profile yet -> Wait a bit for trigger to create it (if using trigger)
        // Or try to insert manually (if using RLS policies only)
        logger.info("ensureProfile: Profile not found, waiting for trigger...");
        await new Promise((resolve) => setTimeout(resolve, 500)); // Give trigger time to create profile

        logger.info("ensureProfile: Retrying profile fetch");
        const { data: retryData, error: retryError } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", userId)
          .limit(1);

        if (retryError) {
          logger.error("ensureProfile: Retry error:", retryError);
          throw retryError;
        }

        if (retryData && retryData.length > 0) {
          logger.info(
            "ensureProfile: Profile found on retry, logging into RevenueCat",
          );
          const prof = retryData[0] as Profile;
          const customerInfo = await revenueCatService.login(userId);
          const isRcPremium = revenueCatService.checkEntitlement(customerInfo);

          set({
            profile: prof,
            onboarded: prof.onboarded,
            role: prof.role,
            country: prof.country,
            language: prof.language,
            avatar_url: prof.avatar_url,
            push_token: prof.push_token,
            isPremium: isRcPremium,
          });
          logger.info("ensureProfile: Complete (retry)");
          return;
        }

        // 3. Trigger didn't create it, try manual insert (fallback)
        logger.info(
          "ensureProfile: Profile still not found, inserting manually",
        );
        const { data: newProfile, error: insertError } = await supabase
          .from("profiles")
          .insert({ user_id: userId, onboarded: false })
          .select();

        if (insertError) {
          logger.error("ensureProfile insert error:", insertError.message);
          throw insertError;
        }

        if (newProfile && newProfile.length > 0) {
          logger.info(
            "ensureProfile: New profile created, logging into RevenueCat",
          );
          const prof = newProfile[0] as Profile;
          const customerInfo = await revenueCatService.login(userId);
          const isRcPremium = revenueCatService.checkEntitlement(customerInfo);

          set({
            profile: prof,
            onboarded: prof.onboarded,
            role: prof.role,
            country: prof.country,
            language: prof.language,
            avatar_url: prof.avatar_url,
            push_token: prof.push_token,
            isPremium: isRcPremium,
          });
          logger.info("ensureProfile: Complete (new profile)");
        }
      } catch (err: any) {
        logger.error("ensureProfile error:", err.message || err);
      } finally {
        logger.info("ensureProfile: Cleaning up");
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
    if (!user) return;

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
        }
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
      }
    } catch (err: any) {
      logger.error("updateProfile error:", err.message || err);
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
}));
