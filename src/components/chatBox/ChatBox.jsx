import React, { useContext, useEffect, useState, useRef } from 'react'
import './ChatBox.css'
import assets from '../../assets/assets'
import { AppContext } from '../../context/AppContext'
import { collection, addDoc, doc, getDoc, onSnapshot, updateDoc, serverTimestamp, query, orderBy } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { formatDistanceToNow } from 'date-fns'
import { ImAttachment } from 'react-icons/im'
import { FaFile, FaImage } from 'react-icons/fa'
import { FaTimes } from 'react-icons/fa'

const ChatBox = () => {
  const { user, messages, chatUser, setMessages, messageId, setChatUser } = useContext(AppContext)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [typing, setTyping] = useState(false)
  const [typingTimeout, setTypingTimeout] = useState(null)
  const messagesEndRef = useRef(null)
  const [filemenu, setFileMenu] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // Load messages when messageId changes - UPDATED to use subcollection
  useEffect(() => {
    if (messageId) {
      setLoading(true)

      // Query messages from subcollection ordered by timestamp
      const chatMessagesRef = collection(db, 'messages', messageId, 'chatMessages');
      const q = query(chatMessagesRef, orderBy('createdAt', 'asc'));

      const unSub = onSnapshot(q, (snapshot) => {
        const messagesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setMessages(messagesData);
        setLoading(false);
      });

      // Get typing indicators from the main document
      const typingUnSub = onSnapshot(doc(db, 'messages', messageId), (doc) => {
        if (doc.exists() && chatUser?.rId) {
          const typingStatus = doc.data()[`typing_${chatUser.rId}`];
          setChatUser(prev => ({
            ...prev,
            typing: typingStatus
          }));
        }
      });

      return () => {
        unSub();
        typingUnSub();
      };
    }
  }, [messageId, setMessages, chatUser?.rId, setChatUser])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages])

  // Listen to user status changes
  useEffect(() => {
    if (chatUser?.user?.id) {
      const userStatusRef = doc(db, "userStatus", chatUser.user.id)
      const unsubStatus = onSnapshot(userStatusRef, (doc) => {
        if (doc.exists()) {
          setChatUser(prev => ({
            ...prev,
            user: {
              ...prev.user,
              isOnline: doc.data().online,
              lastSeen: doc.data().lastSeen?.toDate()
            }
          }))
        }
      })

      return () => unsubStatus()
    }
  }, [chatUser?.user?.id, setChatUser])

  // Handle typing indicator
  const handleTyping = (e) => {
    setInput(e.target.value)

    if (!typing) {
      setTyping(true)
      updateUserTypingStatus(true)
    }

    if (typingTimeout) clearTimeout(typingTimeout)

    const timeout = setTimeout(() => {
      setTyping(false)
      updateUserTypingStatus(false)
    }, 2000)

    setTypingTimeout(timeout)
  }

  const updateUserTypingStatus = async (isTyping) => {
    if (!messageId) return

    try {
      await updateDoc(doc(db, "messages", messageId), {
        [`typing_${user.id}`]: isTyping
      })
    } catch (error) {
      console.error("Error updating typing status:", error)
    }
  }

  // Send message - UPDATED to use addDoc with subcollection
  const sendMes = async () => {
    try {
      let msg = input.trim();
      if (msg && messageId) {
        const timestamp = serverTimestamp();

        // Add message to chatMessages subcollection
        await addDoc(collection(db, "messages", messageId, "chatMessages"), {
          sId: user.id,
          text: msg,
          createdAt: timestamp,
          read: false
        });
        setInput("");

        // Update last activity timestamp on parent document
        await updateDoc(doc(db, "messages", messageId), {
          lastActivity: timestamp,
          [`typing_${user.id}`]: false
        });

        // Update chat status for both users
        const userIds = [chatUser.rId, user.id];
        for (const id of userIds) {
          const userChatRef = doc(db, "userChats", id);
          const userSnap = await getDoc(userChatRef);

          if (userSnap.exists()) {
            const userChatData = userSnap.data();
            const chatDataClone = [...userChatData.chatData];

            const chatIndex = chatDataClone.findIndex(c => c.messageId === messageId);
            if (chatIndex !== -1) {
              chatDataClone[chatIndex] = {
                ...chatDataClone[chatIndex],
                lastMessage: msg.slice(0, 30),
                updatedAt: Date.now(),
                messageSeen: id === user.id
              };

              await updateDoc(userChatRef, {
                chatData: chatDataClone
              });
            }
          }
        }

        setInput("")
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  useEffect(() => {
    const inputElement = document.getElementById('input');
    const handleKeyPress = (e) => {
      if (e.key === 'Enter') {
        sendMes();
      }
    };

    inputElement?.addEventListener('keydown', handleKeyPress);
    return () => inputElement?.removeEventListener('keydown', handleKeyPress);
  }, [input, messageId]);

  const handleBackClick = () => setChatUser(null);

  const formatLastSeen = (date) => {
    if (!date) return "Offline";
    return formatDistanceToNow(date, { addSuffix: true });
  };

  //  if chat is open and messages are loaded, mark unread messages as read
  useEffect(() => {
    const markMessagesAsRead = async () => {
      if (messageId && messages.length > 0 && user) {
        const unreadMessages = messages.filter(msg => !msg.read && msg.sId !== user.id);

        // Update each unread message document
        for (const msg of unreadMessages) {
          try {
            if (msg.id) {
              const msgRef = doc(db, "messages", messageId, "chatMessages", msg.id);
              await updateDoc(msgRef, { read: true });
            }
          } catch (error) {
            console.error("Error marking message as read:", error);
          }
        }
      }
    };

    markMessagesAsRead();
  }, [messages, messageId, user]);

  // for  sending  media as msg 

  const handleFileSelect = async (e, type) => {
    const file = e.target.files[0]
    filemenu && setFileMenu(false)
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));


    console.log(file)
  }

  // Loading state
  if (loading) {
    return (
      <div className='chat-box loading'>
        <div className="loading-spinner"></div>
        <p>Loading messages...</p>
      </div>
    )
  }

  // Empty state - no chat selected
  if (!chatUser || !chatUser.user) {
    return (
      <div className='chat-box empty-chat'>
        <div className="welcome-container">
          <img src={assets.logo_big || assets.avatar_icon} alt="Logo" className="welcome-logo" />
          <h2>Welcome to Chat App</h2>
          <p>Select a conversation to start chatting</p>
        </div>
      </div>
    )
  }

  // Render chat interface
  return (
    <div className='chat-box'>
      {/* Chat header */}
      <div className="chat-user">
        <img src={assets.arrow_icon} alt="Back" className="back-btn" onClick={handleBackClick} />
        <div className="user-info">
          <img src={chatUser?.user?.profilePic} alt="" />
          <div className="user-status">
            <p>{chatUser?.user?.username}</p>
            <span className="status">
              {chatUser?.user?.isOnline ? (
                <>
                  <span className="status-dot online"></span>
                  <span>Online</span>
                </>
              ) : (
                <>
                  <span className="status-dot offline"></span>
                  <span>{chatUser?.user?.lastSeen ? formatLastSeen(chatUser.user.lastSeen) : "Offline"}</span>
                </>
              )}
            </span>
          </div>
        </div>
        <img src={assets.help_icon} alt="" className='call-icon' />
      </div>

      {/* Messages area */}
      <div className="chat-messages">
        {(() => {
          let currentDate = null;
          const messageElements = [];

          messages.forEach((msg, index) => {
            const isCurrentUser = msg.sId === user.id;

            // Check if this is a new date
            const messageDate = msg.createdAt?.toDate ?
              new Date(msg.createdAt.toDate()).toDateString() :
              new Date().toDateString();

            if (currentDate !== messageDate) {
              currentDate = messageDate;
              messageElements.push(
                <div className="date-header" key={`date-${messageDate}`}>
                  <span>{msg.createdAt?.toDate ?
                    new Date(msg.createdAt.toDate()).toLocaleDateString() :
                    new Date().toLocaleDateString()}
                  </span>
                </div>
              );
            }

            messageElements.push(
              <div className={isCurrentUser ? "s-msg" : "r-msg"} key={`msg-${msg.id || index}`}>
                <p className='msg'>{msg.text}</p>
                <div>
                  <img
                    src={isCurrentUser ? user.profilePic : chatUser.user.profilePic}
                    alt=""
                  />
                  <p className='time'>
                    {msg.createdAt?.toDate ?
                      msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }
                    {isCurrentUser && (
                      <span className={`read-status ${msg.read ? 'read' : 'unread'}`}>
                        {msg.read ? '✓✓' : '✓'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            );
          });

          return messageElements;
        })()}

        {/* Typing indicator */}
        {chatUser?.typing && (
          <div className="typing-indicator r-msg">
            <div className="dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />


      </div>


      {/* Input area */}
      <div className="chat-input">
        {
          previewUrl && (
            <div className="preview-container">
              <div className="preview-content">
                <img src={previewUrl} alt="Preview" className="preview-image" />
                <button className="remove-preview" onClick={() => setPreviewUrl(null)}>
                  <FaTimes /> Remove
                </button>
              </div>
            </div>
          )
        }

        <div className='relative'>
          <ImAttachment
            className='attachment-icon cursor-pointer'
            onClick={() => setFileMenu(!filemenu)}
          />
          {filemenu && (
            <div className="attachment-menu">
              <label className="attachment-option">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e, 'image')}
                  style={{ display: 'none' }}
                />
                <FaImage className="attachment-icon-inner" />
                <span>Image</span>
              </label>
              <label className="attachment-option">
                <input
                  type="file"
                  accept="application/*,audio/*,video/*"
                  onChange={(e) => handleFileSelect(e, 'file')}
                  style={{ display: 'none' }}
                />
                <FaFile className="attachment-icon-inner" />
                <span>File</span>
              </label>
            </div>
          )}
        </div>
        <input
          type="text"
          placeholder='Send a message'
          onChange={handleTyping}
          value={input}
          id='input'
        />
        <img
          src={assets.send_button}
          alt=""
          onClick={sendMes}
          className={input.trim() ? 'active' : ''}
        />
      </div>
    </div>
  )
}

export default ChatBox