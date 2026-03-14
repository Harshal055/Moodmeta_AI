# MoodMateAI - Full App Flow & Architecture (Code-Accurate)

This document reflects the current implementation in the repository as of 2026-03-14.

---

## App Identity

| Field        | Value                                                       |
| ------------ | ----------------------------------------------------------- |
| Package      | `com.harshal.moodmateai`                                    |
| Framework    | React Native `0.81.5`, Expo SDK `54`, Expo Router `~6.0.23` |
| Language     | TypeScript                                                  |
| Backend      | Supabase (Auth + PostgreSQL + Realtime + Edge Functions)    |
| AI           | OpenAI `gpt-4o-mini` through Supabase Edge Function         |
| Monetization | RevenueCat + Google AdMob                                   |
| State        | Zustand (`hooks/useAuth.ts`)                                |

---

## 1. App Startup Sequence

```text
Native boot
  -> app/_layout.tsx mounts
    -> SplashScreen.preventAutoHideAsync()
    -> Fonts load (Inter, Manrope, Rosehot)
    -> Notifications.setNotificationHandler(...)
    -> revenueCatService.initialize()
    -> useAuth.initialize()
      -> NotificationService.init()
      -> NotificationService.scheduleDailyReminder()
    -> global notification tap listener pushes /(main)/chat
  -> SplashScreen.hideAsync() after auth initialized + fonts loaded
  -> app/index.tsx routing guard decides auth/main route
```

Key behavior:

- Notification tap handling is global in `app/_layout.tsx`.
- Any notification tap routes to `/(main)/chat`.

---

## 2. Auth Initialization (`useAuth.initialize()`)

`initialize()` flow in `hooks/useAuth.ts`:

```text
initialize()
  -> GoogleSignin.configure(...)
  -> supabase.auth.getSession()
    -> JSON parse corruption handling clears SecureStore
  -> if session exists, supabase.auth.getUser() validation
  -> if no valid user, signInAnonymously() with retry
  -> ensureProfile(user.id)
  -> registerForPushNotificationsAsync() -> updateAuthPushToken()
  -> register onAuthStateChange listener
  -> set isLoading=false, isInitialized=true
```

Listener behavior:

- `SIGNED_OUT`: clears user/profile state and logs out RevenueCat.
- User ID changed (anonymous to real): migrates anonymous data and syncs RevenueCat user ID.

Startup timeout:

- 15-second timeout guard with retry alert.

### `ensureProfile(userId)`

```text
ensureProfile(userId)
  -> dedupe concurrent calls for same user
  -> fetch profiles row by user_id
  -> if missing, upsert default profile
  -> fallback re-fetch after short delay
  -> set local auth/profile aliases
  -> revenueCatService.login(userId)
  -> syncPremiumStatus()
  -> subscribe to profile realtime updates for this user
```

---

## 3. Root Routing Guard (`app/index.tsx`)

Routing logic:

```text
if not initialized or still loading -> stay on splash-like screen
if currentUser exists but profile not hydrated -> wait
if onboarded and currentUser -> /(main)/dashboard
else -> /(auth)/welcome
```

This avoids re-routing users to onboarding while profile hydration is still in flight.

---

## 4. Onboarding Flow (New Users)

Auth stack (`app/(auth)/_layout.tsx`):

```text
/(auth)/welcome
  -> /(auth)/role-picker
  -> /(auth)/country-picker
  -> /(auth)/language-picker
  -> /(auth)/name-companion
  -> /(auth)/building
  -> /(main)/dashboard
```

Profile fields are progressively updated during onboarding.

---

## 5. Login Flow (Returning Users)

```text
/(auth)/login
  -> useAuth.signInWithGoogle()
    -> GoogleSignin.signIn()
    -> get idToken
    -> supabase.auth.signInWithIdToken({ provider: "google", token })
    -> onAuthStateChange handles post-login hydration
```

Anonymous to real account migration (`transferAnonymousData`):

