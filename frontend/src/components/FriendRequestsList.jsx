import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useSocket } from '../hooks/useSocket';

const FriendRequestsList = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const socketRef = useSocket(true);

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleFriendRequest = (request) => {
      console.log('Received friend request:', request);
      // Only add if it's not already in the list
      setRequests(prev => {
        const exists = prev.some(req => req._id === request._id);
        if (!exists) {
          return [request, ...prev];
        }
        return prev;
      });
    };

    const handleFriendRequestAccepted = (friendData) => {
      setRequests(prev => prev.filter(req => 
        req.sender && req.sender._id && friendData && friendData._id && req.sender._id !== friendData._id
      ));
    };

    const handleFriendRequestRejected = (data) => {
      setRequests(prev => prev.filter(req => 
        req.sender && req.sender._id && data && data.receiver && data.receiver._id && req.sender._id !== data.receiver._id
      ));
    };

    socket.on('friend_request', handleFriendRequest);
    socket.on('friend_request_accepted', handleFriendRequestAccepted);
    socket.on('friend_request_rejected', handleFriendRequestRejected);

    return () => {
      socket.off('friend_request', handleFriendRequest);
      socket.off('friend_request_accepted', handleFriendRequestAccepted);
      socket.off('friend_request_rejected', handleFriendRequestRejected);
    };
  }, [socketRef.current]);

  const loadRequests = async () => {
    try {
      const res = await api.get('/friends/requests');
      setRequests(res.data);
    } catch (error) {
      console.error('Error loading friend requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId) => {
    try {
      setActionLoading(prev => ({ ...prev, [requestId]: 'accepting' }));
      await api.post(`/friends/accept/${requestId}`);
      setRequests(prev => prev.filter(req => req._id !== requestId));
    } catch (error) {
      console.error('Friend request accepted:', error);
      alert('Friend request accepted:');
    } finally {
      setActionLoading(prev => ({ ...prev, [requestId]: null }));
    }
  };

  const handleReject = async (requestId) => {
    try {
      setActionLoading(prev => ({ ...prev, [requestId]: 'rejecting' }));
      await api.post(`/friends/reject/${requestId}`);
      setRequests(prev => prev.filter(req => req._id !== requestId));
    } catch (error) {
      console.error('Friend request rejected:', error);
      alert('Friend request rejected:');
    } finally {
      setActionLoading(prev => ({ ...prev, [requestId]: null }));
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-sm text-slate-400">Loading...</div>;
  }

  if (requests.length === 0) {
    return <div className="p-4 text-center text-sm text-slate-400">No friend requests</div>;
  }

  return (
    <div className="space-y-2">
      {requests.map((request) => (
        <div
          key={request._id}
          className="flex items-center justify-between p-3 bg-slate-700 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <img
              src={request.sender?.avatarUrl || `https://ui-avatars.com/api/?name=${request.sender?.displayName || request.sender?.username || 'User'}&background=6366f1&color=fff`}
              alt={request.sender?.displayName || request.sender?.username || 'User'}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div>
              <div className="font-medium text-sm">
                {request.sender?.displayName || request.sender?.username || 'Unknown User'}
              </div>
              <div className="text-xs text-slate-400">
                Sent {new Date(request.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleAccept(request._id)}
              disabled={actionLoading[request._id] === 'accepting'}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                actionLoading[request._id] === 'accepting'
                  ? 'bg-green-700 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {actionLoading[request._id] === 'accepting' ? (
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                  Accepting...
                </div>
              ) : (
                'Accept'
              )}
            </button>
            <button
              onClick={() => handleReject(request._id)}
              disabled={actionLoading[request._id] === 'rejecting'}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                actionLoading[request._id] === 'rejecting'
                  ? 'bg-red-700 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {actionLoading[request._id] === 'rejecting' ? (
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                  Rejecting...
                </div>
              ) : (
                'Reject'
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FriendRequestsList;
