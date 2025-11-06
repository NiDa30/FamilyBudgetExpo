import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc, getFirestore, deleteDoc } from "firebase/firestore";
import * as AuthSession from "expo-auth-session";

// NOTE: We assume Firebase is already initialized in the app
// Importing from project config keeps a single source of truth
import { auth as firebaseAuth } from "../../firebaseConfig";

export type RegisterPayload = {
  email: string;
  password: string;
  displayName?: string;
};

export type UpdateProfilePayload = {
  displayName?: string;
  photoURL?: string;
};

export const AuthService = {
  async registerWithEmail({ email, password, displayName }: RegisterPayload) {
    const auth = firebaseAuth || getAuth();
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(userCred.user, { displayName });
    }
    return userCred.user;
  },

  async loginWithEmail(email: string, password: string) {
    const auth = firebaseAuth || getAuth();
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    return userCred.user;
  },

  // Google login for Expo using AuthSession (native). Web can use signInWithPopup elsewhere if needed
  async loginWithGoogle(config: {
    expoClientId?: string;
    iosClientId?: string;
    androidClientId?: string;
    webClientId?: string;
  }) {
    const auth = firebaseAuth || getAuth();

    const discovery = {
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      revocationEndpoint: "https://oauth2.googleapis.com/revoke",
    } as const;

    const req = new AuthSession.AuthRequest({
      clientId: config.androidClientId || config.iosClientId || config.expoClientId || config.webClientId || "",
      responseType: AuthSession.ResponseType.IdToken,
      scopes: ["openid", "profile", "email"],
      redirectUri: AuthSession.makeRedirectUri(),
    });

    await req.makeAuthUrlAsync(discovery);
    const result = await req.promptAsync(discovery);

    if (result.type !== "success" || !result.params?.id_token) {
      throw new Error("Google login canceled or failed");
    }

    const provider = new GoogleAuthProvider();
    const credential = GoogleAuthProvider.credential(result.params.id_token);
    const userCred = await signInWithCredential(auth, credential);
    return userCred.user;
  },

  async sendResetEmail(email: string) {
    const auth = firebaseAuth || getAuth();
    await sendPasswordResetEmail(auth, email);
  },

  async updateUserProfile(updates: UpdateProfilePayload) {
    const auth = firebaseAuth || getAuth();
    if (!auth.currentUser) throw new Error("Not authenticated");
    await updateProfile(auth.currentUser, updates);
    return auth.currentUser;
  },

  async changePassword(currentPassword: string, newPassword: string) {
    const auth = firebaseAuth || getAuth();
    if (!auth.currentUser || !auth.currentUser.email) throw new Error("Not authenticated");
    const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, cred);
    await updatePassword(auth.currentUser, newPassword);
  },

  async deleteAccountAndData(userId: string) {
    const auth = firebaseAuth || getAuth();
    const db = getFirestore();

    // Delete user document (and let CF/Rules handle cascading tasks if any)
    try {
      await deleteDoc(doc(db, "USER", userId));
    } catch (e) {
      // ignore if not exists
    }

    if (!auth.currentUser) throw new Error("Not authenticated");
    await deleteUser(auth.currentUser);
  },
};


