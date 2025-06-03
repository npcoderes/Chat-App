import React, { useState, useContext } from 'react'
import "./LeftSidebar.css"
import assets from '../../assets/assets'
import { db, LogOutUser } from '../../config/firebase'
import { Link } from 'react-router-dom'
import { AppContext } from '../../context/AppContext'
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { IoMdMenu } from 'react-icons/io'

const LeftSidebar = () => {
  const [searchUser, setSearchUser] = useState(null);
  const [search, setSearch] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [noUserFound, setNoUserFound] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { user, chatData, setChatUser, setMessageId } = useContext(AppContext);

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
    setNoUserFound(false);

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
        if (alreadyInChat) {
          setSearchUser(null);
          setNoUserFound(true);
        } else {
          setSearchUser(foundUser);
          setNoUserFound(false);
        }
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchUser(null);
      setNoUserFound(true);
    } finally {
      setSearchLoading(false);
    }
  };


  const addChat = async (ruser) => {
    const messageRef = collection(db, "messages");
    const chatRef = collection(db, "userChats");
    let tid= toast.loading("Adding chat...");

    try {
      // for previous chat
      const existingChatDoc = await getDoc(doc(chatRef, user.id));
      console.log("Existing chat document:", existingChatDoc);
      const existingChats = existingChatDoc.exists() ? existingChatDoc.data().chatData || [] : [];

      // Check if chat with this user already exists
      const chatExists = existingChats.some(chat => chat.rId === ruser.id);
      if (chatExists) {
        console.log("Chat already exists with this user");
        return;
      }

      // Create new message document
      const newMessage = doc(messageRef);
      await setDoc(newMessage, {
        createdAt: serverTimestamp(),
        messages: []
      });

      // Add chat for recipient user
      const recipientDoc = await getDoc(doc(chatRef, ruser.id));
      const recipientChats = recipientDoc.exists() ? recipientDoc.data().chatData || [] : [];
      await setDoc(doc(chatRef, ruser.id), {
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


      await setDoc(doc(chatRef, user.id), {
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
      console.log("Chat added successfully");
    } catch (error) {
      toast.dismiss(tid);
      toast.error("Error adding chat");
      console.error("Error adding chat:", error);
    }
  }

  const setChat = async (item) => {
    setChatUser(item);
    setMessageId(item.messageId);
  }

  return (
    <div className='ls'>
      <div className='ls-top'>
        <div className="ls-nav">
          <img src={assets.logo} alt="" className='logo' />
          <div className="menu">
            <IoMdMenu size={30} className='menu-icon' />
            <div className='sub-menu'>
              <Link to="/profile">
                <p>Edit Profile</p>
              </Link>
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
      <div className="ls-list">
        {/* Search results area */}
        {search && (
          <>
            {searchLoading ? (
              <div className="search-status">
                <p>Searching...</p>
              </div>
            ) : noUserFound ? (
              <div className="search-status no-results">
                <p>No user found with username "{searchQuery}"</p>
              </div>
            ) : searchUser ? (
              <div className="frinds search-result" onClick={() => addChat(searchUser)}>
                <img src={searchUser.profilePic || assets.profile_img} alt="" className="object-cover" />
                <div>
                  <p>{searchUser.username}</p>
                  <span>{searchUser.bio || "No bio available"}</span>
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* Existing chats area */}
        {!search && (
          <>
            {chatData.length > 0 ? (
              chatData.map((item, index) => (
                <div className="frinds" key={index} onClick={() => setChat(item)}>
                  <img src={item.user.profilePic || assets.profile_img} alt="" className="object-cover" />
                  <div>
                    <p>{item.user.username}</p>
                    <span>{item.lastMessage || "No messages yet"}</span>
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
  )
}

export default LeftSidebar