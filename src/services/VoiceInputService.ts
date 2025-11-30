/**
 * Voice Input Service
 * Handles voice-to-text and voice command parsing
 * Supports multiple languages (VI, EN, JP)
 */

import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export type SupportedLanguage = 'vi-VN' | 'en-US' | 'ja-JP';

export interface VoiceCommandResult {
  type: 'transaction' | 'query' | 'unknown';
  action?: 'add_income' | 'add_expense' | 'search' | 'show_report';
  data?: {
    amount?: number;
    description?: string;
    category?: string;
    date?: string;
    transactionType?: 'INCOME' | 'EXPENSE';
  };
  rawText: string;
  confidence: number;
  language: SupportedLanguage;
}

export interface VoiceRecognitionOptions {
  language: SupportedLanguage;
  maxDuration?: number; // seconds
  interimResults?: boolean;
}

class VoiceInputService {
  private recording: Audio.Recording | null = null;
  private isRecording = false;
  private currentLanguage: SupportedLanguage = 'vi-VN';

  /**
   * Request microphone permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }

  /**
   * Start voice recording
   */
  async startRecording(language: SupportedLanguage = 'vi-VN'): Promise<boolean> {
    try {
      if (this.isRecording) {
        console.warn('Already recording');
        return false;
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Microphone permission not granted');
      }

      this.currentLanguage = language;

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create recording
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      this.recording = recording;
      this.isRecording = true;
      
      return true;
    } catch (error) {
      console.error('Error starting recording:', error);
      return false;
    }
  }

  /**
   * Stop recording and get audio file
   */
  async stopRecording(): Promise<string | null> {
    try {
      if (!this.recording || !this.isRecording) {
        console.warn('Not recording');
        return null;
      }

      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      
      this.isRecording = false;
      this.recording = null;

      return uri;
    } catch (error) {
      console.error('Error stopping recording:', error);
      return null;
    }
  }

  /**
   * Convert speech to text using Web Speech API (browser) or native (mobile)
   * Note: This is a simplified version. For production, use services like:
   * - Google Cloud Speech-to-Text
   * - AWS Transcribe
   * - Azure Speech
   */
  async speechToText(audioUri: string, language: SupportedLanguage): Promise<string> {
    try {
      // For now, we'll use a mock implementation
      // In production, you would send the audio to a speech recognition service
      
      // Example with Google Cloud Speech-to-Text:
      // const response = await fetch('https://speech.googleapis.com/v1/speech:recognize', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     config: {
      //       encoding: 'LINEAR16',
      //       sampleRateHertz: 44100,
      //       languageCode: language,
      //     },
      //     audio: { uri: audioUri }
      //   })
      // });

      // Mock implementation
      console.warn('Speech-to-text not fully implemented. Using mock data.');
      return 'Thêm 50 nghìn tiền ăn trưa'; // Mock result
    } catch (error) {
      console.error('Error in speech-to-text:', error);
      throw error;
    }
  }

  /**
   * Parse voice command text into structured data
   */
  parseVoiceCommand(text: string, language: SupportedLanguage): VoiceCommandResult {
    const lowerText = text.toLowerCase().trim();

    // Vietnamese patterns
    if (language === 'vi-VN') {
      return this.parseVietnamese(lowerText);
    }
    
    // English patterns
    if (language === 'en-US') {
      return this.parseEnglish(lowerText);
    }

    // Japanese patterns
    if (language === 'ja-JP') {
      return this.parseJapanese(lowerText);
    }

    return {
      type: 'unknown',
      rawText: text,
      confidence: 0,
      language,
    };
  }

  /**
   * Parse Vietnamese voice commands
   */
  private parseVietnamese(text: string): VoiceCommandResult {
    // Pattern: "thêm [số tiền] [mô tả]"
    // Examples:
    // - "thêm 50 nghìn tiền ăn trưa"
    // - "chi 100k mua cà phê"
    // - "thu nhập 5 triệu lương tháng"

    const patterns = [
      // Add expense
      {
        regex: /(?:thêm|chi|mua)\s+(\d+(?:\.\d+)?)\s*(?:k|nghìn|triệu|tr|m)?\s+(.+)/i,
        type: 'add_expense' as const,
        transactionType: 'EXPENSE' as const,
      },
      // Add income
      {
        regex: /(?:thu|nhận|lương|thu nhập)\s+(\d+(?:\.\d+)?)\s*(?:k|nghìn|triệu|tr|m)?\s+(.+)/i,
        type: 'add_income' as const,
        transactionType: 'INCOME' as const,
      },
      // Search
      {
        regex: /(?:tìm|xem|hiển thị)\s+(.+)/i,
        type: 'search' as const,
      },
      // Show report
      {
        regex: /(?:báo cáo|thống kê|biểu đồ)/i,
        type: 'show_report' as const,
      },
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        if (pattern.type === 'add_expense' || pattern.type === 'add_income') {
          const amountStr = match[1];
          const description = match[2]?.trim();
          
          // Parse multiplier (k, nghìn, triệu, etc.)
          let multiplier = 1;
          if (text.includes('triệu') || text.includes('tr') || text.includes('m')) {
            multiplier = 1000000;
          } else if (text.includes('k') || text.includes('nghìn')) {
            multiplier = 1000;
          }

          const amount = parseFloat(amountStr) * multiplier;

          return {
            type: 'transaction',
            action: pattern.type,
            data: {
              amount,
              description: description || '',
              transactionType: pattern.transactionType,
            },
            rawText: text,
            confidence: 0.8,
            language: 'vi-VN',
          };
        }

        if (pattern.type === 'search') {
          return {
            type: 'query',
            action: 'search',
            data: {
              description: match[1]?.trim(),
            },
            rawText: text,
            confidence: 0.7,
            language: 'vi-VN',
          };
        }

        if (pattern.type === 'show_report') {
          return {
            type: 'query',
            action: 'show_report',
            rawText: text,
            confidence: 0.9,
            language: 'vi-VN',
          };
        }
      }
    }

