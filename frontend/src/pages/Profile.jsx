import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

const Profile = () => {
  const { user, refreshMe } = useAuth();
  const navigate = useNavigate();
  const [bio, setBio] = useState(user?.bio || "");
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBio(user?.bio || "");
    setDisplayName(user?.displayName || "");
    setAvatarUrl(user?.avatarUrl || "");
  }, [user]);

  const uploadAvatar = async (file) => {
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
      setAvatarUrl(data.secure_url);
    } catch (error) {
      console.error('Avatar upload error:', error);
      alert('Failed to upload avatar');
    }
  };

  const onSave = async () => {
    setSaving(true);
    await api.put("/users/me", { bio, displayName, avatarUrl });
    await refreshMe();
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/chat')}
            className="p-2 rounded hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold">Profile</h1>
        </div>
      </div>
      
      <div className="p-4">
        <div className="max-w-md mx-auto bg-slate-800 rounded p-4 space-y-3">
          <div className="space-y-1 text-sm">
            <div>Username: {user.username}</div>
            <div>Email: {user.email}</div>
          </div>
          <input
            className="w-full px-3 py-2 rounded bg-slate-700 outline-none"
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <textarea
            className="w-full px-3 py-2 rounded bg-slate-700 outline-none min-h-[80px]"
            placeholder="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
          <div className="space-y-2">
            <div className="text-sm">Avatar</div>
            {avatarUrl && (
              <img
                src={avatarUrl}
                alt="avatar"
                className="w-16 h-16 rounded-full object-cover"
              />
            )}
            <input
              type="file"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) await uploadAvatar(file);
              }}
            />
          </div>
          <button
            onClick={onSave}
            disabled={saving}
            className="w-full py-2 bg-indigo-500 rounded"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;