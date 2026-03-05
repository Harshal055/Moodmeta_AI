import EventSource from "react-native-sse";
import { supabase } from "../lib/supabase";
import { logger } from "../utils/logger";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const STREAM_TIMEOUT_MS = 10000;
const STREAM_ATTEMPT_TIMEOUT_MS = 6000;
const STREAM_IDLE_TIMEOUT_MS = 3500;
const RETRY_DELAYS_MS = [800];

function extractChunkFromPayload(payload: string): string {
  const trimmed = payload.trim();
  if (!trimmed) return "";

  // Handle raw text payloads that are not JSON
  const tryParseChunk = (candidate: string): string => {
    try {
      const parsed = JSON.parse(candidate);
      return (
        parsed?.choices?.[0]?.delta?.content ||
        parsed?.choices?.[0]?.message?.content ||
        parsed?.content ||
        parsed?.text ||
        ""
      );
    } catch {
      return "";
    }
  };

  // Sometimes chunks arrive as multiple SSE lines in one payload
  if (trimmed.includes("\n")) {
    const lines = trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    let merged = "";
    for (const line of lines) {
      const candidate = line.startsWith("data:")
        ? line.replace(/^data:\s*/, "")
        : line;

      if (candidate === "[DONE]") continue;

      const parsedChunk = tryParseChunk(candidate);
      if (parsedChunk) {
        merged += parsedChunk;
      }
    }
    if (merged) return merged;
  }

  // Single payload variants
  const dataCandidate = trimmed.startsWith("data:")
    ? trimmed.replace(/^data:\s*/, "")
    : trimmed;

  const parsedChunk = tryParseChunk(dataCandidate);
  if (parsedChunk) return parsedChunk;

  // Last resort: if server gave plain text, use it directly
  if (!trimmed.startsWith("{") && !trimmed.startsWith("data:")) {
    return trimmed;
  }

  return "";
}

async function fetchNonStreamResponse(
  functionUrl: string,
  token: string,
  payload: {
    userMessage: string;
    role: string | null;
    companionName: string;
    chatHistory: Array<{ role: "user" | "assistant"; content: string }>;
    language: string;
    moodContext: string | undefined;
    userId: string | undefined;
  },
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...payload, stream: false }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const body = await response.text();
      logger.error("Non-stream response not ok:", response.status, body);
      throw new Error(body || "AI request failed.");
    }

    const data = await response.json();
    const text = data?.text || data?.message || "";
    if (!text) {
      logger.error("Non-stream empty response:", JSON.stringify(data));
      throw new Error("AI returned empty response.");
    }

    return text;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      logger.error("Non-stream timeout after 15s");
      throw new Error("Request timeout");
    }
    logger.error("Non-stream error:", error?.message || error);
    throw error;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a streaming response from the secure Supabase Edge Function connecting to gpt-4o-mini.
 * @param userMessage The message the user just typed.
 * @param role The selected role of the companion (e.g. friend, boyfriend).
 * @param companionName The name of the companion chosen by the user.
 * @param chatHistory The previous 15 messages formatted as {role: 'user' | 'assistant', content: string}.
 * @param language The selected language for the response (e.g., English, Hindi, Hinglish).
 * @param moodContext The string description of the user's logged mood for today, if available.
 * @param userId The Supabase user ID for memory retrieval (optional).
 * @param onChunk Callback function triggered every time a new streaming chunk arrives.
 */
