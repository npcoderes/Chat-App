import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { Children, createContext, use, useEffect, useState } from "react";
import { db } from "../config/firebase";

export const AppContext = createContext();

const AppContextProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [chatData, setChatData] = useState([])
  const [messageId, setMessageId] = useState(null)
  const [messages, setMessages] = useState([])
  const [chatUser, setChatUser] = useState(null)

  const loadUserData = async (uid) => {
    try {
      const useref = doc(db, "users", uid)
      const userDoc = await getDoc(useref);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUser({
          ...userData,
          id: userDoc.id
        });
        console.log("User data loaded:", userData);
      } else {
        console.log("No such document!");
      }

    } catch (error) {
      console.error("Error loading user data:", error);
    }
  }
  useEffect(() => {
    if (user) {
      const chatRef = doc(db, "userChats", user.id);

      const fetchChatData = async (chatItem) => {
        const tempData = [];
        for (const item of chatItem) {
          const userRef = doc(db, "users", item.rId);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            tempData.push({
              ...item,
              user: {
                ...userDoc.data(),
                id: userDoc.id
              }
            });
          }
        }
        console.log("Fetched chat data:", tempData);
        setChatData(tempData.sort((a, b) => b.updatedAt - a.updatedAt)); 
      };

      const chatSnep = onSnapshot(chatRef, (snapshot) => {
        const chatItem = snapshot.data()?.chatData || [];
        fetchChatData(chatItem); // async inside, not outside
      });

      return () => {
        chatSnep();
      };
    }
  }, [user]);

  const value = {
    user,
    setUser,
    chatData,
    setChatData,
    loadUserData,
    messageId,
    setMessageId,
    messages,
    setMessages,
    chatUser,
    setChatUser

  }
  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export default AppContextProvider;