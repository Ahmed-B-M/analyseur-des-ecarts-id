
import { initializeApp, getApps } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBXPrDd3SZDYpZvUpu1C9tfdBo31W89WpU",
  authDomain: "a-e-l-id.firebaseapp.com",
  projectId: "a-e-l-id",
  storageBucket: "a-e-l-id.appspot.com",
  messagingSenderId: "122118760915",
  appId: "1:122118760915:web:06e518b7209180c8d32726",
  measurementId: "G-S7CFGX42N7"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const analytics = getAnalytics(app);
const db = getFirestore(app);

export default app;
export { analytics, db };
