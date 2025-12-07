import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../hooks/useSocket';
import ConversationList from '../components/ConversationList';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import IncomingCall from '../components/IncomingCall';
import ActiveCall from '../components/ActiveCall';
import ThemeSelector from '../components/ThemeSelector';
import api from '../api/client';
import CallButton from "../components/CallButton";

const Chat = () => {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const { initiateCall } = useCall();
  const socketRef = useSocket(true);
  const [showCallOptions, setShowCallOptions] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [typingUserIds, setTypingUserIds] = useState(new Set());
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("chats"); // "chats", "friends", "requests"
  const [sendingRequest, setSendingRequest] = useState(null);

  const handleAudioCall = async () => {
    if (!activeConvo) return;
    const otherUser = activeConvo.participants.find(p => p._id !== user._id);
    console.log('Audio call - otherUser:', otherUser);
    console.log('Audio call - otherUser._id:', otherUser?._id);
    console.log('Audio call - current user._id:', user._id);
    if (otherUser) {
      try {
        await initiateCall(otherUser._id, 'audio');
        setShowCallOptions(false);
      } catch (error) {
        console.error('Failed to initiate audio call:', error);
      }
    }
  };

  const handleVideoCall = async () => {
    if (!activeConvo) return;
    const otherUser = activeConvo.participants.find(p => p._id !== user._id);
    console.log('Video call - otherUser:', otherUser);
    console.log('Video call - otherUser._id:', otherUser?._id);
    console.log('Video call - current user._id:', user._id);
    if (otherUser) {
      try {
        await initiateCall(otherUser._id, 'video');
        setShowCallOptions(false);
      } catch (error) {
        console.error('Failed to initiate video call:', error);
      }
    }
  };

  const loadConversations = async () => {
    const res = await api.get("/conversations");
    const meId = user._id;
    const withSelfFlag = res.data.map((c) => ({
      ...c,
      participants: c.participants.map((p) => ({
        ...p,
        isSelf: p._id === meId
      }))
    }));
    setConversations(withSelfFlag);
    if (!activeConvo && withSelfFlag[0]) {
      setActiveConvo(withSelfFlag[0]);
    }
  };

  const loadMessages = async (conversationId, cursor) => {
    const res = await api.get(`/conversations/${conversationId}/messages`, {
      params: { limit: 20, cursor }
    });
    setNextCursor(res.data.nextCursor);
    if (cursor) {
      setMessages((prev) => [...res.data.messages, ...prev]);
    } else {
      setMessages(res.data.messages);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSearch && !event.target.closest('.search-container')) {
        setShowSearch(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSearch]);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (!activeConvo) return;
    loadMessages(activeConvo._id, null);
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit("join_conversation", activeConvo._id);

    return () => {
      socket.emit("leave_conversation", activeConvo._id);
    };
  }, [activeConvo?._id]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleNewMessage = (msg) => {
      if (msg.conversationId === activeConvo?._id && msg.senderId !== user._id) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    const handleTyping = ({ userId, isTyping }) => {
      setTypingUserIds((prev) => {
        const set = new Set(prev);
        if (isTyping) set.add(userId);
        else set.delete(userId);
        return set;
      });
    };

    const handlePresenceUpdate = ({ userId, online }) => {
      // Update conversations list with new online status
      setConversations((prev) => 
        prev.map((convo) => ({
          ...convo,
          participants: convo.participants.map((p) => 
            p._id === userId ? { ...p, online } : p
          )
        }))
      );
    };

    const handleMessageSeen = (data) => {
      console.log("Received message_seen event:", data);
      // Update message seen status in real-time
      setMessages(prev => prev.map(msg => 
        msg._id === data.messageId 
          ? { ...msg, seen: true, seenAt: data.seenAt }
          : msg
      ));
    };

    socket.on("new_message", handleNewMessage);
    socket.on("typing", handleTyping);
    socket.on("presence_update", handlePresenceUpdate);
    socket.on("message_seen", handleMessageSeen);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("typing", handleTyping);
      socket.off("presence_update", handlePresenceUpdate);
      socket.off("message_seen", handleMessageSeen);
    };
  }, [activeConvo?._id, socketRef.current]);

  // Handle message seen updates from polling
  useEffect(() => {
    const handleMessageSeenUpdate = (event) => {
      const { messageId, seen } = event.detail;
      setMessages(prev => prev.map(msg => 
        msg._id === messageId 
          ? { ...msg, seen, seenAt: seen ? new Date() : undefined }
          : msg
      ));
    };

    window.addEventListener('messageSeenUpdate', handleMessageSeenUpdate);
    return () => {
      window.removeEventListener('messageSeenUpdate', handleMessageSeenUpdate);
    };
  }, []);

  const handleSend = async ({ text, file }) => {
    if (!activeConvo) return;
    let attachments = [];

    if (file) {
      setUploading(true);
      setUploadProgress(10);

      try {
        // Get upload config from backend
        const presetRes = await api.get("/uploads/preset");
        const { cloudName, uploadPreset, folder } = presetRes.data;

        const form = new FormData();
        form.append("file", file);
        form.append("upload_preset", uploadPreset);
        if (folder) form.append("folder", folder);

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
          {
            method: "POST",
            body: form
          }
        );
        
        if (!res.ok) {
          throw new Error('Upload failed');
        }
        
        const data = await res.json();
        setUploadProgress(100);

        attachments.push({
          url: data.secure_url,
          mimeType:
            data.resource_type === "image"
              ? "image/*"
              : data.resource_type === "video"
              ? "video/*"
              : "application/octet-stream",
          filename: data.original_filename,
          size: file.size
        });
      } catch (error) {
        console.error('Upload error:', error);
        setError('Failed to upload file');
        setUploading(false);
        return;
      }

      setUploading(false);
    }

    const optimistic = {
      _id: `tmp-${Date.now()}`,
      conversationId: activeConvo._id,
      senderId: user._id,
      text,
      attachments,
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, optimistic]);

    const socket = socketRef.current;
    if (socket) {
      socket.emit("send_message", {
        conversationId: activeConvo._id,
        text,
        attachments
      });
    }
  };

  const handleTyping = (isTyping) => {
    const socket = socketRef.current;
    if (socket && activeConvo) {
      socket.emit("typing", {
        conversationId: activeConvo._id,
        isTyping
      });
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`/users/search?q=${query}`);
      setSearchResults(res.data);
    } catch (err) {
      console.error("Search error:", err);
      setSearchResults([]);
    }
  };

  const startConversation = async (userId) => {
    try {
      const res = await api.post("/conversations", { participantId: userId });
      const newConvo = res.data;
      
      // Add the new conversation to the list
      setConversations(prev => [newConvo, ...prev]);
      setActiveConvo(newConvo);
      setShowSearch(false);
      setSearchQuery("");
      setSearchResults([]);
      setSidebarOpen(false); // Close sidebar on mobile after starting conversation
    } catch (err) {
      console.error("Start conversation error:", err);
    }
  };

  const sendFriendRequest = async (userId) => {
    try {
      console.log('Sending friend request to:', userId);
      setSendingRequest(userId);
      const response = await api.post("/friends/request", { receiverId: userId });
      console.log('Friend request response:', response);
      setShowSearch(false);
      setSearchQuery("");
      setSearchResults([]);
      setSidebarOpen(false); // Close sidebar on mobile after sending request
    } catch (err) {
      console.error("Friend request sended:", err);
      console.error("Done:", err.response);
      alert(`Friend request sended: ${err.response?.data?.error || err.message}`);
    } finally {
      setSendingRequest(null);
    }
  };

  const startCall = async (userId) => {
    try {
      await initiateCall(userId, 'audio');
    } catch (error) {
      console.error('Failed to start call:', error);
      alert('Failed to start call. Please try again.');
    }
  };

  const typingActive =
    activeConvo &&
    [...typingUserIds].length > 0 &&
    [...typingUserIds].some((id) => id !== user._id);

  return (
    <div className={`min-h-screen ${theme.colors.background} ${theme.colors.text} flex flex-col`}>
      <IncomingCall />
      <ActiveCall />
      <header className={`sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b ${theme.colors.border} ${theme.colors.surface}`}>
        <div className="flex items-center gap-2">
          <span className="font-semibold">SUGGO</span>
          <span className={`text-xs ${theme.colors.textSecondary}`}>
            {user.displayName || user.username}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeSelector />
          <Link to="/profile" className="text-indigo-300">
            Profile
          </Link>
          <button
            onClick={logout}
            className="px-2 py-1 text-xs border border-slate-600 rounded"
          >
            Logout
          </button>
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar */}
        <div className={`fixed md:relative w-80 max-w-xs h-full bg-slate-800 border-r border-slate-700 transform transition-transform duration-300 ease-in-out z-50 md:transform-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}>
          <div className="h-full flex flex-col">
            {/* Mobile Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700 md:hidden">
              <h2 className="font-semibold">Chats</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded hover:bg-slate-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex border-b border-slate-700">
              <button
                onClick={() => setActiveTab("chats")}
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === "chats" 
                    ? "bg-slate-700 text-indigo-400 border-b-2 border-indigo-400" 
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                Chats
              </button>
              <button
                onClick={() => setActiveTab("friends")}
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === "friends" 
                    ? "bg-slate-700 text-indigo-400 border-b-2 border-indigo-400" 
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                Friends
              </button>
              <button
                onClick={() => setActiveTab("requests")}
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors relative ${
                  activeTab === "requests" 
                    ? "bg-slate-700 text-indigo-400 border-b-2 border-indigo-400" 
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                Requests
              </button>
            </div>
            
            {/* Search Bar - only show on chats tab */}
            {activeTab === "chats" && (
              <div className="p-3 border-b border-slate-700">
                <div className="relative search-container">
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => setShowSearch(true)}
                    className="w-full px-3 py-2 bg-slate-700 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {showSearch && searchQuery.length >= 2 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-700 border border-slate-600 rounded shadow-lg z-10 max-h-60 overflow-y-auto">
                      {searchResults.length > 0 ? (
                        searchResults.map((searchUser) => (
                          <div
                            key={searchUser._id}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left"
                          >
                            <div className="relative">
                              <img
                                src={searchUser.avatarUrl || `https://ui-avatars.com/api/?name=${searchUser.displayName || searchUser.username}&background=6366f1&color=fff`}
                                alt={searchUser.displayName || searchUser.username}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                              {searchUser.online && (
                                <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-slate-700"></div>
                              )}
                            </div>
                            <div className="flex flex-col flex-1">
                              <span className="text-sm font-medium">
                                {searchUser.displayName || searchUser.username}
                              </span>
                              <span className={`text-xs ${searchUser.online ? "text-green-400" : "text-slate-400"}`}>
                                {searchUser.online ? "Online" : "Offline"}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => startConversation(searchUser._id)}
                                className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 rounded transition-colors"
                              >
                                Chat
                              </button>
                              <button
                                onClick={() => sendFriendRequest(searchUser._id)}
                                disabled={sendingRequest === searchUser._id}
                                className={`px-2 py-1 text-xs rounded transition-colors ${
                                  sendingRequest === searchUser._id
                                    ? 'bg-green-700 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-700'
                                }`}
                              >
                                {sendingRequest === searchUser._id ? (
                                  <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                                    Sending...
                                  </div>
                                ) : (
                                  'Add'
                                )}
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-xs text-slate-400">
                          No users found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Content based on active tab */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === "chats" && (
                conversations.length > 0 ? (
                  <ConversationList
                    conversations={conversations}
                    activeId={activeConvo?._id}
                    onSelect={setActiveConvo}
                  />
                ) : (
                  <div className="p-4 text-center text-sm text-slate-400">
                    <div className="mb-2">No conversations yet</div>
                    <div>Search for users above to start chatting!</div>
                  </div>
                )
              )}
              {activeTab === "friends" && <FriendsList />}
              {activeTab === "requests" && <FriendRequestsList />}
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {activeConvo ? (
            <>
              {/* Mobile Chat Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900 md:hidden">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 rounded hover:bg-slate-800"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                
                <div className="flex items-center gap-2">
                  {/* Call Options Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowCallOptions(!showCallOptions)}
                      className={`p-2 rounded ${theme.colors.surfaceHover}`}
                      title="Start Call"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                      </svg>
                    </button>

                    {showCallOptions && (
                      <div className={`absolute top-full mt-2 right-0 ${theme.colors.surface} border ${theme.colors.border} rounded-lg shadow-lg p-2 z-50`}>
                        <button
                          onClick={handleAudioCall}
                          className={`flex items-center gap-2 px-3 py-2 rounded hover:${theme.colors.buttonSecondary} w-full text-left ${theme.colors.text}`}
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                          </svg>
                          Audio Call
                        </button>
                        <button
                          onClick={handleVideoCall}
                          className={`flex items-center gap-2 px-3 py-2 rounded hover:${theme.colors.buttonSecondary} w-full text-left ${theme.colors.text}`}
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                          </svg>
                          Video Call
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      const otherUser = activeConvo.participants.find(p => p._id !== user._id);
                      if (otherUser) {
                        window.open(`/profile/${otherUser._id}`, '_blank');
                      }
                    }}
                    className="flex items-center gap-2 hover:bg-slate-800 rounded px-2 py-1 transition-colors"
                  >
                    <div className="relative">
                      <img
                        src={activeConvo.participants.find(p => p._id !== user._id)?.avatarUrl || `https://ui-avatars.com/api/?name=${activeConvo.participants.find(p => p._id !== user._id)?.displayName || activeConvo.participants.find(p => p._id !== user._id)?.username}&background=6366f1&color=fff`}
                        alt={activeConvo.participants.find(p => p._id !== user._id)?.displayName || activeConvo.participants.find(p => p._id !== user._id)?.username}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      {activeConvo.participants.find(p => p._id !== user._id)?.online && (
                        <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-slate-800"></div>
                      )}
                    </div>
                    <span className="font-medium">
                      {activeConvo.participants.find(p => p._id !== user._id)?.displayName || activeConvo.participants.find(p => p._id !== user._id)?.username}
                    </span>
                  </button>
                </div>
              </div>
              
              {/* Desktop Chat Header */}
              <div className="hidden md:flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900">
                <div className="flex items-center gap-2">
                  {/* Call Options Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowCallOptions(!showCallOptions)}
                      className={`p-2 rounded ${theme.colors.surfaceHover}`}
                      title="Start Call"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                      </svg>
                    </button>

                    {showCallOptions && (
                      <div className={`absolute top-full mt-2 left-0 ${theme.colors.surface} border ${theme.colors.border} rounded-lg shadow-lg p-2 z-50`}>
                        <button
                          onClick={handleAudioCall}
                          className={`flex items-center gap-2 px-3 py-2 rounded hover:${theme.colors.buttonSecondary} w-full text-left ${theme.colors.text}`}
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                          </svg>
                          Audio Call
                        </button>
                        <button
                          onClick={handleVideoCall}
                          className={`flex items-center gap-2 px-3 py-2 rounded hover:${theme.colors.buttonSecondary} w-full text-left ${theme.colors.text}`}
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                          </svg>
                          Video Call
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      const otherUser = activeConvo.participants.find(p => p._id !== user._id);
                      if (otherUser) {
                        window.open(`/profile/${otherUser._id}`, '_blank');
                      }
                    }}
                    className="flex items-center gap-2 hover:bg-slate-800 rounded px-2 py-1 transition-colors"
                  >
                    <div className="relative">
                      <img
                        src={activeConvo.participants.find(p => p._id !== user._id)?.avatarUrl || `https://ui-avatars.com/api/?name=${activeConvo.participants.find(p => p._id !== user._id)?.displayName || activeConvo.participants.find(p => p._id !== user._id)?.username}&background=6366f1&color=fff`}
                        alt={activeConvo.participants.find(p => p._id !== user._id)?.displayName || activeConvo.participants.find(p => p._id !== user._id)?.username}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      {activeConvo.participants.find(p => p._id !== user._id)?.online && (
                        <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-slate-800"></div>
                      )}
                    </div>
                    <span className="font-medium">
                      {activeConvo.participants.find(p => p._id !== user._id)?.displayName || activeConvo.participants.find(p => p._id !== user._id)?.username}
                    </span>
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                <MessageList messages={messages} currentUserId={user._id} />
                {typingActive && (
                  <div className="px-3 pb-1 text-xs text-slate-400">
                    Typing...
                  </div>
                )}
              </div>
              
              <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800">
                <MessageInput
                  onSend={handleSend}
                  uploading={uploading}
                  uploadProgress={uploadProgress}
                  onTyping={handleTyping}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
              <div className="text-center">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden mb-4 p-3 rounded-full bg-slate-800 hover:bg-slate-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <div>Select a conversation</div>
                <div className="md:hidden text-xs mt-2">Tap the menu to find users</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
