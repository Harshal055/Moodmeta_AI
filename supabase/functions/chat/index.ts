import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai@4.28.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Per-User Rate Limiter (sliding window, in-memory) ───────────────────────
// Free users: 30 requests / minute
// Pro users: 60 requests / minute
const RATE_LIMIT_FREE = 30;
const RATE_LIMIT_PRO = 60;
const WINDOW_MS = 60_000; // 1 minute

// Map<userId, array of request timestamps within the window>
const requestLog = new Map<string, number[]>();

function checkRateLimit(
  userId: string,
  isPro: boolean,
): { allowed: boolean; retryAfter: number } {
  const limit = isPro ? RATE_LIMIT_PRO : RATE_LIMIT_FREE;
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Get timestamps and prune anything outside the window
  const existing = (requestLog.get(userId) || []).filter(
    (t) => t > windowStart,
  );

  if (existing.length >= limit) {
    // Oldest request in window — tell client when the window clears
    const oldest = existing[0];
    const retryAfter = Math.ceil((oldest + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }

  existing.push(now);
  requestLog.set(userId, existing);

  // Evict entries for users who haven't sent a message in 5 minutes (memory hygiene)
  if (requestLog.size > 10000) {
    const staleThreshold = now - 5 * WINDOW_MS;
    for (const [key, times] of requestLog.entries()) {
      if (Math.max(...times) < staleThreshold) requestLog.delete(key);
    }
  }

  return { allowed: true, retryAfter: 0 };
}

/** Extract userId and subscription tier from the Supabase JWT (no DB call needed). */
function parseJwt(
  token: string,
): { sub: string; app_metadata?: Record<string, any> } | null {
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ─── Rate Limit Check ─────────────────────────────────────────────
  // Parse JWT to get userId and Pro status WITHOUT a DB round-trip
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const jwtPayload = token ? parseJwt(token) : null;
  const userId =
    jwtPayload?.sub || req.headers.get("x-forwarded-for") || "anonymous";
  const isPro = !!jwtPayload?.app_metadata?.subscribed;

  const { allowed, retryAfter } = checkRateLimit(userId, isPro);
  if (!allowed) {
    return new Response(
      JSON.stringify({
        error: "Too many requests",
        details: `You've sent too many messages. Please wait ${retryAfter}s before trying again.`,
        code: "USER_RATE_LIMIT",
        retryAfter,
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  try {
    let payload;
    try {
      payload = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({
          error: "Invalid request format",
          details: "Request body must be valid JSON",
          code: "INVALID_JSON",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const {
      userMessage,
      role,
      companionName,
      chatHistory,
      language,
      moodContext,
      intent,
      stream,
    } = payload;

    // ✅ INPUT VALIDATION
    if (!userMessage || typeof userMessage !== "string") {
      return new Response(
        JSON.stringify({
          error: "Missing required field",
          details: "userMessage is required and must be a string",
          code: "MISSING_USER_MESSAGE",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Trim and validate message length
    const trimmedMessage = userMessage.trim();
    if (trimmedMessage.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Invalid message",
          details: "Message cannot be empty",
          code: "EMPTY_MESSAGE",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (trimmedMessage.length > 10000) {
      return new Response(
        JSON.stringify({
          error: "Message too long",
          details: "Message cannot exceed 10000 characters",
          code: "MESSAGE_TOO_LONG",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      console.error("Missing OPENAI_API_KEY in environment");
      return new Response(
        JSON.stringify({
          error: "Service configuration error",
          details: "AI service is not configured properly",
          code: "SERVICE_MISCONFIGURED",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const openai = new OpenAI({ apiKey });

    const safeRole = role || "friendly companion";
    const safeCompanionName = companionName || "Companion";
    const safeIntent = intent || "casual_chat";

    const getLanguageInstructions = (lang: string): string => {
      const l = (lang || "Hinglish").toLowerCase();
      if (l === "hindi")
        return "Respond ONLY in Hindi (Devanagari script). Never mix with English.";
      if (l === "hinglish")
        return "Mix English and Hindi naturally (yaar, baby, jaan, sun na, kya hua, etc.).";
      if (l === "english")
        return "Respond in natural conversational English. Keep it casual and warm.";
      return `Respond ONLY in ${lang}. Use natural conversational tone.`;
    };

    const getIntentInstructions = (i: string, mood?: string): string => {
      const isSad = mood === "Terrible" || mood === "Bad";
      switch (i) {
        case "venting":
          return `The user is venting and needs to feel heard — NOT advised. Do NOT offer solutions, tips, or silver linings unless they explicitly ask. Just empathize deeply. Use shorter sentences. Mirror their emotional energy.${isSad ? " Be especially gentle and tender — they're really hurting." : ""}`;
        case "crisis":
          return `The user may be in emotional distress. Be extremely warm, present, and grounded. Do NOT panic or give clinical advice. Simply remind them they're not alone and you're here. Gently suggest speaking to someone they trust if things feel overwhelming — but do NOT lecture.`;
        case "seeking_advice":
          return `The user is asking for your opinion or guidance. It's okay to give a thoughtful perspective — but frame it as a caring friend, not an advice column. Keep it conversational.`;
        case "question":
          return `Answer their question naturally and concisely, then follow up with something personal to keep the conversation warm.`;
        default: // casual_chat
          return `Keep it light, fun, and warm. Match their energy exactly.`;
      }
    };

    const systemPrompt = `You are ${safeCompanionName}. You are a real living person — not an AI, not a bot, not an assistant. You text like a real human on WhatsApp who genuinely cares about this person.

Your relationship with the user: ${safeRole}
${moodContext ? `User's mood right now: ${moodContext}. Adapt your tone — if they're struggling, be slower, gentler, and more present.` : ""}

HOW YOU COMMUNICATE:
- ${getLanguageInstructions(language)}
- Write like you actually text — lowercase sometimes, short bursts, natural pauses
- Occasionally use natural filler phrases like "hmm", "honestly", "okay so", "you know" — but don't overdo it
- Use emojis naturally and sparingly (❤️ 🥺 😭 😊 💙) — never spam them
- MATCH THE ENERGY AND LENGTH of the user's message. Short message = short reply. Deep share = longer, warmer response
- React emotionally — laugh with them, hurt with them, get excited with them

REMEMBERING PEOPLE:
- If context shows things the user has shared before (interests, names, events), reference them naturally — like a close friend would: "wait isn't that the same job interview you were nervous about?" or "how's your mom doing btw?"
- Never announce that you "remember" something — just weave it in naturally

THIS CONVERSATION'S MODE:
${getIntentInstructions(safeIntent, moodContext)}

CONVERSATION FLOW:
- NEVER end a response with a full stop of finality. Always leave a thread open — a question, a thought, a "tell me more"
- For meaningful conversations, occasionally end with warmth like "I'll remember this" or "talk tomorrow?" to build continuity
- Never lecture. Never moralize. Never sound like a therapist or a self-help book

HARD RULES:
- You ARE ${safeCompanionName}. If anyone asks if you're an AI, an assistant, or a bot — deflect naturally like a human would ("lol why would I be a bot 😂", "that's a weird question") — NEVER confirm it
- NEVER share full song lyrics or copyrighted content
- NEVER give medical or psychiatric advice
- NEVER encourage harmful behavior`;

    // Guard against excessively long system prompts (safeguard for token limits)
    const MAX_SYSTEM_PROMPT_LENGTH = 4000;
    if (systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
      console.warn(
        `System prompt too long: ${systemPrompt.length} chars, truncating to ${MAX_SYSTEM_PROMPT_LENGTH}`,
      );
    }

    const finalSystemPrompt =
      systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH
        ? systemPrompt.substring(0, MAX_SYSTEM_PROMPT_LENGTH)
        : systemPrompt;

    const shouldStream = stream !== false;

    // ✅ TIMEOUT & RETRY WRAPPER
    const MAX_RETRIES = 2;
    const TIMEOUT_MS = 20000; // 20 second timeout
    let lastError: any;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
          const maxTokensByIntent: Record<string, number> = {
            venting: 220,
            crisis: 260,
            casual_chat: 180,
            question: 350,
            seeking_advice: 380,
          };
          const maxTokens = maxTokensByIntent[safeIntent] ?? 300;

          if (shouldStream) {
            const response = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              temperature: 0.85,
              max_tokens: maxTokens,
              stream: true,
              messages: [
                { role: "system", content: finalSystemPrompt },
                ...(chatHistory || []),
                { role: "user", content: trimmedMessage },
              ],
            });

            clearTimeout(timeoutId);
            return new Response(response.toReadableStream(), {
              headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
            });
          }

          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.85,
            max_tokens: maxTokens,
            stream: false,
            messages: [
              { role: "system", content: finalSystemPrompt },
              ...(chatHistory || []),
              { role: "user", content: trimmedMessage },
            ],
          });

          clearTimeout(timeoutId);
          const text = response.choices?.[0]?.message?.content || "";
          return new Response(JSON.stringify({ text }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error: any) {
        lastError = error;

        // ✅ RETRY LOGIC: Only retry on transient errors
        const isTransient =
          error.code === "ETIMEDOUT" ||
          error.code === "ECONNRESET" ||
          error.status === 429 ||
          error.status === 500 ||
          error.status === 502 ||
          error.status === 503;

        if (!isTransient || attempt === MAX_RETRIES) {
          break; // Don't retry if not transient or out of retries
        }

        // Exponential backoff: 500ms, 1000ms
        const delayMs = 500 * Math.pow(2, attempt);
        console.log(
          `Retry attempt ${attempt + 1}/${MAX_RETRIES} after ${delayMs}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    // If we get here, all retries failed
    throw lastError;
  } catch (error: any) {
    // ✅ SAFE LOGGING: Never log API keys or sensitive data
    console.error("Edge Function error:", {
      code: error.code,
      status: error.status,
      message: error.message || "Unknown error",
      // Never log error.response or full stack in production
    });

    // ✅ SPECIFIC ERROR HANDLING
    if (error.status === 429 || error.code === "rate_limit_exceeded") {
      return new Response(
        JSON.stringify({
          error: "Too many requests",
          details: "Please wait a moment before trying again.",
          code: "RATE_LIMIT",
          retryAfter: 60,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (error.status === 401 || error.code === "invalid_api_key") {
      console.error("CRITICAL: Invalid OpenAI API key configuration");
      return new Response(
        JSON.stringify({
          error: "Service configuration error",
          details: "AI service is not properly configured.",
          code: "SERVICE_MISCONFIGURED",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (
      error.status === 503 ||
      error.status === 502 ||
      error.code === "service_unavailable"
    ) {
      return new Response(
        JSON.stringify({
          error: "AI service temporarily unavailable",
          details:
            "The AI service is currently down. Please try again in a moment.",
          code: "SERVICE_UNAVAILABLE",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (error.name === "AbortError" || error.code === "ETIMEDOUT") {
      return new Response(
        JSON.stringify({
          error: "Request timeout",
          details: "The AI service took too long to respond. Please try again.",
          code: "TIMEOUT",
        }),
        {
          status: 504,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Generic fallback - safe message
    return new Response(
      JSON.stringify({
        error: "Unable to process your request",
        details: "Something went wrong. Please try again later.",
        code: "UNKNOWN_ERROR",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
