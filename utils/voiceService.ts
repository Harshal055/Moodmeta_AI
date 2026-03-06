/**
 * Voice Message Service
 *
 * Converts AI text responses to voice using expo-speech
 * Pro feature only
 */

// @ts-ignore - expo-speech types not available
import * as Speech from "expo-speech";
import { logger } from "./logger";

export interface VoiceOptions {
  rate?: number; // 0.5 - 2.0 (default 1.0)
  pitch?: number; // 0.5 - 2.0 (default 1.0)
  volume?: number; // 0 - 1 (default 1.0)
  language?: string; // 'en-US', 'hi-IN', etc.
}

export const DEFAULT_VOICE_OPTIONS: VoiceOptions = {
  rate: 0.9,
  pitch: 1.1,
  volume: 1.0,
  language: "en-US",
};

/**
 * Speak AI response text using device text-to-speech
 * @param text - Text to speak
 * @param options - Voice options (rate, pitch, volume, language)
 * @returns Promise that resolves when speech completes
 */
export const speakMessage = async (
  text: string,
  options: VoiceOptions = DEFAULT_VOICE_OPTIONS,
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      // Validate input
      if (!text || text.trim().length === 0) {
        logger.warn("Cannot speak empty message");
        resolve();
        return;
      }

      // Check if speech is available
      const available = await Speech.isSpeakingAsync();
      if (available) {
        // Stop current speech first
        await Speech.stop();
      }

      // Speak the message with callbacks
      Speech.speak(text, {
        rate: options.rate || DEFAULT_VOICE_OPTIONS.rate!,
        pitch: options.pitch || DEFAULT_VOICE_OPTIONS.pitch!,
        volume: options.volume || DEFAULT_VOICE_OPTIONS.volume!,
        language: options.language || DEFAULT_VOICE_OPTIONS.language!,
        onDone: () => {
          logger.info("Voice message played successfully");
          resolve();
        },
        onError: (error: Error) => {
          logger.error("Error playing voice message:", error.message);
          reject(error);
        },
        onStopped: () => {
          logger.info("Voice message stopped manually");
          resolve();
        }
      });
    } catch (error: any) {
      logger.error("Error starting voice message:", error.message);
      reject(error);
    }
  });
};

/**
 * Stop current voice playback
 */
export const stopSpeech = async (): Promise<void> => {
  try {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) {
      await Speech.stop();
      logger.info("Voice stopped");
    }
  } catch (error: any) {
    logger.error("Error stopping speech:", error.message);
  }
};

/**
 * Check if device supports text-to-speech
 */
export const isVoiceSupported = async (): Promise<boolean> => {
  try {
    // Voice is supported on both iOS and Android
    // Returns true for these platforms
    return true;
  } catch {
    return false;
  }
};

/**
 * Set voice language based on user's chat language preference
 */
export const getVoiceLanguageCode = (chatLanguage: string): string => {
  const languageMap: Record<string, string> = {
    english: "en-US",
    hindi: "hi-IN",
    hinglish: "hi-IN", // Hindi for Hinglish
  };

  return languageMap[chatLanguage.toLowerCase()] || "en-US";
};

export default {
  speakMessage,
  stopSpeech,
  isVoiceSupported,
  getVoiceLanguageCode,
};
