import React, { useState, useContext } from 'react';
import "./LeftSidebar.css";
import assets from '../../assets/assets';
import { db, LogOutUser } from '../../config/firebase';
import { Link } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { IoMdMenu } from 'react-icons/io';
import { formatDistanceToNow } from 'date-fns';

const LeftSidebar = () => {
  const [searchUser, setSearchUser] = useState(null);
  const [search, setSearch] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [noUserFound, setNoUserFound] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { user, chatData, setChatUser, setMessageId, unreadMessages } = useContext(AppContext);

  // Handle search functionality
  const handleSearch = async (e) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (value.trim() === "") {
      setSearchUser(null);
      setSearch(false);
      setNoUserFound(false);
      return;
    }

    setSearch(true);
    setSearchLoading(true);

    try {
      const userRef = collection(db, "users");
      const q = query(userRef, where("username", "==", value.trim().toLowerCase()));
      const result = await getDocs(q);

      if (result.empty) {
        setSearchUser(null);
        setNoUserFound(true);
      } else {
        const foundUser = result.docs[0].data();
        foundUser.id = result.docs[0].id;

        const alreadyInChat = chatData.some(item => item.rId === foundUser.id);
        setSearchUser(alreadyInChat ? null : foundUser);
        setNoUserFound(alreadyInChat);
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchUser(null);
      setNoUserFound(true);
    } finally {
      setSearchLoading(false);
    }
  };

  // Add a new chat
  const addChat = async (ruser) => {
    const tid = toast.loading("Adding chat...");

    try {
      // Check if chat exists
      const existingChatDoc = await getDoc(doc(db, "userChats", user.id));
      const existingChats = existingChatDoc.exists() ? existingChatDoc.data().chatData || [] : [];

      if (existingChats.some(chat => chat.rId === ruser.id)) {
        toast.dismiss(tid);
        return;
      }

      // Create message document
      const messageRef = collection(db, "messages");
      const newMessage = doc(messageRef);
      await setDoc(newMessage, {
        createdAt: serverTimestamp(),
      });

      // Add chat for recipient
      const recipientDoc = await getDoc(doc(db, "userChats", ruser.id));
      const recipientChats = recipientDoc.exists() ? recipientDoc.data().chatData || [] : [];
      await setDoc(doc(db, "userChats", ruser.id), {
        chatData: [
          ...recipientChats,
          {
            messageId: newMessage.id,
            rId: user.id,
            lastMessage: "",
            updatedAt: Date.now(),
            messageSeen: true,
          }
        ]
      });

      // Add chat for current user
      await setDoc(doc(db, "userChats", user.id), {
        chatData: [
          ...existingChats,
          {
            messageId: newMessage.id,
            rId: ruser.id,
            lastMessage: "",
            updatedAt: Date.now(),
            messageSeen: true,
          }
        ]
      });

      setSearch(false);
      setSearchUser(null);
      toast.dismiss(tid);
      toast.success("Chat added successfully");
    } catch (error) {
      toast.dismiss(tid);
      toast.error("Error adding chat");
      console.error("Error adding chat:", error);
    }
  }

  // Select a chat
  const setChat = async (item) => {
    setChatUser(item);
    setMessageId(item.messageId);

    // Mark as read if needed
    if (unreadMessages[item.messageId]) {
      try {
        const userChatRef = doc(db, "userChats", user.id);
        const userSnap = await getDoc(userChatRef);

        if (userSnap.exists()) {
          const userChatData = userSnap.data();
          const chatDataClone = [...userChatData.chatData];

          const chatIndex = chatDataClone.findIndex(c => c.messageId === item.messageId);
          if (chatIndex !== -1) {
            chatDataClone[chatIndex].messageSeen = true;

            await updateDoc(userChatRef, {
              chatData: chatDataClone
            });
          }
        }
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    }
  };

  const formatLastSeen = (date) => {
    if (!date) return "Offline";
    return formatDistanceToNow(date, { addSuffix: true });
  };

  return (
    <div className='ls'>
      {/* Header */}
      <div className='ls-top'>
        <div className="ls-nav">
          <img src={assets.logo} alt="" className='logo' />
          <div className="menu">
            <IoMdMenu size={30} className='menu-icon' />
            <div className='sub-menu'>
              <Link to="/profile"><p>Edit Profile</p></Link>
              <hr />
              <p onClick={() => LogOutUser()}>Log Out</p>
            </div>
          </div>
        </div>
        <div className="ls-search">
          <input
            type="text"
            placeholder='Search by username'
            onChange={handleSearch}
            value={searchQuery}
          />
          <img
            src={searchLoading ? assets.loading_icon : assets.search_icon}
            alt={searchLoading ? "Loading" : "Search"}
            className={searchLoading ? "loading-icon" : ""}
          />
        </div>
      </div>

      {/* Chat list */}
      <div className="ls-list">
        {/* Search results */}
        {search && (
          <>
            {searchLoading ? (
              <div className="search-status"><p>Searching...</p></div>
            ) : noUserFound ? (
              <div className="search-status no-results">
                <p>No user found with username "{searchQuery}"</p>
              </div>
            ) : searchUser ? (
              <div className="frinds search-result" onClick={() => addChat(searchUser)}>
                <img src={searchUser.profilePic || assets.profile_img} alt="" className="object-cover aspect-square w-12 rounded-full" />
                <div className='text-sm'>
                  <p>{searchUser.username}</p>
                  <span className='text-xs'>{searchUser.bio || "No bio available"}</span>
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* Existing chats */}
        {!search && (
          <>
            {chatData.length > 0 ? (
              chatData.map((item, index) => (
                <div className="frinds" key={index} onClick={() => setChat(item)}>
                  <div className="friend-avatar">
                    <img src={item.user.profilePic || assets.profile_img} alt="" className="object-cover" />
                    {item.user.isOnline === true && <span className="online-indicator"></span>}
                  </div>
                  <div className="friend-info">
                    <div className="friend-header">
                      <p>{item.user.username}</p>
                      <span className="last-time">
                        {new Date(item.updatedAt).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </span>
                    </div>
                    <div className="friend-message">
                      <span className="message-preview">{item.lastMessage || "No messages yet"}</span>
                      {unreadMessages[item.messageId] && <span className="unread-badge">New</span>}
                    </div>
                    <span className="status-text">
                      {item.user.isOnline === true
                        ? "Online"
                        : item.user.lastSeen ? formatLastSeen(item.user.lastSeen) : "Offline"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-chat text-center">
                <h2>No Chats Available</h2>
                <p>Search for users to start chatting</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LeftSidebar;