export async function getAIResponseStream(
  userMessage: string,
  role: string | null,
  companionName: string,
  chatHistory: Array<{ role: "user" | "assistant"; content: string }>,
  language: string = "Hinglish",
  moodContext: string | undefined,
  userId: string | undefined,
  onChunk: (chunk: string) => void,
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing Supabase env vars. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token || SUPABASE_ANON_KEY;
  const functionUrl = `${SUPABASE_URL}/functions/v1/chat`;
  const requestPayload = {
    userMessage,
    role,
    companionName,
    chatHistory,
    language,
    moodContext,
    userId,
  };

  // Use non-stream by default for mobile reliability
  try {
    const text = await fetchNonStreamResponse(
      functionUrl,
      token || "",
      requestPayload,
    );
    onChunk(text);
    return;
  } catch (nonStreamErr: any) {
    logger.warn(
      "Non-stream request failed, falling back to stream:",
      nonStreamErr?.message,
    );
  }

  const streamAttempt = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      let hasReceivedContent = false;
      let settled = false;

      const finalizeResolve = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        clearTimeout(attemptTimeoutId);
        clearTimeout(idleTimeoutId);
        es.close();
        resolve();
      };

      const finalizeReject = (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        clearTimeout(attemptTimeoutId);
        clearTimeout(idleTimeoutId);
        es.close();
        reject(error);
      };

      const resetIdleTimeout = () => {
        clearTimeout(idleTimeoutId);
        idleTimeoutId = setTimeout(() => {
          if (hasReceivedContent) {
            finalizeResolve();
            return;
          }
          finalizeReject(new Error("STREAM_IDLE_TIMEOUT"));
        }, STREAM_IDLE_TIMEOUT_MS);
      };

      const es = new EventSource(functionUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify(requestPayload),
      });

      const timeoutId = setTimeout(() => {
        finalizeReject(
          new Error(
            "Response timed out. Please check your connection and try again.",
          ),
        );
      }, STREAM_TIMEOUT_MS);

      const attemptTimeoutId = setTimeout(() => {
        if (hasReceivedContent) {
          finalizeResolve();
          return;
        }
        finalizeReject(new Error("STREAM_ATTEMPT_TIMEOUT"));
      }, STREAM_ATTEMPT_TIMEOUT_MS);

      let idleTimeoutId = setTimeout(() => {
        finalizeReject(new Error("STREAM_IDLE_TIMEOUT"));
      }, STREAM_IDLE_TIMEOUT_MS);

      es.addEventListener("message", (event) => {
        if (!event.data) return;

        resetIdleTimeout();

        const payload = String(event.data).trim();

        if (payload === "[DONE]" || payload.endsWith("[DONE]")) {
          if (!hasReceivedContent) {
            finalizeReject(new Error("EMPTY_STREAM"));
            return;
          }
          finalizeResolve();
          return;
        }

        const chunk = extractChunkFromPayload(payload);
        if (chunk) {
          hasReceivedContent = true;
          onChunk(chunk);
        }
      });

      es.addEventListener("error", (event) => {
        if (hasReceivedContent) {
          finalizeResolve();
          return;
        }

        const message = (event as any)?.message;
        if (event.type === "error" && message) {
          logger.error("SSE Error:", message);
          finalizeReject(new Error(message));
          return;
        }

        finalizeReject(new Error("No response received. Please try again."));
      });

      es.addEventListener("close", () => {
        if (hasReceivedContent) {
          finalizeResolve();
          return;
        }
        finalizeReject(new Error("EMPTY_STREAM"));
      });
    });
  };

  let lastError: Error | null = null;
  const maxAttempts = RETRY_DELAYS_MS.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await streamAttempt();
      return;
    } catch (error: any) {
      lastError = error;

      const message = String(error?.message || "");
      const isTimeoutError =
        message.includes("timed out") ||
        message.includes("STREAM_ATTEMPT_TIMEOUT") ||
        message.includes("STREAM_IDLE_TIMEOUT");
      if (isTimeoutError) {
        break;
      }

      const isLastAttempt = attempt === maxAttempts - 1;
      if (isLastAttempt) {
        break;
      }

      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  logger.error(
    "Edge Function Stream failed after retries:",
    lastError?.message || lastError,
  );

  // ✅ Final fallback: request non-stream response from the same function
  try {
    const fallbackText = await fetchNonStreamResponse(
      functionUrl,
      token || "",
      requestPayload,
    );
    onChunk(fallbackText);
    return;
  } catch (fallbackErr: any) {
    logger.error(
      "Non-stream fallback failed:",
      fallbackErr?.message || fallbackErr,
    );
  }

  // ✅ GRACEFUL DEGRADATION: Send user-friendly message instead of error
  const fallbackMessages: string[] = [
    "Sorry, I'm having trouble connecting. Give me a moment and try again? 💙",
    "My connection's acting up. Let's try again? 🥺",
    "I'm experiencing some technical difficulties. Please retry shortly. 💪",
    "Connection issue on my end. Retry and let's chat? 😊",
  ];
  const fallbackMessage =
    fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
  onChunk(fallbackMessage);
}

/**
 * Transcribe an audio file using the secure Supabase transcribe Edge Function.
 * The OpenAI API key is stored server-side — never exposed on the client.
 * @param audioUri The local URI to the recorded audio file (e.g. from expo-av).
 * @returns The transcribed text, or null on failure.
 */
export async function transcribeAudio(
  audioUri: string,
): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    logger.error("Missing Supabase env vars for transcription");
    return null;
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token || SUPABASE_ANON_KEY;

    const formData = new FormData();

    // React Native FormData accepts objects with uri/name/type for file uploads
    formData.append("file", {
      uri: audioUri,
      name: "audio.m4a",
      type: "audio/m4a",
    } as any);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/transcribe`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
        // NOTE: Do NOT set Content-Type — React Native will set multipart/form-data boundary automatically
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      logger.error("Transcribe edge function error:", err);
      return null;
    }

    const data = await response.json();
    return data?.text?.trim() || null;
  } catch (e: any) {
    logger.error("transcribeAudio error:", e?.message || e);
    return null;
  }
}
