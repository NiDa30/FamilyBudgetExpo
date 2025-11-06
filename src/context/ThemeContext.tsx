// src/context/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeContextType {
  themeColor: string;
  setThemeColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  themeColor: '#1E88E5',
  setThemeColor: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeColor, setThemeColorState] = useState('#1E88E5');
  const THEME_KEY = 'app_theme_color';

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_KEY);
        if (saved) setThemeColorState(saved);
      } catch (error) {
        console.error('Lỗi tải theme:', error);
      }
    };
    loadTheme();
  }, []);

  const setThemeColor = async (color: string) => {
    try {
      await AsyncStorage.setItem(THEME_KEY, color);
      setThemeColorState(color);
    } catch (error) {
      console.error('Lỗi lưu theme:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ themeColor, setThemeColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);