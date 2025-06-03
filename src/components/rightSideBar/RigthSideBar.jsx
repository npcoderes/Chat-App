import React, { useContext } from 'react'
import './RigthSideBar.css'
import assets from '../../assets/assets'
import { AppContext } from '../../context/AppContext'
const RigthSideBar = () => {
  const {user}= useContext(AppContext)
  return (
    <div className='rs'>
      <div className="rs-profile">
        <img src={user?.profilePic} alt="" />
        <p>
          {
            user?.username
          }</p>
      </div>
    </div>
  )
}

export default RigthSideBar