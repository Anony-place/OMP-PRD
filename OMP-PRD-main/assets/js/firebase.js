/* ============================================================
   Firebase configuration for OopsMyPassword
   Initialize Firebase and export core services
   ============================================================ */

// Import the Firebase modules you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA6JtwlYtoVW-pw5dSeV9HWF5aslVEmId0",
  authDomain: "password-e9a30.firebaseapp.com",
  projectId: "password-e9a30",
  storageBucket: "password-e9a30.firebasestorage.app",
  messagingSenderId: "319939285143",
  appId: "1:319939285143:web:e09d2568d37cd678a599d2",
  measurementId: "G-MDDWLJ30J9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics
const analytics = getAnalytics(app);

export { app, analytics };