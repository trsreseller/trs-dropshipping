import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB0cC_AMQOLF8YpDOeLy0NKjdqhgyiTTso",
  authDomain: "trs-drop-shipping.firebaseapp.com",
  projectId: "trs-drop-shipping",
  storageBucket: "trs-drop-shipping.firebasestorage.app",
  messagingSenderId: "186999059126",
  appId: "1:186999059126:web:d5d9cf62aeb2af1a766c17"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);