- `chats`
- `mood_logs`
- `user_memories`
- profile fields merged into target profile

Note:

- Current migration function does not move `user_challenges` or `wellness_logs`.

---

## 6. Main App Navigation

Main stack (`app/(main)/_layout.tsx`):

- `dashboard`
- `chat`
- `profile`
- `settings`
- `breathing`
- `meditation`
- `emergency`

Global overlay:

- `MoodModal` is always mounted in main layout.

Modals stack (`app/(modals)/_layout.tsx`):

- `paywall`
- `link-account`
- `upgrade-success`
- `save-chats`

---

## 7. Dashboard Screen (`app/(main)/dashboard.tsx`)

Data loading:

- Initial load sets challenge + random tip, then fetches runtime data.
- Snapshot and mood history load in parallel.
- Memory highlight loads only for premium users.

Data sources:

- `dashboardService.getMoodSnapshot(userId)`
- `dashboardService.getMoodHistory(userId)`
- `dashboardService.getMemoryHighlight(userId)` (premium)
- `dashboardService.getDailyChallenge()`
- `dashboardService.getRandomTip()`
- `dashboardService.getUserStats(userId)`
- `dashboardService.getUserBadges(userId, stats)`

Daily challenge completion:

```text
Tap complete
  -> optimistic UI update + confetti
  -> insert user_challenges row
  -> rpc increment_karma(userId, amount)
  -> fallback direct profile karma update if RPC fails
```

Animations present:

- `fadeAnim` + `slideAnim` entry animation
- `pulseAnim` looping
- `floatAnim` looping
- `scrollY` parallax for header

---

## 8. AI Chat Screen (`app/(main)/chat.tsx`) - Full Flow

### Key constants and state

- `FREE_MESSAGE_LIMIT = 20`
- `MESSAGES_PER_PAGE = 20`
- Free users are gated at 20 user messages, then routed to `/(modals)/paywall`.

Key runtime state includes:

- `messages`
- `isTyping`
- `isLoadingHistory`
- `hitLimit`
- `retryPending`
- `isRecording`
- `isTranscribing`
- `playingMessageId`
- `showAd`
- `isOnline`

### History load (`loadHistory`)

```text
loadHistory()
  -> hydrate recent cache from AsyncStorage (chat_history_<userId>)
  -> query Supabase chats page ordered by created_at desc
  -> map DB rows (id, message, is_from_ai, created_at) to GiftedChat format
  -> support pagination via load earlier
```

### Send flow (`onSend`)

```text
onSend(newMessage)
  -> enforce free limit for non-premium
  -> optimistic append with stable UUID
  -> build history context from current messages
  -> streamAssistantReply(...)
```

`streamAssistantReply` does:

```text
1) persist user message in chats (is_from_ai=false)
2) fetch mood context (today's mood_logs.mood_score)
3) premium only: load AI memory context
4) detect intent (venting/crisis/question/etc.)
5) pre-insert optimistic AI row "..." in chats
6) call getAIResponseStream(...)
7) stream/update AI bubble text live
8) upsert final AI message to chats (is_from_ai=true)
9) on failure, show retry banner and allow retry
```

### AI response chain (`services/openaiService.ts`)

Current behavior:

```text
getAIResponseStream(...)
  -> tries non-stream POST first (stream:false)
  -> if non-stream succeeds, simulates typing rhythm on client (chunked delivery)
  -> if non-stream fails, falls back to SSE stream via EventSource
  -> if stream fails after retry policy, retries non-stream once more
  -> if all fail, emits a friendly fallback message instead of throwing hard
```

Related functions:

- `warmEdgeFunction()` prewarms `/functions/v1/chat` on foreground.
- `transcribeAudio(uri)` calls `/functions/v1/transcribe` for voice-to-text.

### Edge Function (`supabase/functions/chat/index.ts`)

Behavior summary:

