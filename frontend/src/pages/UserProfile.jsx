import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/client";

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get(`/users/${userId}`);
        setUser(response.data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load user profile");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div>Loading profile...</div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-4">{error || "User not found"}</div>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">User Profile</h1>
          <button
            onClick={() => window.close()}
            className="p-2 rounded hover:bg-slate-800 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Profile Card */}
        <div className="bg-slate-800 rounded-lg p-6">
          {/* Avatar and Basic Info */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <img
                src={user.avatarUrl || `https://ui-avatars.com/api/?name=${user.displayName || user.username}&background=6366f1&color=fff`}
                alt={user.displayName || user.username}
                className="w-20 h-20 rounded-full object-cover"
              />
              {user.online && (
                <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-800"></div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold">{user.displayName || user.username}</h2>
              <p className="text-slate-400">@{user.username}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${user.online ? 'bg-green-500' : 'bg-slate-500'}`}></div>
                <span className="text-sm text-slate-400">
                  {user.online ? 'Online' : `Last seen ${new Date(user.lastSeenAt).toLocaleDateString()}`}
                </span>
              </div>
            </div>
          </div>

          {/* Bio */}
          {user.bio && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-slate-400 mb-2">Bio</h3>
              <p className="text-slate-200">{user.bio}</p>
            </div>
          )}

          {/* Additional Info */}
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-slate-700">
              <span className="text-slate-400">Member Since</span>
              <span>{new Date(user.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-700">
              <span className="text-slate-400">Status</span>
              <span className={user.online ? 'text-green-400' : 'text-slate-400'}>
                {user.online ? 'Active' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => window.close()}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
