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
  rate: 0.95,
  pitch: 1.05,
  volume: 1.0,
  language: "en-US",
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

/**
 * Get the best available voice for a given language and role
 */
export const getBestVoice = async (language: string, role: string): Promise<string | undefined> => {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    if (!voices || voices.length === 0) return undefined;

    const langCode = getVoiceLanguageCode(language);
    const primaryLang = langCode.split('-')[0].toLowerCase();

    // Filter voices that match the primary language
    const langVoices = voices.filter(v => v.language.toLowerCase().startsWith(primaryLang));

    if (langVoices.length === 0) return undefined;

    // 1. Prioritize Enhanced voices for quality
    // @ts-ignore
    const enhancedVoices = langVoices.filter(v => v.quality === 'Enhanced' || v.quality === 1);

    // 2. Map role to potential voice gender/tone (heuristic-based)
    const isMaleRole = ['father', 'boyfriend'].includes(role.toLowerCase());
    const isFemaleRole = ['mother', 'girlfriend'].includes(role.toLowerCase());

    let candidates = enhancedVoices.length > 0 ? enhancedVoices : langVoices;

    if (isMaleRole) {
      const maleNames = ['Aaron', 'Daniel', 'Gordon', 'Nicky', 'Rishi', 'Fred'];
      const maleVoice = candidates.find(v => maleNames.some(name => v.name.includes(name)));
      if (maleVoice) return maleVoice.identifier;
    } else if (isFemaleRole) {
      const femaleNames = ['Samantha', 'Siri', 'Karen', 'Moira', 'Tessa', 'Veena'];
      const femaleVoice = candidates.find(v => femaleNames.some(name => v.name.includes(name)));
      if (femaleVoice) return femaleVoice.identifier;
    }

    // Default to the first enhanced voice or just the first language voice
    return candidates[0].identifier;
  } catch (err) {
    logger.warn("Could not fetch available voices:", err);
    return undefined;
  }
};

/**
 * Speak AI response text using device text-to-speech
 * @param text - Text to speak
 * @param options - Voice options
 * @param role - Companion role for voice matching
 */
export const speakMessage = async (
  text: string,
  options: VoiceOptions = DEFAULT_VOICE_OPTIONS,
  role: string = 'friend'
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      if (!text || text.trim().length === 0) {
        resolve();
        return;
      }

      const available = await Speech.isSpeakingAsync();
      if (available) await Speech.stop();

      // Find the best voice for this session
      const voiceId = await getBestVoice(options.language || 'english', role);

      // Clean text for better speech (remove asterisks, weird symbols often used in AI markdown)
      const cleanText = text.replace(/[*_]/g, '').trim();

      Speech.speak(cleanText, {
        voice: voiceId,
        rate: options.rate || DEFAULT_VOICE_OPTIONS.rate!,
        pitch: options.pitch || DEFAULT_VOICE_OPTIONS.pitch!,
        volume: options.volume || DEFAULT_VOICE_OPTIONS.volume!,
        language: options.language || DEFAULT_VOICE_OPTIONS.language!,
        onDone: () => resolve(),
        onError: (error: Error) => {
          logger.error("Voice Error:", error.message);
          reject(error);
        },
        onStopped: () => resolve()
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
    return true;
  } catch {
    return false;
  }
};

export default {
  speakMessage,
  stopSpeech,
  isVoiceSupported,
  getVoiceLanguageCode,
  getBestVoice,
};
