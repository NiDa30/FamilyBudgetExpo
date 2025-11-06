import { authInstance as auth } from "../../firebaseConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_KEY = "@user_session";

/**
 * Check if user is authenticated
 * This function checks both Firebase auth state and local storage
 */
export const checkAuthState = async (): Promise<boolean> => {
  try {
    // First check Firebase auth state
    if (auth.currentUser) {
      return true;
    }

    // If no Firebase user, check local storage for stored session
    const storedSession = await AsyncStorage.getItem(SESSION_KEY);
    if (storedSession) {
      // We have a stored session, but Firebase is not authenticated
      // This could happen if the app was closed and reopened
      console.log("Found stored session, but no active Firebase auth");
      return true;
    }

    // No authentication found
    return false;
  } catch (error) {
    console.error("Error checking auth state:", error);
    return false;
  }
};

/**
 * Initialize auth state when app starts
 * This function should be called during app initialization
 */
export const initializeAuthState = async (): Promise<void> => {
  try {
    // Check if we have a stored session
    const storedSession = await AsyncStorage.getItem(SESSION_KEY);
    if (storedSession) {
      console.log("✅ Found stored user session");
      // The Firebase SDK should automatically restore the session
      // But we can use the stored data if needed
    } else {
      console.log("ℹ️ No stored user session found");
    }
  } catch (error) {
    console.error("Error initializing auth state:", error);
  }
};

/**
 * Clear all auth data
 * This function should be called when logging out
 */
export const clearAuthState = async (): Promise<void> => {
  try {
    // Clear local storage
    await AsyncStorage.removeItem(SESSION_KEY);

    console.log("✅ Auth state cleared successfully");
  } catch (error) {
    console.error("Error clearing auth state:", error);
  }
};