- Handles `OPTIONS` for CORS and warming.
- Parses JWT payload for user id and subscription metadata (for rate limiting).
- Validates input and message length.
- Builds dynamic system prompt from role/language/intent/mood context.
- Calls OpenAI `gpt-4o-mini` with streaming or non-stream response.
- Applies retry logic for transient upstream failures.

### Voice features

Input voice flow (chat compose):

- Uses `expo-av` recording.
- Uploads recorded file through `transcribeAudio()`.
- Sends transcribed text via normal `onSend` path.

Output voice flow (AI playback):

- Uses `utils/voiceService.ts` (`expo-speech`) for text-to-speech.
- Premium-gated via feature flag in message bubbles.

### Realtime sync

```text
supabase.channel(`chats:${userId}`)
  .on("postgres_changes", INSERT on chats filtered by user_id)
  -> appends new AI rows when is_from_ai=true
```

---

## 9. Breathing Screen (`app/(main)/breathing.tsx`)

Modes:

- Box: `4s in -> 4s hold -> 4s out -> 4s hold`
- 4-7-8: `4s in -> 7s hold -> 8s out`

Session behavior:

- 60-second guided session loop.
- On completion, logs wellness session through dashboard service.
- Reward mapping in service gives breathing `+5` karma.

Wellness log payload uses:

- `activity_type: "breathing"`
- `duration_seconds`

---

## 10. Meditation Screen (`app/(main)/meditation.tsx`)

- Default timer is 5 minutes.
- Completion card shows `+30 Karma`.
- Completion logs wellness session through dashboard service.

Wellness log payload uses:

- `activity_type: "meditation"`
- `duration_seconds`

---

## 11. Emergency / Grounding Screen (`app/(main)/emergency.tsx`)

Implemented tools:

- 5-4-3-2-1 grounding sequence (stepper UI)
- Quick link to breathing screen
- Quick link to chat

Current screen does not include explicit crisis hotline link UI in this file.

---

## 12. AI Memory System (`utils/aiMemoryService.ts`)

Memory record shape includes:

- personal fields (`name`, `age`)
- preferences (`preferred_tone`, `sensitivity_level`)
- context (`current_mood`, `recent_events`, `favorite_topics`)
- timestamps (`created_at`, `last_updated`)

Implemented methods:

- `getUserMemory`
- `recordInterest`
- `recordEvent`
- `recordFavoriteTopic`
- `recordCurrentMood`
- `updatePreferences`
- `getMemoryPrompt`
- `clearMemory`
- `getRelationshipDays`

Important:

- There is no generic `extractAndUpdateMemory(userMessage, aiResponse)` method currently implemented.
- Chat currently reads memory for context and updates mood through `recordCurrentMood`.

---

## 13. Premium / Paywall System

RevenueCat lifecycle:

```text
app start -> revenueCatService.initialize()
login / user switch -> revenueCatService.login(userId)
entitlement sync -> useAuth.syncPremiumStatus()
```

Paywall routes used in app:

- `/(modals)/paywall`
- `/(modals)/upgrade-success`

Observed premium gating examples:

- Chat message cap (free limit)
- Voice playback
- Chat export
- Some customization features
- Memory highlight card
- Ads hidden for premium users

Ad integration:

- Banner ads are rendered in free experience.
- Interstitial/rewarded support exists in `adService`, usage is feature-dependent.

---

## 14. Database Tables (Supabase)

Core tables used by app code:

| Table             | Key Columns Used                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `profiles`        | `user_id`, `role`, `companion_name`, `country`, `language`, `avatar_url`, `push_token`, `onboarded`, `is_premium`, `karma`                                                                 |
| `chats`           | `id`, `user_id`, `message`, `is_from_ai`, `created_at`                                                                                                                                     |
| `mood_logs`       | `id`, `user_id`, `mood_score`, `notes`, `created_at`                                                                                                                                       |
| `user_memories`   | `user_id`, `name`, `age`, `interests`, `preferred_tone`, `sensitivity_level`, `current_mood`, `recent_events`, `favorite_topics`, `relationship_length_days`, `created_at`, `last_updated` |
| `user_challenges` | `id`, `user_id`, `challenge_id`, `completed_at`, `karma_earned`                                                                                                                            |
| `wellness_logs`   | `id`, `user_id`, `activity_type`, `duration_seconds`, `created_at`                                                                                                                         |

