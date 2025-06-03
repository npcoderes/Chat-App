import React from 'react'
import './login.css'
import assets from "../../assets/assets"
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import toast from 'react-hot-toast'
import { signUpUser,LogInUser } from '../../config/firebase'
import { useNavigate } from 'react-router-dom'
const Login = () => {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [file, setFile] = React.useState(null);
  const [togglePassword, setTogglePassword] = React.useState(false);
  const [signUp, setSignUp] = React.useState(false);
  const [profilePic, setProfilePic] = React.useState(assets.avatar_icon);
  const [loading, setLoading] = React.useState(false);
  const navigate = useNavigate()
  const handleChange = (e) => {
    toast.success("Image selected successfully");
    let file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error("Please select a valid image file");
        return;
      }
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast.error("Image size should be less than 2MB");
        return;
      }
    }

    setFile(e.target.files[0]);

    if (file) {
      setProfilePic(URL.createObjectURL(file));
    }

  }

  const handleImgCloudinary = async (file) => {
    console.log("file", file)
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'chat-app'); // Replace with your Cloudinary upload preset
    formData.append('cloud_name', 'da72q7tvb'); // Replace with your Cloudinary cloud name

    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${formData.get('cloud_name')}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      console.log("Image upload response:", data);
      return data.secure_url
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  }

  const handleSubmit = async (e) => {

    e.preventDefault();
    if (!email || !password || (!signUp && !username)) {
      toast.error("Please fill all the fields");
      return;
    }

    if (!signUp) {
      setLoading(true);
      let tid = toast.loading("Creating your account...");
      const profilePicUrl = await handleImgCloudinary(file);
      if (!profilePicUrl) {
        toast.error("Please select a valid image");
        return;
      }

      const res = await signUpUser(username, email, password, profilePicUrl);
      if (res) {
        toast.dismiss(tid);
        setLoading(false);
        toast.success("Account created successfully");
        setSignUp(true);
      } else {
        toast.dismiss(tid);
        setLoading(false);
      }


    } else {
      setLoading(true);
      let tid = toast.loading("Logging in...");
      const res = await LogInUser(email, password);
      if (!res) {
        toast.dismiss(tid);
        setLoading(false);
        return;
      }
      toast.dismiss(tid);
      navigate("/profile");
      toast.success("Logged in successfully");
    }
  }

  return (
    <div className='login'>
      <img src={assets.logo_big} alt="" className='logo' />
      <form className="login-form" onSubmit={(e) => handleSubmit(e)}>
        <h2>{
          signUp ? "Login" : "Sign Up"
        }</h2>

        {
          !signUp && <input type="text" placeholder='username' className='form-input ' onChange={(e) => setUsername(e.target.value)} autoComplete='UserName' />
        }
        <input type="email" placeholder='Email Address' className='form-input ' onChange={(e) => setEmail(e.target.value)} />
        <div className='password-input'>
          <input type={togglePassword ? "text" : "password"} placeholder='password' className='form-input ' onChange={(e) => setPassword(e.target.value)} autoComplete='current-password' />
          {
            togglePassword ? (
              <FaEyeSlash className='eye-icon' onClick={() => setTogglePassword(!togglePassword)} />
            ) : (
              <FaEye className='eye-icon' onClick={() => setTogglePassword(!togglePassword)} />
            )
          }
        </div>
        {
          !signUp && (<div className="profilePic">
            <label htmlFor="profilePic">
              <img src={profilePic} alt="Profile" />
              <div className="upload-icon">
                <span>+</span>
              </div>
              <input type="file" id='profilePic' accept='image/*' onChange={handleChange} />
            </label>
          </div>)
        }
        <button type="submit" >{
          signUp ? "Login" : "Create a Account"
        }</button>
        <div className="login-forgot">
          <p>
            {
              !signUp ? "Already have an account?" : "Don't have an account?"
            }  <span onClick={() => setSignUp(!signUp)}>Click Here</span>
          </p>
        </div>
      </form>
    </div>
  )
}

export default Login