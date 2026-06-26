import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

/**
 * Firebase web app for student phone-OTP login. All values are public
 * (NEXT_PUBLIC_*) — Firebase web config is meant to ship in the browser; the
 * real protection is the verified phone number + our server-side token check.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function firebaseAuth(): Auth {
  const app = getApps().length ? getApp() : initializeApp(config);
  const auth = getAuth(app);
  auth.useDeviceLanguage();
  return auth;
}

export const isFirebaseConfigured = Boolean(config.apiKey && config.appId);
