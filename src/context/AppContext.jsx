import { createContext, useEffect, useState } from "react";
import { db } from "../config/firebase";
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";

export const AppContext = createContext();

const AppContextProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [chatData, setChatData] = useState([]);
  const [messageId, setMessageId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatUser, setChatUser] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState({});

  // Set user online status
  useEffect(() => {
    if (user?.id) {
      // Set user as online when logged in
      const userStatusRef = doc(db, "userStatus", user.id);
      setDoc(userStatusRef, {
        online: true,
        lastSeen: new Date(),
      }, { merge: true });

      // Set user as offline when they leave/close the app
      const handleUnload = () => {
        updateDoc(userStatusRef, {
          online: false,
          lastSeen: new Date(),
        });
      };

      window.addEventListener('beforeunload', handleUnload);

      const pingInterval = setInterval(() => {
        updateDoc(userStatusRef, {
          lastSeen: new Date(),
        });
      }, 30000);

      return () => {
        window.removeEventListener('beforeunload', handleUnload);
        clearInterval(pingInterval);
        updateDoc(userStatusRef, {
          online: false,
          lastSeen: new Date(),
        });
      };
    }
  }, [user?.id]);


  const loadUserData = async (uid) => {
    try {
      const userRef = doc(db, "users", uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUser({
          ...userData,
          id: uid
        });
      } else {
        console.error("No user found with this ID");
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  // Track chat data and unread messages
  useEffect(() => {
    if (user) {
      const chatRef = doc(db, "userChats", user.id);

      const chatSnep = onSnapshot(chatRef, async (snapshot) => {
        if (snapshot.exists()) {
          const chats = snapshot.data().chatData || [];
          const tempData = [];
          const newUnreadMessages = {};

          // Get all unread message counts
          chats.forEach(chatItem => {
            if (!chatItem.messageSeen && chatItem.lastMessage) {
              newUnreadMessages[chatItem.messageId] = true;
            }
          });

          // Process each chat and set up status listeners for each contact
          for (const chatItem of chats) {
            try {
              // Get user data
              const userDoc = await getDoc(doc(db, "users", chatItem.rId));
              if (userDoc.exists()) {
                const userData = userDoc.data();

                // Get user's online status
                const statusDoc = await getDoc(doc(db, "userStatus", chatItem.rId));
                const isOnline = statusDoc.exists() ? statusDoc.data().online : false;
                const lastSeen = statusDoc.exists() ? statusDoc.data().lastSeen?.toDate() : null;

                tempData.push({
                  ...chatItem,
                  user: {
                    ...userData,
                    id: chatItem.rId,
                    isOnline,
                    lastSeen
                  }
                });
              }
            } catch (error) {
              console.error("Error fetching user data:", error);
            }
          }

          // Set up real-time listeners for all contacts' status
          const sortedData = tempData.sort((a, b) => b.updatedAt - a.updatedAt);
          setChatData(sortedData);
          setUnreadMessages(newUnreadMessages);
        }
      });

      return () => {
        chatSnep();
      };
    }
  }, [user]);

  // Add a dedicated effect to track online status of all chat contacts
  useEffect(() => {
    if (user && chatData.length > 0) {
      const statusListeners = chatData.map(chat => {
        const userStatusRef = doc(db, "userStatus", chat.rId);

        return onSnapshot(userStatusRef, (doc) => {
          setChatData(prevChatData => {
            return prevChatData.map(item => {
              if (item.rId === chat.rId) {
                return {
                  ...item,
                  user: {
                    ...item.user,
                    isOnline: doc.exists() ? doc.data().online : false,
                    lastSeen: doc.exists() ? doc.data().lastSeen?.toDate() : null
                  }
                };
              }
              return item;
            });
          });
        });
      });

      return () => {
        statusListeners.forEach(unsubscribe => unsubscribe());
      };
    }
  }, [user, chatData.length]);

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
    setChatUser,
    unreadMessages,
    setUnreadMessages
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export default AppContextProvider;