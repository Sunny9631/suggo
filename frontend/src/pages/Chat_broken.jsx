import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../hooks/useSocket";
import ConversationList from "../components/ConversationList";
import MessageList from "../components/MessageList";
import MessageInput from "../components/MessageInput";

const Chat = () => {
  const { user, logout } = useAuth();
  const socketRef = useSocket(true);

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
      if (msg.conversationId === activeConvo?._id) {
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

    socket.on("new_message", handleNewMessage);
    socket.on("typing", handleTyping);
    socket.on("presence_update", handlePresenceUpdate);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("typing", handleTyping);
      socket.off("presence_update", handlePresenceUpdate);
    };
  }, [activeConvo?._id, socketRef.current]);

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

const typingActive =
  activeConvo &&
  [...typingUserIds].length > 0 &&
  [...typingUserIds].some((id) => id !== user._id);

return (
  <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
    <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
      <div className="flex items-center gap-2">
        <span className="font-semibold">MERN Chat</span>
        <span className="text-xs text-slate-400">
          {user.displayName || user.username}
        </span>
      </div>
      <div className="flex items-center gap-3 text-sm">
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
          
          {/* Search Bar */}
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
                      <button
                        key={searchUser._id}
                        onClick={() => startConversation(searchUser._id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-600 transition-colors"
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
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {searchUser.displayName || searchUser.username}
                          </span>
                          <span className={`text-xs ${searchUser.online ? "text-green-400" : "text-slate-400"}`}>
                            {searchUser.online ? "Online" : "Offline"}
                          </span>
                        </div>
                      </button>
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
          
          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {conversations.length > 0 ? (
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
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeConvo ? (
          <>
            {/* Mobile Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 md:hidden">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded hover:bg-slate-800"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <img
                    src={activeConvo.participants.find(p => !p.isSelf)?.avatarUrl || `https://ui-avatars.com/api/?name=${activeConvo.participants.find(p => !p.isSelf)?.displayName || activeConvo.participants.find(p => !p.isSelf)?.username}&background=6366f1&color=fff`}
                    alt={activeConvo.participants.find(p => !p.isSelf)?.displayName || activeConvo.participants.find(p => !p.isSelf)?.username}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  {activeConvo.participants.find(p => !p.isSelf)?.online && (
                    <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-slate-800"></div>
                  )}
                </div>
                <span className="font-medium">
                  {activeConvo.participants.find(p => !p.isSelf)?.displayName || activeConvo.participants.find(p => !p.isSelf)?.username}
                </span>
              </div>
            </div>
            
            <MessageList messages={messages} currentUserId={user._id} />
            {typingActive && (
              <div className="px-3 pb-1 text-xs text-slate-400">
                Typing...
              </div>
            )}
            <MessageInput
              onSend={handleSend}
              uploading={uploading}
              uploadProgress={uploadProgress}
              onTyping={handleTyping}
            />
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

export default Chat;