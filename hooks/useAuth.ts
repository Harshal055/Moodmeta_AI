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
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
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
  is_premium: boolean;
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
  isAdmin: boolean;

  // Actions
  initialize: () => Promise<void>;
  ensureProfile: (userId: string, forceRefresh?: boolean) => Promise<void>;
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
  signInWithGoogle: () => Promise<void>;
  linkGoogle: () => Promise<void>;
  transferAnonymousData: (
    oldUserId: string,
    newUserId: string,
  ) => Promise<void>;
  syncPremiumStatus: (isPremiumManual?: boolean) => Promise<void>;
}

let ensureProfilePromise: Promise<void> | null = null;
let currentEnsuringUserId: string | null = null;
let authSubscription: { unsubscribe: () => void } | null = null;
let isMigrating = false; // B8: Migration Lock
const ADMIN_UIDS = ["YOUR_ADMIN_UID_HERE"]; // B4: Hardcoded Admin UIDs (Replace with actual)
let profileSubscription: any = null;

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
  isAdmin: false,

  /**
   * Called once in _layout.tsx. Signs in anonymously if no
   * session exists and sets up the auth state listener.
   */
  initialize: async () => {
    if (get().isInitialized) return;

    // 0. Initial Google Configuration
    try {
      const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

      if (!webClientId) {
        logger.warn(
          "Auth: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing. Google Sign-In will fail.",
        );
      }

      GoogleSignin.configure({
        webClientId,
        // Supabase only needs an ID token; offline server auth code is unnecessary.
        offlineAccess: false,
        scopes: ["profile", "email"],
      });
      logger.info("Auth: Google Sign-In configured successfully", {
        hasWebClientId: Boolean(webClientId),
        hasAndroidClientId: Boolean(androidClientId),
      });
    } catch (e) {
      logger.error("Auth: Google Sign-In config failed:", e);
    }

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
          logger.info(
            "Session fetched:",
            activeUser ? "User found" : "No user",
          );
        } catch (sessionError: any) {
          // Handle corrupted session data
          logger.error("Session fetch error:", sessionError);
          if (sessionError?.message?.includes("JSON Parse")) {
            logger.warn(
              "Corrupted session detected, clearing all auth data...",
            );
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
              logger.error(
                `Anonymous sign-in error (Attempt ${retryCount}):`,
                error,
              );
              if (retryCount >= maxRetries) throw error;
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * retryCount),
              );
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
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
          const newUser = session?.user ?? null;
          const oldUser = get().currentUser;

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
              isAdmin: false,
            });
            // Also sign out from RevenueCat to be clean
            revenueCatService.logout().catch(() => { });

            // Cleanup profile subscription on sign-out
            if (profileSubscription) {
              profileSubscription.unsubscribe();
              profileSubscription = null;
            }
          } else if (newUser) {
            // B1, B2, B6, B8: DETECT MIGRATION & ACCOUNT SWITCH
            if (oldUser && oldUser.id !== newUser.id) {
              // Only migrate if moving FROM Anonymous TO a real account
              if (oldUser.is_anonymous && !newUser.is_anonymous) {
                if (!isMigrating) {
                  isMigrating = true;
                  logger.info(
                    `Auth: Detected Migration. ${oldUser.id} -> ${newUser.id}`,
                  );
                  await get().transferAnonymousData(oldUser.id, newUser.id);
                  isMigrating = false;
                }
              }

              // B7: Sync RevenueCat ID immediately on any UID change
              logger.info(`Auth: Syncing RevenueCat to new UID: ${newUser.id}`);
              revenueCatService
                .login(newUser.id)
                .catch((e) => logger.error("RC Sync Error:", e));
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
          [{ text: "Retry", onPress: () => get().initialize() }],
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
          [{ text: "Retry", onPress: () => get().initialize() }],
        );
      }
    });
  },

  /**
   * Check if a profiles row exists for this user.
   * Reverted from upsert to fetch-then-insert to avoid requiring a unique constraint on user_id.
   */
  ensureProfile: async (userId: string, forceRefresh = false) => {
    if (
      !forceRefresh &&
      ensureProfilePromise &&
      currentEnsuringUserId === userId
    ) {
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
          logger.info(
            "ensureProfile: Profile not found, attempting safe create...",
          );
          // B11: Sync avatar from social provider metadata if available
          const user = get().currentUser;
          const avatarUrl =
            user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

          const { data: newProf, error: insertError } = await supabase
            .from("profiles")
            .upsert(
              {
                user_id: userId,
                onboarded: false,
                avatar_url: avatarUrl || null,
              },
              { onConflict: "user_id" },
            )
            .select()
            .maybeSingle();

          if (insertError) {
            logger.warn(
              "ensureProfile: Insert/Upsert conflict (expected if trigger won):",
              insertError.message,
            );
            // Re-fetch in case a trigger created it simultaneously
            prof = await fetchProfile();
          } else {
            prof = newProf;
          }
        }

        if (!prof) {
          // Final fallback: Wait a moment for trigger
          await new Promise((r) => setTimeout(r, 800));
          prof = await fetchProfile();
        }

        if (prof) {
          const user = get().currentUser;

          // Background RC login to avoid blocking UI during sensitive auth transitions
          revenueCatService
            .login(userId)
            .then((customerInfo) => {
              const isRcPremium =
                revenueCatService.checkEntitlement(customerInfo);
              if (isRcPremium !== get().isPremium) {
                set({ isPremium: isRcPremium });
                // Also sync back to DB if they disagree
                if (isRcPremium !== prof?.is_premium) {
                  get()
                    .syncPremiumStatus(isRcPremium)
                    .catch(() => { });
                }
              }
            })
            .catch((e) =>
              logger.error("ensureProfile: RC Login failed (non-blocking)", e),
            );

          // B4: Robust Admin check (Role-based with Email fallback)
          const isAdmin =
            prof.role === "admin" ||
            prof.user_id === "af2c2707-6887-4638-89f4-34509747514b" || // Native Testing UID
            user?.email === "harsh@moodmateai.com";

          const currentState = get();
          const nextOnboarded = (prof.onboarded as boolean) ?? false;
          const nextIsPremium = (prof.is_premium as boolean) === true;

          if (
            currentState.profile?.id !== (prof as Profile).id ||
            currentState.onboarded !== nextOnboarded ||
            currentState.role !== prof.role ||
            currentState.country !== prof.country ||
            currentState.language !== prof.language ||
            currentState.avatar_url !== prof.avatar_url ||
            currentState.push_token !== prof.push_token ||
            currentState.isPremium !== nextIsPremium ||
            currentState.isAdmin !== isAdmin
          ) {
            set({
              profile: prof as Profile,
              onboarded: nextOnboarded,
              role: prof.role,
              country: prof.country,
              language: prof.language,
              avatar_url: prof.avatar_url,
              push_token: prof.push_token,
              // Use DB value immediately, RC will update asynchronously if needed
              isPremium: nextIsPremium,
              isAdmin,
            });
          }

          // ── Realtime Profile Subscription ─────────────────────
          // This makes the app "alive" — any change in Supabase dashboard
          // (role, is_premium, etc.) reflects in the app INSTANTLY.
          if (profileSubscription) profileSubscription.unsubscribe();

          profileSubscription = supabase
            .channel(`profile_realtime_${userId}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "profiles",
                filter: `user_id=eq.${userId}`,
              },
              async (payload) => {
                logger.info("Realtime: Profile updated", payload.eventType);
                const updatedProf = payload.new as Profile;
                if (updatedProf) {
                  // Only update state if something actually changed.
                  // This prevents recursive re-renders from Realtime pulses.
                  const currentProf = get().profile;
                  const hasChanges =
                    !currentProf ||
                    currentProf.is_premium !== updatedProf.is_premium ||
                    currentProf.role !== updatedProf.role ||
                    currentProf.onboarded !== updatedProf.onboarded ||
                    currentProf.companion_name !== updatedProf.companion_name ||
                    currentProf.avatar_url !== updatedProf.avatar_url;

                  if (!hasChanges) return;

                  const updatedIsAdmin =
                    updatedProf.role === "admin" ||
                    updatedProf.user_id ===
                    "af2c2707-6887-4638-89f4-34509747514b" ||
                    user?.email === "harsh@moodmateai.com";

                  const currentState = get();
                  const nextIsPremium = updatedProf.is_premium === true;

                  // Guard: avoid set() when computed top-level state is unchanged.
                  if (
                    currentState.profile?.id === updatedProf.id &&
                    currentState.onboarded === updatedProf.onboarded &&
                    currentState.role === updatedProf.role &&
                    currentState.country === updatedProf.country &&
                    currentState.language === updatedProf.language &&
                    currentState.avatar_url === updatedProf.avatar_url &&
                    currentState.push_token === updatedProf.push_token &&
                    currentState.isPremium === nextIsPremium &&
                    currentState.isAdmin === updatedIsAdmin
                  ) {
                    return;
                  }

                  set({
                    profile: updatedProf,
                    onboarded: updatedProf.onboarded,
                    role: updatedProf.role,
                    country: updatedProf.country,
                    language: updatedProf.language,
                    avatar_url: updatedProf.avatar_url,
                    push_token: updatedProf.push_token,
                    isPremium: nextIsPremium,
                    isAdmin: updatedIsAdmin,
                  });
                }
              },
            )
            .subscribe();

          logger.info("ensureProfile: Success + Realtime Active");
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
        push_token: null,
        isPremium: false,
        isAdmin: false,
      });

      if (profileSubscription) {
        profileSubscription.unsubscribe();
        profileSubscription = null;
      }

      // Priority 2: Attempt remote sign out
      await supabase.auth.signOut({ scope: "local" });

      // Priority 3: Brute force clear local storage keys just in case
      await ExpoSecureStoreAdapter.removeItem(SUPABASE_STORAGE_KEY);
    } catch (e) {
      logger.warn("Sign out cleanup partial:", e);
    }
  },

  signInWithGoogle: async () => {
    try {
      set({ isLoading: true });
      logger.info("Auth: Starting Google Sign-In...");

      // 1. Initial Checks
      await GoogleSignin.hasPlayServices();

      // 2. Force Account Picker by signing out first
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // Ignore sign-out errors (e.g. if not signed in)
      }

      // 3. Trigger native Sign-In
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;

      if (!idToken) {
        // Handle case where user closes popup via back button or X (B3, B9, B10)
        logger.info("Auth: Google Sign-In returned no token (cancelled)");
        return;
      }

      // 4. Authenticate with Supabase using the ID Token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });

      if (error) throw error;

      logger.info("Auth: Google Sign-In success", data.user?.email);
      // Wait for profile to be ready so component navigation sees correct onboarded status
      if (data.user) {
        await get().ensureProfile(data.user.id, true);
      }
    } catch (error: any) {
      // B3: Handle Cancellation specifically
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        logger.info("Auth: Google Sign-In cancelled by user");
      } else if (error.code === statusCodes.IN_PROGRESS) {
        logger.warn("Auth: Google Sign-In already in progress");
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert(
          "Google Play Services",
          "Please ensure Google Play Services are available on your device.",
        );
      } else if (
        String(error?.message || "").includes("DEVELOPER_ERROR") ||
        error?.code === 10
      ) {
        logger.error(
          "Auth: Google Sign-In DEVELOPER_ERROR. Verify Firebase OAuth setup (package name, SHA-1, web client ID).",
          {
            packageName: "com.harshal.moodmateai",
            webClientIdPresent: Boolean(
              process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
            ),
            errorCode: error?.code,
          },
        );
        Alert.alert(
          "Google Sign-In Config Error",
          "Google OAuth is misconfigured. Verify Firebase package name, SHA-1 fingerprints, and Web Client ID in .env.local.",
        );
      } else {
        logger.error(
          `Auth: Google Sign-In failed with unexpected error: ${error.message || error}`,
          error,
        );
        throw error;
      }
    } finally {
      // B10: Always clear loading state
      set({ isLoading: false });
    }
  },

  linkGoogle: async () => {
    try {
      set({ isLoading: true });
      logger.info("Auth: Starting Native Google Linking...");

      // 1. Sign In Natively
      // 1. Force Account Picker by signing out first
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // Ignore
      }
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;

      if (!idToken) {
        logger.info("Auth: Google linking cancelled (no token)");
        return;
      }

      // 3. Link with Supabase using signInWithIdToken
      // B5/B6: This replaces linkIdentity and is much more robust for native mobile.
      // It handles account merging and triggers onAuthStateChange migration.
      const { data: linkData, error: linkError } =
        await supabase.auth.signInWithIdToken({
          provider: "google",
          token: idToken,
        });

      if (linkError) {
        // Handle common linking errors
        if (
          linkError.message.includes("already linked") ||
          linkError.message.includes("already registered")
        ) {
          throw new Error(
            "This Google account is already linked to another user.",
          );
        }
        throw linkError;
      }

      // 4. Force state refresh to update is_anonymous: false
      const {
        data: { user: updatedUser },
      } = await supabase.auth.getUser();
      if (updatedUser) {
        set({ currentUser: updatedUser });
        logger.info("Auth: User state refreshed after linking", {
          isAnonymous: updatedUser.is_anonymous,
        });
        // FORCE REFRESH profile to catch the results of transferAnonymousData
        await get().ensureProfile(updatedUser.id, true);
      }

      logger.info("Auth: Native Google Linking success");
      Alert.alert(
        "Success 🎉",
        "Your account is now securely linked to Google!",
      );
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        logger.info("Auth: Google Link cancelled");
      } else {
        logger.error(
          `Auth: Google Linking failed with unexpected error: ${error.message || error}`,
          error,
        );
        throw error;
      }
    } finally {
      set({ isLoading: false });
    }
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
      if (chatError)
        logger.error("Migration: Chat move failed:", chatError.message);

      // 2. Migrate Mood Logs
      const { error: logError } = await supabase
        .from("mood_logs")
        .update({ user_id: newUserId })
        .eq("user_id", oldUserId);
      if (logError)
        logger.error("Migration: Mood logs move failed:", logError.message);

      // 3. Migrate AI Memory (if exists)
      const { error: memoryError } = await supabase
        .from("user_memories" as any)
        .update({ user_id: newUserId })
        .eq("user_id", oldUserId);
      if (memoryError)
        logger.warn(
          "Migration: AI Memory move failed (might not exist):",
          memoryError.message,
        );

      // 4. Migrate Profile Fields (Companion, Role, etc.)
      const oldProfile = get().profile;
      if (oldProfile) {
        logger.info("Migration: Moving profile settings...");
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            companion_name: oldProfile.companion_name,
            role: oldProfile.role,
            language: oldProfile.language,
            country: oldProfile.country,
            onboarded: oldProfile.onboarded,
            avatar_url: oldProfile.avatar_url,
            is_premium: oldProfile.is_premium,
          })
          .eq("user_id", newUserId);

        if (profileError) {
          logger.error(
            "Migration: Profile merge failed:",
            profileError.message,
          );
        } else {
          // Force a local profile refresh with fresh data from DB
          await get().ensureProfile(newUserId, true);
        }
      }

      logger.info("MIGRATION: Completed successfully");
    } catch (err) {
      logger.error("MIGRATION: Fatal error:", err);
    }
  },

  /**
   * Pushes the latest premium status to the database.
   * Call this after a successful purchase or when the RC listener fires.
   */
  syncPremiumStatus: async (isPremiumManual?: boolean) => {
    const user = get().currentUser;
    const profile = get().profile;
    if (!user) return;

    try {
      // 1. Determine current pro status
      let isPro = isPremiumManual;
      if (isPro === undefined) {
        const info = await revenueCatService.getCustomerInfo();
        isPro = revenueCatService.checkEntitlement(info);
      }

      const currentlyPremium = get().isPremium;
      const dbPremium = profile?.is_premium === true;

      // 2. GUARD: No state/DB change needed
      if (isPro === currentlyPremium && isPro === dbPremium) {
        logger.info("Auth: Premium state already in sync, skipping update.");
        return;
      }

      logger.info(`Auth: Syncing Premium Status to DB: ${isPro}`);

      // 3. Optimistic state update only if changed
      if (isPro !== currentlyPremium) {
        set({ isPremium: isPro });
      }

      // 4. Persist to DB only if changed
      if (isPro !== dbPremium) {
        const { error } = await supabase
          .from("profiles")
          .update({ is_premium: isPro })
          .eq("user_id", user.id);

        if (error) throw error;
      }
      logger.info("Auth: Premium Status synced successfully");
    } catch (e) {
      logger.error("Auth: Premium Sync Error:", e);
    }
  },
}));
