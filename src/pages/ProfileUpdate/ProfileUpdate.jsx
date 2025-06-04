import React, { useState, useRef } from 'react'
import './profileupdate.css'
import asssets from "../../assets/assets"
import { AppContext } from '../../context/AppContext'
import { useContext } from 'react'
import { Link } from 'react-router-dom'
import { IoMdArrowBack, IoMdCamera } from 'react-icons/io'
import toast from 'react-hot-toast'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'

// Cloudinary preset name - you'll need to create this in your Cloudinary dashboard
const CLOUDINARY_UPLOAD_PRESET = 'chat-app';
const CLOUDINARY_CLOUD_NAME = 'da72q7tvb'; // Replace with your cloud name

const ProfileUpdate = () => {
  const context = useContext(AppContext)
  const [name, setName] = useState("")
  const [bio, setBio] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const fileInputRef = useRef(null)
  const { user } = context

  if (!user) {
    return (
      <div role="status" className="flex items-center justify-center h-screen">
        <svg aria-hidden="true" className="w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" />
          <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill" />
        </svg>
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Preview the image
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload to Cloudinary
    uploadToCloudinary(file);
  };

  // Upload image to Cloudinary
  const uploadToCloudinary = async (file) => {
    setIsUploading(true);

    // Create form data for upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await response.json();

      if (data.secure_url) {
        // Update preview with the actual Cloudinary URL
        setPreviewUrl(data.secure_url);
        toast.success('Image uploaded successfully');
      } else {
        toast.error('Failed to upload image');
        console.error('Upload failed:', data);
      }
    } catch (error) {
      toast.error('Error uploading image');
      console.error('Error uploading to Cloudinary:', error);
    } finally {
      setIsUploading(false);
    }
  };

  // Trigger file input click
  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name && !bio && !previewUrl) {
      toast.error("Please make some changes to update");
      return;
    }

    // Create an object with only the fields that changed
    const updateData = {};
    if (name) updateData.username = name;
    if (bio) updateData.bio = bio;
    if (previewUrl) updateData.profilePic = previewUrl;


    try {
      const userRef = doc(db, "users", user.id);
      await updateDoc(userRef, updateData);
      toast.success("Profile updated successfully");

      // Update local context (optional - depends on your app structure)
      context.setUser({...user, ...updateData});
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    }
  };

  return (
    <div className='profile'>
      <div className='profileContainer'>
        <form action="" onSubmit={(e) => handleSubmit(e)}>
          <h3>Profile Details</h3>

          <div className="profile-image-container">
            <img
              src={previewUrl || (user ? user.profilePic : null)}
              alt=""
              className='profile-pic'
            />
            <div className="upload-overlay" onClick={triggerFileInput}>
              {isUploading ? (
                <div className="upload-spinner"></div>
              ) : (
                <IoMdCamera className="camera-icon" />
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              style={{ display: 'none' }}
            />
          </div>

          <input
            type="text"
            placeholder='Your Name'
            defaultValue={user ? user.username : ""}
            onChange={(e) => setName(e.target.value)}
          />

          <textarea
            name=""
            id=""
            placeholder='Write about You bio'
            defaultValue={user.bio || ""}
            onChange={(e) => setBio(e.target.value)}
          />

          <button
            type='submit'
            disabled={isUploading}
            className={isUploading ? 'disabled' : ''}
          >
            {isUploading ? 'Uploading...' : 'Save'}
          </button>
        </form>

        <div className='profile-back'>
          <img src={user ? user.profilePic : null} alt="" className='profile-pic' />
          <Link to="/chat" className='profile-link'>
            <p><IoMdArrowBack /> Back to Chat</p>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default ProfileUpdate