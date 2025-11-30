/**
 * Voice Input Button Component
 * Floating action button for voice input
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Text,
  Modal,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import VoiceInputService, {
  SupportedLanguage,
  VoiceCommandResult,
} from '../services/VoiceInputService';
import { useTheme } from '../context/ThemeContext';

interface VoiceInputButtonProps {
  onCommandParsed: (result: VoiceCommandResult) => void;
  language?: SupportedLanguage;
  position?: 'bottom-right' | 'bottom-center' | 'bottom-left';
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onCommandParsed,
  language = 'vi-VN',
  position = 'bottom-right',
}) => {
  const { themeColor } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [pulseAnim] = useState(new Animated.Value(1));

  // Pulse animation when recording
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const handlePress = async () => {
    if (isRecording) {
      // Stop recording
      await stopRecording();
    } else {
      // Start recording
      await startRecording();
    }
  };

  const startRecording = async () => {
    try {
      setShowModal(true);
      const success = await VoiceInputService.startRecording(language);
      
      if (success) {
        setIsRecording(true);
        setRecognizedText('Listening...');
        
        // Speak feedback
        const feedbackText = language === 'vi-VN' 
          ? 'Tôi đang nghe'
          : language === 'en-US'
          ? 'Listening'
          : '聞いています';
          
        await VoiceInputService.speak(feedbackText, language);
      } else {
        setShowModal(false);
        alert('Failed to start recording. Please check microphone permissions.');
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      setShowModal(false);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      setIsProcessing(true);
      setRecognizedText('Processing...');

      const audioUri = await VoiceInputService.stopRecording();
      
      if (audioUri) {
        // Convert speech to text
        const text = await VoiceInputService.speechToText(audioUri, language);
        setRecognizedText(text);

        // Parse command
        const result = VoiceInputService.parseVoiceCommand(text, language);

        // Provide feedback
        if (result.type !== 'unknown') {
          const feedbackText = language === 'vi-VN'
            ? 'Đã hiểu'
            : language === 'en-US'
            ? 'Got it'
            : 'わかりました';
          
          await VoiceInputService.speak(feedbackText, language);
          
          // Pass result to parent
          onCommandParsed(result);
          
          // Close modal after delay
          setTimeout(() => {
            setShowModal(false);
            setRecognizedText('');
          }, 1500);
        } else {
          const feedbackText = language === 'vi-VN'
            ? 'Xin lỗi, tôi không hiểu'
            : language === 'en-US'
            ? 'Sorry, I did not understand'
            : 'すみません、わかりませんでした';
          
          setRecognizedText(feedbackText);
          await VoiceInputService.speak(feedbackText, language);
          
          setTimeout(() => {
            setShowModal(false);
            setRecognizedText('');
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      setRecognizedText('Error processing voice input');
      setTimeout(() => {
        setShowModal(false);
        setRecognizedText('');
      }, 2000);
    } finally {
      setIsProcessing(false);
    }
  };

  const getPositionStyle = () => {
    switch (position) {
      case 'bottom-center':
        return { bottom: 20, alignSelf: 'center' };
      case 'bottom-left':
        return { bottom: 20, left: 20 };
      case 'bottom-right':
      default:
        return { bottom: 20, right: 20 };
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <Animated.View
        style={[
          styles.fab,
          getPositionStyle(),
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.fabButton,
            { backgroundColor: isRecording ? '#f44336' : themeColor },
          ]}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          <Icon
            name={isRecording ? 'stop' : 'microphone'}
            size={28}
            color="#fff"
          />
        </TouchableOpacity>
      </Animated.View>

      {/* Voice Input Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isRecording && !isProcessing) {
            setShowModal(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Microphone Icon */}
            <View style={[styles.iconContainer, { backgroundColor: themeColor }]}>
              <Icon
                name={isRecording ? 'microphone' : isProcessing ? 'cog' : 'check'}
                size={48}
                color="#fff"
              />
            </View>

            {/* Status Text */}
            <Text style={styles.statusText}>
              {isRecording
                ? language === 'vi-VN'
                  ? 'Đang nghe...'
                  : language === 'en-US'
                  ? 'Listening...'
                  : '聞いています...'
                : isProcessing
                ? language === 'vi-VN'
                  ? 'Đang xử lý...'
                  : language === 'en-US'
                  ? 'Processing...'
                  : '処理中...'
                : language === 'vi-VN'
                ? 'Hoàn tất'
                : language === 'en-US'
                ? 'Done'
                : '完了'}
            </Text>

            {/* Recognized Text */}
            {recognizedText && (
              <Text style={styles.recognizedText}>{recognizedText}</Text>
            )}

            {/* Loading Indicator */}
            {isProcessing && <ActivityIndicator size="large" color={themeColor} />}

            {/* Action Buttons */}
            {isRecording && (
              <TouchableOpacity
                style={[styles.stopButton, { backgroundColor: '#f44336' }]}
                onPress={stopRecording}
              >
                <Text style={styles.stopButtonText}>
                  {language === 'vi-VN'
                    ? 'Dừng'
                    : language === 'en-US'
                    ? 'Stop'
                    : '停止'}
                </Text>
              </TouchableOpacity>
            )}

            {!isRecording && !isProcessing && (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.closeButtonText}>
                  {language === 'vi-VN'
                    ? 'Đóng'
                    : language === 'en-US'
                    ? 'Close'
                    : '閉じる'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    zIndex: 1000,
  },
  fabButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    minWidth: 280,
    maxWidth: '80%',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 10,
  },
  recognizedText: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  stopButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  closeButtonText: {
    color: '#757575',
    fontSize: 14,
  },
});

export default VoiceInputButton;
