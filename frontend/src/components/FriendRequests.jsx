import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useSocket } from '../hooks/useSocket';

const FriendsList = () => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useSocket(true);

  useEffect(() => {
    loadFriends();
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleFriendRequestAccepted = (friendData) => {
      setFriends(prev => [friendData, ...prev]);
    };

    const handleFriendRemoved = (data) => {
      setFriends(prev => prev.filter(friend => friend._id !== data.friendId));
    };

    const handlePresenceUpdate = ({ userId, online }) => {
      setFriends(prev => 
        prev.map(friend => 
          friend._id === userId ? { ...friend, online } : friend
        )
      );
    };

    socket.on('friend_request_accepted', handleFriendRequestAccepted);
    socket.on('friend_removed', handleFriendRemoved);
    socket.on('presence_update', handlePresenceUpdate);

    return () => {
      socket.off('friend_request_accepted', handleFriendRequestAccepted);
      socket.off('friend_removed', handleFriendRemoved);
      socket.off('presence_update', handlePresenceUpdate);
    };
  }, [socketRef.current]);

  const loadFriends = async () => {
    try {
      const res = await api.get('/friends');
      setFriends(res.data);
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFriend = async (friendId) => {
    try {
      await api.delete(`/friends/remove/${friendId}`);
      setFriends(prev => prev.filter(friend => friend._id !== friendId));
    } catch (error) {
      console.error('Error removing friend:', error);
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-sm text-slate-400">Loading friends...</div>;
  }

  if (friends.length === 0) {
    return <div className="p-4 text-center text-sm text-slate-400">No friends yet</div>;
  }

  return (
    <div className="space-y-2">
      {friends.map((friend) => (
        <div
          key={friend._id}
          className="flex items-center justify-between p-3 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={friend.avatarUrl || `https://ui-avatars.com/api/?name=${friend.displayName || friend.username}&background=6366f1&color=fff`}
                alt={friend.displayName || friend.username}
                className="w-10 h-10 rounded-full object-cover"
              />
              {friend.online && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-700"></div>
              )}
            </div>
            <div>
              <div className="font-medium text-sm">
                {friend.displayName || friend.username}
              </div>
              <div className={`text-xs ${friend.online ? "text-green-400" : "text-slate-400"}`}>
                {friend.online ? "Online" : "Offline"}
              </div>
            </div>
          </div>
          <button
            onClick={() => handleRemoveFriend(friend._id)}
            className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 rounded transition-colors"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
};

export default FriendsList;
