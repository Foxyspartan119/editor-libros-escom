// src/firebase.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyClukiCJsusdmwkaQHepGsILMfczgPrDhU",
  authDomain: "mathbook-engine.firebaseapp.com",
  projectId: "mathbook-engine",
  storageBucket: "mathbook-engine.firebasestorage.app",
  messagingSenderId: "469440264696",
  appId: "1:469440264696:web:6f91558beb97f8a2797e0d"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);