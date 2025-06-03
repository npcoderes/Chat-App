import React, { useState, useContext } from 'react'
import './chat.css'
import LeftSidebar from '../../components/leftSideBar/LeftSidebar'
import ChatBox from '../../components/chatBox/ChatBox'
import RigthSideBar from '../../components/rightSideBar/RigthSideBar'
import { AppContext } from '../../context/AppContext'
import assets from '../../assets/assets'
import { IoChatbox } from 'react-icons/io5'
import { FaUsers } from 'react-icons/fa'
import { CgProfile } from 'react-icons/cg'

const Chat = () => {
  const [activeMobileTab, setActiveMobileTab] = useState('chats');
  const { chatUser } = useContext(AppContext);

  // Automatically switch to chat view when a user is selected on mobile
  React.useEffect(() => {
    if (chatUser && window.innerWidth <= 768) {
      setActiveMobileTab('messages');
    }
  }, [chatUser, window.innerWidth]);

  return (
    <div className='chat'>
      <div className='mobile-header'>
        <div className='mobile-nav'>
          <div
            className={`nav-item ${activeMobileTab === 'chats' ? 'active' : ''}`}
            onClick={() => setActiveMobileTab('chats')}
          >
            <FaUsers/>
            <span>Chats</span>
          </div>

          <div
            className={`nav-item ${activeMobileTab === 'messages' ? 'active' : ''}`}
            onClick={() => setActiveMobileTab('messages')}
          >
            <IoChatbox />
            <span>Messages</span>
          </div>

          <div
            className={`nav-item ${activeMobileTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveMobileTab('profile')}
          >
           <CgProfile />
            <span>Profile</span>
          </div>
        </div>
      </div>

      <div className='chat-container'>

        <div className={`sidebar-container ${(activeMobileTab === 'chats' || window.innerWidth > 768) ? '' : 'mobile-hidden'}`}>
          <LeftSidebar />
        </div>

        <div className={`chatbox-container ${(activeMobileTab === 'messages' || window.innerWidth > 768) ? '' : 'mobile-hidden'}`}>
          <ChatBox />
        </div>

        <div className={`profile-container ${(activeMobileTab === 'profile' || window.innerWidth > 768) ? '' : 'mobile-hidden'}`}>
          <RigthSideBar />
        </div>
      </div>
    </div>
  )
}

export default Chat