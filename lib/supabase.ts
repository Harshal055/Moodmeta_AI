/**
 * Supabase Client — MoodMateAI
 *
 * Initializes the Supabase JS client with expo-secure-store
 * as the auth token storage adapter so sessions persist
 * across app restarts.
 *
 * Uses Expo public env vars for client-safe credentials.
 */

import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import "react-native-url-polyfill/auto";
import type { Database } from "./database.types";

// ── Supabase credentials ────────────────────────────────────────────
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!hasSupabaseConfig) {
  console.error(
    "Missing Supabase env vars. App will run with auth/network features disabled until EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are configured.",
  );
}

// Derive the SecureStore key Supabase uses from the URL
// e.g. https://abc123.supabase.co → "sb-abc123-auth-token"
const projectRef = hasSupabaseConfig
  ? new URL(SUPABASE_URL as string).hostname.split(".")[0]
  : "local";
export const SUPABASE_STORAGE_KEY = `sb-${projectRef}-auth-token`;

// ── Custom storage adapter using expo-secure-store ──────────────────
// SecureStore only works on native; fall back to no-op on web
export const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") return null;
    try {
      const value = await SecureStore.getItemAsync(key);
      if (!value) return null;

      // Supabase expects a valid JSON string. If the stored value is just a raw token
      // (e.g. starts with 'eyJ'), parsing it will crash Supabase initialization.
      // Safely parse to ensure it's valid JSON before returning to Supabase.
      try {
        JSON.parse(value);
        return value;
      } catch (parseError) {
        console.warn(
          "⚠️ Corrupted JSON session found in SecureStore. Clearing it to recover app state.",
        );
        await SecureStore.deleteItemAsync(key);
        return null;
      }
    } catch (err) {
      console.error("Storage error:", err);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web") return;
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === "web") return;
    await SecureStore.deleteItemAsync(key);
  },
};

// ── Create client ───────────────────────────────────────────────────
export const supabase = createClient<Database>(
  (SUPABASE_URL as string) || "https://invalid.local",
  (SUPABASE_ANON_KEY as string) || "invalid-anon-key",
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // important for React Native
    },
  },
);
