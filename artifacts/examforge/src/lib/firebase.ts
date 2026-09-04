import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAU14e2SCKMIT-nuLcEqxcXrajDoaTGgw8",
  authDomain: "striped-domain-898sv.firebaseapp.com",
  projectId: "striped-domain-898sv",
  storageBucket: "striped-domain-898sv.firebasestorage.app",
  messagingSenderId: "858006059691",
  appId: "1:858006059691:web:ef6eec33c7df186010d5ee",
};

// Initialize Firebase only if not already initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firestore with named database
const DATABASE_ID = "ai-studio-examforgehub-9d3a031d-142b-4906-8aeb-9298372cc136";
export const db = getFirestore(app, DATABASE_ID);
