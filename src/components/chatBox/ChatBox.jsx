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
import toast from 'react-hot-toast'

const ChatBox = () => {
  const { user, messages, chatUser, setMessages, messageId, setChatUser } = useContext(AppContext)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [typing, setTyping] = useState(false)
  const [typingTimeout, setTypingTimeout] = useState({
    type: null,
    url: null,
    file: null
  })
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

  // Send message - Updated to handle both direct and group chats
  const sendMes = async () => {
    try {
      const msg = input.trim();
      const hasMedia = previewUrl && previewUrl.file;

      // Validate if there's something to send
      if ((!msg && !hasMedia) || !messageId) return;

      const timestamp = serverTimestamp();
      let fileUrl = null;
      let messageType = "text";
      let lastMessagePreview = "";

      // Handle file upload if present
      if (hasMedia) {
        try {
          // Upload file to Cloudinary
          const formData = new FormData();
          formData.append('file', previewUrl.file);
          formData.append('upload_preset', import.meta.env.VITE_cloudinary_cloud_prefix);

          const response = await fetch(
            `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_cloudinary_cloud_name}/upload`,
            {
              method: 'POST',
              body: formData
            }
          );

          const data = await response.json();

          if (data.secure_url) {
            fileUrl = data.secure_url;
            messageType = previewUrl.type;

            // Set appropriate preview text based on file type
            if (previewUrl.type === 'image') {
              lastMessagePreview = "📷 Image";
            } else if (previewUrl.type === 'video') {
              lastMessagePreview = "🎥 Video";
            } else if (previewUrl.type === 'audio') {
              lastMessagePreview = "🎵 Audio";
            } else {
              lastMessagePreview = "📎 File";
            }
          } else {
            toast.error("File upload failed");
            return;
          }
        } catch (error) {
          console.error("Error uploading file:", error);
          toast.error("Error uploading file");
          return;
        }
      } else {
        // If no media, use the text message for preview
        lastMessagePreview = msg;
      }

      // Create message object based on what we're sending
      const messageData = {
        sId: user.id,
        createdAt: timestamp,
        read: false,
        type: messageType
      };

      // Add sender info for group chats
      if (chatUser.isGroup) {
        messageData.senderName = user.username;
        messageData.senderProfilePic = user.profilePic;
      }

      // Only add text if there is text to send
      if (msg) {
        messageData.text = msg;
      }

      // Only add fileUrl if there's a file
      if (fileUrl) {
        messageData.fileUrl = fileUrl;
      }

      // Add message to chatMessages subcollection
      await addDoc(collection(db, "messages", messageId, "chatMessages"), messageData);

      // Reset states
      setInput("");
      setPreviewUrl(null);

      // Update last activity timestamp on parent document
      await updateDoc(doc(db, "messages", messageId), {
        lastActivity: timestamp,
        [`typing_${user.id}`]: false
      });

      // Update chat status for all users
      let userIds = [];
      if (chatUser.isGroup) {
        userIds = chatUser.members || [];

      } else {
        userIds = [chatUser.rId, user.id];
      }

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
              lastMessage: lastMessagePreview.slice(0, 30) + "... " + " ~" + user.username,
              updatedAt: Date.now(),
              messageSeen: id === user.id
            };

            await updateDoc(userChatRef, {
              chatData: chatDataClone
            });

          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Error sending message");
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
    const file = e.target.files[0];
    if (!file) return;

    // Close file menu
    setFileMenu(false);

    // Determine the actual file type based on MIME type
    const mimeType = file.type.split('/')[0];
    let fileType = mimeType;

    // Handle special case for application type
    if (mimeType === 'application') {
      fileType = 'file';
    }

    // Create preview URL for the file
    const previewData = {
      type: fileType,
      url: URL.createObjectURL(file),
      file: file,
      name: file.name
    };

    setPreviewUrl(previewData);
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
  if (!chatUser) {
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
          {chatUser.isGroup ? (
            // Group chat header
            <>
              <img src={chatUser.groupImage || assets.logo_icon} alt="" />
              <div className="user-status">
                <p>{chatUser.groupName}</p>
                <span className="status">
                  <span>{chatUser.members?.length || 0} members</span>
                </span>
              </div>
            </>
          ) : (
            // Direct message header
            <>
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
            </>
          )}
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
                {/* Show sender name for group messages */}
                {chatUser.isGroup && !isCurrentUser && !msg.system && (
                  <div className="message-sender-name">
                    <span>{msg.senderName || "Unknown User"}</span>
                  </div>
                )}

                {/* System message for group chats */}
                {msg.system && (
                  <div className="system-message">
                    <p>{msg.text}</p>
                  </div>
                )}

                {/* Image Message */}
                {!msg.system && msg.type === 'image' && msg.fileUrl && (
                  <div className="msg img-msg">
                    <img
                      src={msg.fileUrl}
                      alt="Image"
                      onClick={() => window.open(msg.fileUrl, '_blank')}
                    />
                  </div>
                )}

                {/* Video Message */}
                {!msg.system && msg.type === 'video' && msg.fileUrl && (
                  <div className="msg video-msg">
                    <video src={msg.fileUrl} controls></video>
                  </div>
                )}

                {/* Audio Message */}
                {!msg.system && msg.type === 'audio' && msg.fileUrl && (
                  <div className="msg audio-msg">
                    <audio src={msg.fileUrl} controls></audio>
                  </div>
                )}

                {/* File Message */}
                {!msg.system && msg.fileUrl && !['image', 'video', 'audio'].includes(msg.type) && (
                  <div className="msg file-msg">
                    <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
                      <FaFile /> Download File
                    </a>
                  </div>
                )}

                {/* Text Message */}
                {!msg.system && msg.text && <p className='msg'>{msg.text}</p>}

                {/* Message Footer - Only for non-system messages */}
                {!msg.system && (
                  <div>
                    <img
                      src={isCurrentUser
                        ? user.profilePic
                        : (chatUser.isGroup
                          ? (msg.senderProfilePic || assets.profile_img)
                          : chatUser.user.profilePic)}
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
                )}
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
                {previewUrl.type === 'image' && (
                  <img src={previewUrl.url} alt="Preview" className="preview-image" />
                )}

                {previewUrl.type === 'video' && (
                  <video src={previewUrl.url} controls className="video-preview">
                    Your browser does not support video playback.
                  </video>
                )}

                {previewUrl.type === 'audio' && (
                  <audio src={previewUrl.url} controls className="preview-audio">
                    Your browser does not support audio playback.
                  </audio>
                )}

                {previewUrl.type === 'file' && (
                  <div className="preview-file">
                    <FaFile style={{ marginRight: '8px', color: 'var(--primary)' }} />
                    {previewUrl.file.name}
                  </div>
                )}

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