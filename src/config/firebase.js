// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { signOut } from "firebase/auth";
import { doc, getFirestore, setDoc } from "firebase/firestore";

import toast from "react-hot-toast";


const firebaseConfig = {
  apiKey: "AIzaSyBA_t0znfIu-Qm8lI-RLCjr3ZKLk8r_d_k",
  authDomain: "chat-f1da8.firebaseapp.com",
  projectId: "chat-f1da8",
  storageBucket: "chat-f1da8.firebasestorage.app",
  messagingSenderId: "33013702772",
  appId: "1:33013702772:web:77b9b85e5639c076c97121",
  measurementId: "G-XEX508JKMT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app)
const db = getFirestore(app)

const signUpUser = async (username, email, password, profilePic) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const useref = doc(db, "users", user.uid);
    await setDoc(useref, {
      username: username.toLowerCase(),
      email: email,
      profilePic: profilePic,
      id: user.uid,
      bio: "Hey there! I am using Chat App",
      lastSeen: Date.now(),
    });

    const userChatRef = doc(db, "userChats", user.uid);

    await setDoc(userChatRef, {
      chatData: []
    })

    return true

  } catch (error) {
    console.error("Error signing up:", error);
    toast.error("Error signing up: " + error.code.split('/')[1].split('-').join(' '));
    return false;
  }
}

export const LogInUser = async (email, password) => {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return true;
  } catch (error) {
    console.error("Error logging in:", error);
    toast.error("Error logging in: " + error.code.split('/')[1].split('-').join(' '));
    return false;
  }
}

export const LogOutUser = async () => {
  try {
    await signOut(auth);
    toast.success("Logged out successfully");
    return true;
  } catch (error) {
    console.error("Error logging out:", error);
    toast.error("Error logging out: " + error.code.split('/')[1].split('-').join(' '));
  }
}

export { signUpUser,auth,db }