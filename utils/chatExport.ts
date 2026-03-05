/**
 * Chat Export Service
 * 
 * Exports chat conversations to PDF or text format
 * Pro feature only
 */

import { Alert } from "react-native";
// @ts-ignore - FileSystem API
import * as FileSystem from "expo-file-system";
// @ts-ignore - Sharing types not available
import * as Sharing from "expo-sharing";
import { logger } from "./logger";

// Get the document directory path
// @ts-ignore
const getDocumentDirectory = (): string => {
  // @ts-ignore
  return FileSystem.documentDirectory || `${FileSystem.cacheDirectory}../Documents/`;
};

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

/**
 * Export chat as formatted text
 */
export const exportAsText = (
  messages: ChatMessage[],
  companionName: string,
  userName: string,
): string => {
  let text = `Chat with ${companionName}\n`;
  text += `Export date: ${new Date().toLocaleString()}\n`;
  text += `================================\n\n`;

  messages.forEach((msg) => {
    const sender = msg.role === "user" ? userName : companionName;
    const time = msg.timestamp ? `[${new Date(msg.timestamp).toLocaleTimeString()}] ` : "";
    text += `${time}${sender}:\n${msg.content}\n\n`;
  });

  return text;
};

/**
 * Share exported chat via system share sheet
 */
export const shareChat = async (
  messages: ChatMessage[],
  companionName: string,
  userName: string,
  format: "text" | "pdf" = "text",
): Promise<boolean> => {
  try {
    const fileName = `${companionName}_chat_${new Date().toISOString().split("T")[0]}.${format === "text" ? "txt" : "pdf"}`;
    const filePath = `${getDocumentDirectory()}${fileName}`;

    // Generate content
    const content = exportAsText(messages, companionName, userName);

    // Write to file
    await FileSystem.writeAsStringAsync(
      filePath, 
      content
    );

    // Share file
    const isShareAvailable = await Sharing.isAvailableAsync();
    if (isShareAvailable) {
      await Sharing.shareAsync(filePath, {
        mimeType: format === "text" ? "text/plain" : "application/pdf",
        dialogTitle: `Share ${companionName} Chat`,
      });
      logger.info(`Chat exported as ${format}`);
      return true;
    } else {
      Alert.alert(
        "Share Not Available",
        "Your device doesn't support sharing. File saved locally.",
      );
      return false;
    }
  } catch (error: any) {
    logger.error("Error exporting chat:", error.message);
    Alert.alert("Export Failed", "Could not export chat. Please try again.");
    return false;
  }
};

/**
 * Save chat locally without sharing
 */
export const saveChat = async (
  messages: ChatMessage[],
  companionName: string,
  userName: string,
): Promise<string | null> => {
  try {
    const fileName = `${companionName}_chat_${new Date().toISOString().split("T")[0]}.txt`;
    const filePath = `${getDocumentDirectory()}${fileName}`;

    const content = exportAsText(messages, companionName, userName);
    await FileSystem.writeAsStringAsync(filePath, content);

    logger.info(`Chat saved to: ${filePath}`);
    return filePath;
  } catch (error: any) {
    logger.error("Error saving chat:", error.message);
    return null;
  }
};

/**
 * Format messages for pretty display
 */
export const formatMessagesForExport = (
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): ChatMessage[] => {
  return messages.map((msg) => ({
    ...msg,
    timestamp: new Date().toISOString(),
  }));
};

export default {
  exportAsText,
  shareChat,
  saveChat,
  formatMessagesForExport,
};
