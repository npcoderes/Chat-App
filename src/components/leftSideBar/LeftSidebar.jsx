import React, { useState, useContext, useEffect } from 'react';
import "./LeftSidebar.css";
import assets from '../../assets/assets';
import { db, LogOutUser } from '../../config/firebase';
import { Link } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, arrayUnion, addDoc, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { IoMdMenu } from 'react-icons/io';
import { formatDistanceToNow } from 'date-fns';
import { Button, Modal, Input, Form, Upload, Avatar, Select, Spin } from 'antd';
import { PlusOutlined, UserOutlined } from '@ant-design/icons';

const LeftSidebar = () => {
  const [form] = Form.useForm();
  const [searchUser, setSearchUser] = useState(null);
  const [search, setSearch] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [noUserFound, setNoUserFound] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { user, chatData, setChatUser, setMessageId, unreadMessages, setChatData } = useContext(AppContext);
  const [groupModalOpen, setGroupModalOpen] = useState(false);

  // group chat data 
  const [chatDataGroup, setChatDataGroup] = useState([]);

  // Group creation states
  const [groupImage, setGroupImage] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);

  // Handle group modal close
  const handleModalClose = () => {
    form.resetFields();
    setSelectedMembers([]);
    setGroupImage(null);
    setImageUrl(null);
    setGroupModalOpen(false);
  };

  // Handle image upload
  const handleImageChange = (info) => {
  


    setGroupImage(info.file);
    setImageUrl(URL.createObjectURL(info.file));



  };

  // Search for users to add to group
  const searchUsers = async (value) => {
    if (!value.trim()) {
      setUserSearchResults([]);
      return;
    }

    setSearchingUsers(true);
    try {
      const usersRef = collection(db, "users");
      const userQuery = query(usersRef,
        where("username", ">=", value.toLowerCase()),
        where("username", "<=", value.toLowerCase() + '\uf8ff')
      );

      const querySnapshot = await getDocs(userQuery);

      const results = [];
      querySnapshot.forEach((doc) => {
        // Don't include current user or already selected users
        if (doc.id !== user.id) {
          results.push({
            value: doc.id,
            label: doc.data().username,
            data: {
              id: doc.id,
              ...doc.data()
            }
          });
        }
      });

      setUserSearchResults(results);
    } catch (error) {
      console.error("Error searching users:", error);
      toast.error("Error searching users");
    } finally {
      setSearchingUsers(false);
    }
  };

  // Create a new group
  const createGroup = async (values) => {
    const { groupName, groupDescription } = values;

    if (!groupName?.trim() || selectedMembers.length === 0) {
      toast.error("Group name and at least one member are required");
      return;
    }

    const loadingToast = toast.loading("Creating group...");

    try {
      // First, upload the image to Cloudinary if provided
      let groupImageUrl = null;
      if (groupImage) {
        const formData = new FormData();
        formData.append('file', groupImage);
        formData.append('upload_preset', import.meta.env.VITE_cloudinary_cloud_prefix);

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_cloudinary_cloud_name}/upload`,
          {
            method: 'POST',
            body: formData
          }
        );

        const imageData = await response.json();
        if (imageData.secure_url) {
          groupImageUrl = imageData.secure_url;
        }
      }

      // Create message document for the group
      const messageRef = doc(collection(db, "messages"));
      const messageId = messageRef.id;

      // Set basic group info
      await setDoc(messageRef, {
        createdAt: serverTimestamp(),
        lastActivity: serverTimestamp(),
        isGroup: true,
        groupName,
        groupDescription: groupDescription || "",
        groupImage: groupImageUrl,
        createdBy: user.id,
        members: [user.id, ...selectedMembers],
        admins: [user.id]
      });

      // Add initial system message
      await addDoc(collection(db, "messages", messageId, "chatMessages"), {
        system: true,
        text: `${user.username} created the group "${groupName}"`,
        createdAt: serverTimestamp()
      });

      // Add group to creator's chat list
      await updateUserChatList(user.id, {
        messageId,
        isGroup: true,
        groupName,
        groupImage: groupImageUrl,
        members: [user.id, ...selectedMembers],
        lastMessage: "Group created",
        updatedAt: Date.now(),
        messageSeen: true
      });

      // Add group to each member's chat list
      for (const memberId of selectedMembers) {
        await updateUserChatList(memberId, {
          messageId,
          isGroup: true,
          groupName,
          groupImage: groupImageUrl,
          members: [user.id, ...selectedMembers],
          lastMessage: `${user.username} added you to the group`,
          updatedAt: Date.now(),
          messageSeen: false
        });
      }

      toast.dismiss(loadingToast);
      toast.success("Group created successfully");
      handleModalClose();

    } catch (error) {
      console.error("Error creating group:", error);
      toast.dismiss(loadingToast);
      toast.error("Failed to create group");
    }
  };

  // Helper function to update a user's chat list
  const updateUserChatList = async (userId, groupChatData) => {
    const userChatRef = doc(db, "userChats", userId);
    const userChatDoc = await getDoc(userChatRef);

    if (userChatDoc.exists()) {
      // Add to existing chatData array
      await updateDoc(userChatRef, {
        chatData: arrayUnion(groupChatData)
      });
    } else {
      // Create new chatData array
      await setDoc(userChatRef, {
        chatData: [groupChatData]
      });
    }
  };


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

  // reder group 
  useEffect(() => {
    // const fetchGroupChats = async () => {
    //   try {
    //     const userChatRef = doc(db, "userChats", user.id);
    //     const userChatDoc = await getDoc(userChatRef);

    //     if (userChatDoc.exists()) {
    //       const chatData = userChatDoc.data().chatData || [];
    //       const groupChats = chatData.filter(chat => chat.isGroup);
    //       console.log("Group Chats:", groupChats);
    //       setChatDataGroup(groupChats);
    //     }
    //   } catch (error) {
    //     console.error("Error fetching group chats:", error);
    //   }
    // }
    // fetchGroupChats();
    if (!user?.id) return;
    const userChatRef = doc(db, "userChats", user.id)
    const unsub = onSnapshot(userChatRef, async (snap) => {
      if (snap.exists()) {
        const chatData = snap.data().chatData || [];
        const groupChats = chatData.filter(chat => chat.isGroup);
        setChatDataGroup(groupChats);
      } else {
        setChatDataGroup([]);
      }
    })
    return () => {
      unsub();
    }
  }, [user?.id])

  // Real-time group chat listener
  useEffect(() => {
    // Only proceed if we have a valid user ID
    if (!user?.id) return;

  

    // Create a reference to the user's chat document
    const userChatRef = doc(db, "userChats", user.id);

    // Set up the real-time listener
    const unsubscribe = onSnapshot(userChatRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const chatData = docSnapshot.data().chatData || [];

        // Filter to get only group chats
        const groupChats = chatData.filter(chat => chat.isGroup);

      

        // Sort group chats by last update time (newest first)
        const sortedGroupChats = [...groupChats].sort((a, b) =>
          (b.updatedAt || 0) - (a.updatedAt || 0)
        );

        setChatDataGroup(sortedGroupChats);
      } else {
        // No chat data exists yet
        setChatDataGroup([]);
      }
    }, (error) => {
      console.error("Error listening to group chats:", error);
      toast.error("Failed to load group chats");
    });

    // Clean up the listener when component unmounts or user changes
    return () => {
      console.log("Cleaning up group chat listener");
      unsubscribe();
    };
  }, [user?.id]);

  // Real-time direct chat listener
  useEffect(() => {
    // Only proceed if there's a valid user
    if (!user?.id) return;

    // Create reference to user's chat document
    const userChatRef = doc(db, "userChats", user.id);

    // Set up the real-time listener for all chats
    const unsubscribe = onSnapshot(userChatRef, async (docSnapshot) => {
      if (!docSnapshot.exists()) return;

      const allChats = docSnapshot.data().chatData || [];

      // Process direct chats (non-group chats)
      const directChats = allChats.filter(chat => !chat.isGroup);

      // For direct chats, we need to fetch the other user's data
      const directChatsWithUserData = await Promise.all(
        directChats.map(async (chat) => {
          try {
            // Get the other user's data
            const userDoc = await getDoc(doc(db, "users", chat.rId));
            if (userDoc.exists()) {
              return {
                ...chat,
                user: {
                  id: chat.rId,
                  ...userDoc.data()
                }
              };
            }
            return chat;
          } catch (error) {
            console.error("Error fetching user data:", error);
            return chat;
          }
        })
      );

      // Sort chats by update time (newest first)
      const sortedDirectChats = directChatsWithUserData.sort((a, b) =>
        (b.updatedAt || 0) - (a.updatedAt || 0)
      );

      // Update the AppContext with the processed chat data
      // Note: You might need to modify your context to handle this update
      if (typeof setChatData === 'function') {
        setChatData(sortedDirectChats);
      }
    });

    // Clean up the listener when component unmounts
    return () => unsubscribe();
  }, [user?.id]);

  return (
    <div className='ls'>
      {/* Header */}
      <div className='ls-top'>
        <Button
          type='primary'
          style={{ margin: "10px 10px" }}
          onClick={() => setGroupModalOpen(true)}
        >
          Create a Group
        </Button>

        {/* Group Creation Modal */}
        <Modal
          title="Create Group"
          open={groupModalOpen}
          onCancel={handleModalClose}
          footer={null}
          width={500}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={createGroup}
          >
            {/* Group Image Upload */}
            <Form.Item label="Group Photo" name="groupImage">
              <Upload
                name="avatar"
                listType="picture-circle"
                className="avatar-uploader"
                showUploadList={false}
                beforeUpload={(file) => {
                  // Return false to prevent automatic upload
                  return false;
                }}
                onChange={(e) => handleImageChange(e)}
              >
                {imageUrl ? (
                  <Avatar
                    src={imageUrl}
                    size={100}
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : (
                  <div>
                    <PlusOutlined />
                    <div style={{ marginTop: 8 }}>Upload</div>
                  </div>
                )}
              </Upload>
            </Form.Item>

            {/* Group Name */}
            <Form.Item
              label="Group Name"
              name="groupName"
              rules={[{ required: true, message: 'Please enter a group name' }]}
            >
              <Input placeholder="Enter group name" />
            </Form.Item>

            {/* Group Description */}
            <Form.Item
              label="Group Description (Optional)"
              name="groupDescription"
            >
              <Input.TextArea
                placeholder="Enter group description"
                rows={2}
              />
            </Form.Item>

            {/* Group Members */}
            <Form.Item
              label="Add Members"
              name="members"
              rules={[{ required: true, message: 'Please add at least one member' }]}
            >
              <Select
                mode="multiple"
                placeholder="Search for users to add"
                value={selectedMembers}
                onChange={setSelectedMembers}
                onSearch={searchUsers}
                loading={searchingUsers}
                filterOption={false}
                notFoundContent={searchingUsers ? <Spin size="small" /> : "No users found"}
                style={{ width: '100%' }}
                options={userSearchResults}
              >
              </Select>
            </Form.Item>

            {/* Submit and Cancel Buttons */}
            <Form.Item>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <Button onClick={handleModalClose}>
                  Cancel
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  disabled={!form.getFieldValue('groupName') || selectedMembers.length === 0}
                >
                  Create Group
                </Button>
              </div>
            </Form.Item>
          </Form>
        </Modal>

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
            {chatData.length > 0 || chatDataGroup.length > 0 ? (
              <>
                {/* Group chats section */}
                {chatDataGroup.length > 0 && (
                  <div className="chat-section">
                    <div className="section-header">
                      <h3>Group Chats</h3>
                    </div>

                    {chatDataGroup.map((item, index) => (
                      <div className="frinds" key={`group-${index}`} onClick={() => setChat(item)}>
                        <div className="friend-avatar">
                          <img
                            src={item.groupImage || assets.logo_icon}
                            alt=""
                            className="object-cover"
                          />
                        </div>
                        <div className="friend-info">
                          <div className="friend-header">
                            <p>{item.groupName}</p>
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
                            {item.members?.length || 0} members
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Direct chats section */}
                {chatData.length > 0 && (
                  <div className="chat-section">
                    <div className="section-header">
                      <h3>Direct Messages</h3>
                    </div>

                    {chatData.map((item, index) => (
                      <div className="frinds" key={`direct-${index}`} onClick={() => setChat(item)}>
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
                    ))}
                  </div>
                )}
              </>
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