RPC used:

```sql
increment_karma(p_user_id UUID, p_amount INTEGER)
```

This function updates `profiles.karma` atomically.

RLS:

- `user_challenges` and `wellness_logs` explicitly enable RLS in migrations.
- App logic assumes user-scoped access across all user tables.

---

## 15. Analytics and Notifications

Analytics:

- Screen-level logging through `utils/logger.ts` and analytics service utilities.

Notification scheduling (`utils/notificationService.ts`):

- Companion reminder: time-interval notification (24 hours from scheduling time).
- Challenge reminder: daily at 9:00.
- Streak reminder: daily at 20:00 when streak >= 2.
- Mood-aware idle check-in: 24-hour interval with mood-based message copy.

---

## 16. Complete Navigation Map

```text
app/
  index.tsx
  _layout.tsx

  (auth)/
    _layout.tsx
    welcome.tsx
    login.tsx
    role-picker.tsx
    country-picker.tsx
    language-picker.tsx
    name-companion.tsx
    building.tsx

  (main)/
    _layout.tsx
    dashboard.tsx
    chat.tsx
    breathing.tsx
    meditation.tsx
    emergency.tsx
    profile.tsx
    settings.tsx
    customize.tsx

  (modals)/
    _layout.tsx
    paywall.tsx
    link-account.tsx
    link-email.tsx
    save-chats.tsx
    upgrade-success.tsx

  (admin)/
    dashboard.tsx
```

---

## 17. Key Services and Utilities

| File                                   | Purpose                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `hooks/useAuth.ts`                     | Auth lifecycle, profile hydration, premium sync, anonymous migration     |
| `services/openaiService.ts`            | AI request orchestration (non-stream first, SSE fallback), transcription |
| `services/revenueCatService.ts`        | RevenueCat initialize/login/purchase/restore/customer info               |
| `services/dashboardService.ts`         | Dashboard data aggregation, challenge completion, wellness logging       |
| `utils/aiMemoryService.ts`             | User memory persistence and retrieval                                    |
| `utils/notificationService.ts`         | Push permission setup and reminder scheduling                            |
| `utils/adService.ts`                   | AdMob integration wrappers (banner/interstitial/rewarded)                |
| `utils/voiceService.ts`                | Text-to-speech playback for AI messages                                  |
| `utils/offlineSyncService.ts`          | Offline queue/sync helpers                                               |
| `components/MoodModal.tsx`             | Daily mood prompt and `mood_logs` insert                                 |
| `components/PurchaseErrorBoundary.tsx` | Purchase/paywall error containment                                       |

---

## 18. Security Model

| Layer                     | Mechanism                                                                     |
| ------------------------- | ----------------------------------------------------------------------------- |
| Local session persistence | Secure storage through Supabase auth storage adapter                          |
| API authentication        | Bearer JWT for Supabase APIs and edge functions                               |
| DB access control         | User-scoped access enforced by RLS policies where configured                  |
| Purchase key hygiene      | RevenueCat test-key guard in non-dev builds                                   |
| Logging safety            | Production purchase logs reduced (`LOG_LEVEL.ERROR`)                          |
| Edge protection           | Input validation, request rate limiting, retry/error shaping in chat function |

---

## Summary

MoodMateAI is a React Native + Expo mental wellness companion app with anonymous-first onboarding, optional account linking, personalized AI chat, mood tracking, wellness activities, challenge-based karma, premium feature gating, and push re-engagement loops. The architecture is service-driven and Supabase-centered, with robust client fallbacks for chat reliability and realtime synchronization for message updates.
