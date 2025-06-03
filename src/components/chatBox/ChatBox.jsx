import React, { useContext, useEffect, useState } from 'react'
import './ChatBox.css'
import assets from '../../assets/assets'
import { AppContext } from '../../context/AppContext'
import { arrayUnion, doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'

const ChatBox = () => {
  const { user, messages, chatUser, setMessages, messageId, setChatUser } = useContext(AppContext)
  const [input, setInput] = useState("")
  const[loading, setLoading] = useState(false)



  useEffect(() => {
    
    if (messageId) {
      setLoading(true)
      const unSub = onSnapshot(doc(db, 'messages', messageId), (res) => {
        console.log(res.data())
        setMessages(res.data()?.messages.reverse() || [])
      })
      setLoading(false)
      return () => {

        unSub()
      }
    }

  }, [messageId])

  if (loading) {
    return (
      <div className='chat-box loading'>
        <div className="loading-spinner"></div>
        <p>Loading messages...</p>
      </div>
    )
  }
  

  const sendMes = async () => {
    try {
      if (input && messageId) {
        // Step 1: Add new message to messages collection
        await updateDoc(doc(db, "messages", messageId), {
          messages: arrayUnion({
            sId: user.id,
            text: input,
            createdAt: new Date()
          })
        });

        // Step 2: Update userChats for both sender and recipient
        const userIds = [chatUser.rId, user.id]; // Adjust if your structure uses rId

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
                lastMessage: input.slice(0, 30),
                updatedAt: Date.now(),
                ...(chatDataClone[chatIndex].rId === user.id ? { messageSeen: false } : {})
              };

              await updateDoc(userChatRef, {
                chatData: chatDataClone
              });
              setInput("")
            }
          }
        }
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

    if (inputElement) {
      inputElement.addEventListener('keydown', handleKeyPress);
      return () => {
        inputElement.removeEventListener('keydown', handleKeyPress);
      };
    }
  }, [input, messageId]);

  const handleBackClick = () => {
    setChatUser(null);
  };

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
  return (
    <div className='chat-box'>
      <div className="chat-user">
        <img src={assets.arrow_icon} alt="Back" className="back-btn" onClick={handleBackClick} />
        <img src={chatUser?.user?.profilePic} alt="" />
        <p>
          {chatUser?.user?.username}
          <img src={assets.green_dot} alt="" className='dot' />
        </p>
        <img src={assets.help_icon} alt="" className='call-icon' />
      </div>

      <div className="chat-messages">
        {/* sender msg  */}

        {
          messages.map((msg, index) => (
            <div className={`${(msg.sId == user.id) ? "s-msg" : "r-msg"}`} key={index}>
              <p className='msg'>
                {msg.text}
              </p>
              <div>
                <img src={(msg.sId == user.id) ? (user.profilePic) : (chatUser.user.profilePic)} alt="" />
                <p className='time'>{msg.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))
        }

      </div>

      <div className="chat-input">
        <input type="text" placeholder='Send A Message ' onChange={(e) => setInput(e.target.value)} value={input} id='input' />
        <img src={assets.send_button} alt="" onClick={sendMes} />
      </div>
    </div>
  )
}

export default ChatBox