import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Line, Path, Rect, Text as SvgText } from "react-native-svg";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

interface CaptchaProps {
  onValidate: (isValid: boolean) => void;
  value: string;
  onChangeText: (text: string) => void;
}

const Captcha: React.FC<CaptchaProps> = ({
  onValidate,
  value,
  onChangeText,
}) => {
  const [captchaText, setCaptchaText] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);

  useEffect(() => {
    generateCaptcha();
  }, []);

  useEffect(() => {
    // Validate whenever user types
    if (value) {
      const isValid = value.toLowerCase() === captchaText.toLowerCase();
      onValidate(isValid);
    } else {
      onValidate(false);
    }
  }, [value, captchaText]);

  const generateCaptcha = () => {
    // Generate random 6-character alphanumeric string
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluding confusing chars like O, 0, I, 1
    let text = "";
    for (let i = 0; i < 6; i++) {
      text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaText(text);
    onChangeText("");
    setCaptchaKey((prev) => prev + 1); // Force re-render
  };

  const renderCaptchaSvg = () => {
    const width = 280;
    const height = 100;
    const chars = captchaText.split("");

    // Generate random lines for noise
    const generateNoiseLine = (index: number) => {
      const x1 = Math.random() * width;
      const y1 = Math.random() * height;
      const x2 = Math.random() * width;
      const y2 = Math.random() * height;
      const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8"];
      return (
        <Line
          key={`line-${index}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={colors[index % colors.length]}
          strokeWidth="1.5"
          opacity="0.3"
        />
      );
    };

    const noiseLines = Array.from({ length: 5 }, (_, i) =>
      generateNoiseLine(i)
    );

    return (
      <Svg width={width} height={height} key={captchaKey}>
        {/* Background with gradient effect */}
        <Rect width={width} height={height} fill="#f8f9fa" />

        {/* Noise lines */}
        {noiseLines}

        {/* CAPTCHA text with random rotation and position */}
        {chars.map((char, index) => {
          const x = 20 + index * 42;
          const y = 55 + (Math.random() - 0.5) * 15;
          const rotation = (Math.random() - 0.5) * 25;
          const colors = [
            "#1E88E5",
            "#930f2aff",
            "#43A047",
            "#E91E63",
            "#FF6F00",
            "#5E35B1",
          ];
          const color = colors[index % colors.length];

          return (
            <SvgText
              key={`char-${index}`}
              x={x}
              y={y}
              fontSize="36"
              fontWeight="bold"
              fill={color}
              rotation={rotation}
              origin={`${x}, ${y}`}
              fontFamily="monospace"
            >
              {char}
            </SvgText>
          );
        })}

        {/* Additional noise patterns */}
        {Array.from({ length: 30 }, (_, i) => {
          const cx = Math.random() * width;
          const cy = Math.random() * height;
          return (
            <Path
              key={`dot-${i}`}
              d={`M ${cx} ${cy} L ${cx + 2} ${cy}`}
              stroke="#999"
              strokeWidth="2"
              opacity="0.4"
            />
          );
        })}
      </Svg>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Mã xác minh</Text>

      {/* CAPTCHA Image */}
      <View style={styles.captchaContainer}>
        <View style={styles.captchaImage}>{renderCaptchaSvg()}</View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={generateCaptcha}
        >
          <Icon name="refresh" size={24} color="#1E88E5" />
        </TouchableOpacity>
      </View>

      {/* CAPTCHA Input */}
      <View style={styles.inputWrapper}>
        <View
          style={[
            styles.inputContainer,
            value && value.toLowerCase() === captchaText.toLowerCase()
              ? styles.inputValid
              : value
              ? styles.inputInvalid
              : {},
          ]}
        >
          <Icon name="shield-check-outline" size={22} color="#9E9E9E" />
          <TextInput
            style={styles.input}
            placeholder="Nhập mã xác minh"
            placeholderTextColor="#BDBDBD"
            value={value}
            onChangeText={onChangeText}
            autoCapitalize="characters"
            maxLength={6}
          />
          {value && value.toLowerCase() === captchaText.toLowerCase() && (
            <Icon name="check-circle" size={22} color="#4CAF50" />
          )}
          {value &&
            value.length > 0 &&
            value.toLowerCase() !== captchaText.toLowerCase() && (
              <Icon name="close-circle" size={22} color="#F44336" />
            )}
        </View>
        <Text style={styles.hint}>
          Nhập đúng 6 ký tự hiển thị trong ảnh (không phân biệt hoa thường)
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#424242",
    marginBottom: 8,
  },
  captchaContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  captchaImage: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  refreshButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#BBDEFB",
  },
  inputWrapper: {
    width: "100%",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: "#FAFAFA",
    height: 56,
  },
  inputValid: {
    borderColor: "#4CAF50",
    backgroundColor: "#F1F8F4",
  },
  inputInvalid: {
    borderColor: "#F44336",
    backgroundColor: "#FFF5F5",
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#212121",
    marginLeft: 12,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  hint: {
    fontSize: 12,
    color: "#757575",
    marginTop: 6,
    fontStyle: "italic",
  },
});

export default Captcha;