    return {
      type: 'unknown',
      rawText: text,
      confidence: 0,
      language: 'vi-VN',
    };
  }

  /**
   * Parse English voice commands
   */
  private parseEnglish(text: string): VoiceCommandResult {
    // Pattern: "add [amount] for [description]"
    // Examples:
    // - "add 50 dollars for lunch"
    // - "spend 100 on coffee"
    // - "income 5000 salary"

    const patterns = [
      // Add expense
      {
        regex: /(?:add|spend|pay)\s+(\d+(?:\.\d+)?)\s*(?:k|thousand|million)?\s+(?:for|on)\s+(.+)/i,
        type: 'add_expense' as const,
        transactionType: 'EXPENSE' as const,
      },
      // Add income
      {
        regex: /(?:income|earn|receive|salary)\s+(\d+(?:\.\d+)?)\s*(?:k|thousand|million)?\s+(.+)/i,
        type: 'add_income' as const,
        transactionType: 'INCOME' as const,
      },
      // Search
      {
        regex: /(?:find|search|show)\s+(.+)/i,
        type: 'search' as const,
      },
      // Show report
      {
        regex: /(?:report|statistics|chart)/i,
        type: 'show_report' as const,
      },
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        if (pattern.type === 'add_expense' || pattern.type === 'add_income') {
          const amountStr = match[1];
          const description = match[2]?.trim();
          
          let multiplier = 1;
          if (text.includes('million')) {
            multiplier = 1000000;
          } else if (text.includes('thousand') || text.includes('k')) {
            multiplier = 1000;
          }

          const amount = parseFloat(amountStr) * multiplier;

          return {
            type: 'transaction',
            action: pattern.type,
            data: {
              amount,
              description: description || '',
              transactionType: pattern.transactionType,
            },
            rawText: text,
            confidence: 0.8,
            language: 'en-US',
          };
        }

        if (pattern.type === 'search') {
          return {
            type: 'query',
            action: 'search',
            data: {
              description: match[1]?.trim(),
            },
            rawText: text,
            confidence: 0.7,
            language: 'en-US',
          };
        }

        if (pattern.type === 'show_report') {
          return {
            type: 'query',
            action: 'show_report',
            rawText: text,
            confidence: 0.9,
            language: 'en-US',
          };
        }
      }
    }

    return {
      type: 'unknown',
      rawText: text,
      confidence: 0,
      language: 'en-US',
    };
  }

  /**
   * Parse Japanese voice commands
   */
  private parseJapanese(text: string): VoiceCommandResult {
    // Pattern: "[金額]円 [説明]"
    // Examples:
    // - "5000円 ランチ"
    // - "10万円 給料"

    const patterns = [
      // Add expense
      {
        regex: /(\d+(?:\.\d+)?)\s*(?:円|万円)\s+(.+)/i,
        type: 'add_expense' as const,
        transactionType: 'EXPENSE' as const,
      },
      // Add income
      {
        regex: /(?:収入|給料|売上)\s+(\d+(?:\.\d+)?)\s*(?:円|万円)\s+(.+)/i,
        type: 'add_income' as const,
        transactionType: 'INCOME' as const,
      },
      // Search
      {
        regex: /(?:検索|探す|表示)\s+(.+)/i,
        type: 'search' as const,
      },
      // Show report
      {
        regex: /(?:レポート|統計|グラフ)/i,
        type: 'show_report' as const,
      },
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        if (pattern.type === 'add_expense' || pattern.type === 'add_income') {
          const amountStr = match[1];
          const description = match[2]?.trim();
          
          let multiplier = 1;
          if (text.includes('万円')) {
            multiplier = 10000;
          }

          const amount = parseFloat(amountStr) * multiplier;

          return {
            type: 'transaction',
            action: pattern.type,
            data: {
              amount,
              description: description || '',
              transactionType: pattern.transactionType,
            },
            rawText: text,
            confidence: 0.8,
            language: 'ja-JP',
          };
        }

        if (pattern.type === 'search') {
          return {
            type: 'query',
            action: 'search',
            data: {
              description: match[1]?.trim(),
            },
            rawText: text,
            confidence: 0.7,
            language: 'ja-JP',
          };
        }

        if (pattern.type === 'show_report') {
          return {
            type: 'query',
            action: 'show_report',
            rawText: text,
            confidence: 0.9,
            language: 'ja-JP',
          };
        }
      }
    }

    return {
      type: 'unknown',
      rawText: text,
      confidence: 0,
      language: 'ja-JP',
    };
  }

  /**
   * Text-to-speech for feedback
   */
  async speak(text: string, language: SupportedLanguage): Promise<void> {
    try {
      const languageCode = language.split('-')[0]; // vi-VN -> vi
      await Speech.speak(text, {
        language: languageCode,
        pitch: 1.0,
        rate: 1.0,
      });
    } catch (error) {
      console.error('Error in text-to-speech:', error);
    }
  }

  /**
   * Stop speaking
   */
  async stopSpeaking(): Promise<void> {
    try {
      await Speech.stop();
    } catch (error) {
      console.error('Error stopping speech:', error);
    }
  }

  /**
   * Check if currently recording
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }
}

export default new VoiceInputService();
