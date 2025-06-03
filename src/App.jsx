
import { Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'
import Login from './pages/Login/Login'
import Chat from './pages/chat/Chat'
import ProfileUpdate from './pages/ProfileUpdate/ProfileUpdate'
import { useContext, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './config/firebase'
import { AppContext } from './context/AppContext'

function App() {
  const navigate=useNavigate()
  const context=useContext(AppContext)
  useEffect(()=>{
    onAuthStateChanged(auth,(user)=>{
      if(user){
        context.loadUserData(user.uid)
      }else{
        navigate('/')
      }
    })
  },[])
 
  return (
    <>
    <Routes>
      <Route path='/' element={<Login />} />
      <Route path='/chat' element={<Chat />} />
      <Route path='/profile' element={<ProfileUpdate />} />
     </Routes>
    </>
  )
}

export default App
