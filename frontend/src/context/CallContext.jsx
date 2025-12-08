import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from './AuthContext';

const CallContext = createContext();

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};

export const CallProvider = ({ children }) => {
  const socketRef = useSocket(true);
  const socket = socketRef?.current;
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [isInCall, setIsInCall] = useState(false);
  const [callHistory, setCallHistory] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  // Fetch active call on mount
  useEffect(() => {
    fetchActiveCall();
    fetchCallHistory();
  }, []);

  // Socket event listeners - only if socket is available
  useEffect(() => {
    if (!socket) return;
    
    console.log('Setting up call socket listeners');
    
    socket.on('incoming_call', handleIncomingCall);
    socket.on('call_answered', handleCallAnswered);
    socket.on('call_rejected', handleCallRejected);
    socket.on('call_ended', handleCallEnded);
    socket.on('webrtc_offer', handleWebRTCOffer);
    socket.on('webrtc_answer', handleWebRTCAnswer);
    socket.on('webrtc_ice_candidate', handleWebRTCIceCandidate);

    return () => {
      console.log('Cleaning up call socket listeners');
      socket.off('incoming_call');
      socket.off('call_answered');
      socket.off('call_rejected');
      socket.off('call_ended');
      socket.off('webrtc_offer');
      socket.off('webrtc_answer');
      socket.off('webrtc_ice_candidate');
    };
  }, [socket]);

  const fetchActiveCall = async () => {
    try {
      const response = await api.get('/calls/active');
      if (response.data) {
        setActiveCall(response.data);
        setIsInCall(response.data.status === 'connected');
      }
    } catch (error) {
      console.error('Failed to fetch active call:', error);
    }
  };

  const fetchCallHistory = async () => {
    try {
      const response = await api.get('/calls/history');
      setCallHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch call history:', error);
    }
  };

  const initiateCall = async (receiverId, type = 'audio') => {
    try {
      console.log('Initiating call with:', { receiverId, type });
      
      // Clear any existing call state first
      setActiveCall(null);
      setIsInCall(false);
      setIncomingCall(null);
      
      const response = await api.post('/calls/initiate', { receiverId, type });
      const call = response.data;
      
      // Notify receiver via socket - only if socket is available
      if (socket) {
        socket.emit('call_user', {
          receiverId,
          callData: {
            callId: call._id,
            type: call.type,
            roomId: call.roomId,
            caller: call.callerId
          }
        });
      }

      setActiveCall(call);
      
      // Caller sets up WebRTC immediately and creates offer
      await setupWebRTC(call.roomId, receiverId, call.type);
      
      return call;
    } catch (error) {
      console.error('Failed to initiate call:', error);
      console.error('Error response data:', error.response?.data);
      console.error('Error status:', error.response?.status);
      throw error;
    }
  };

  const answerCall = async (callId) => {
    try {
      console.log('Answering call with ID:', callId);
      const response = await api.post(`/calls/${callId}/answer`);
      const call = response.data;
      console.log('Call answered successfully:', call);
      
      // Receiver also needs to setup WebRTC to send their stream
      await setupWebRTC(call.roomId, call.callerId._id, call.type);
      
      if (socket) {
        socket.emit('answer_call', {
          callId,
          roomId: call.roomId,
          callerId: call.callerId._id
        });
      }

      setActiveCall(call);
      setIsInCall(true);
      setIncomingCall(null);
      
      // Receiver waits for WebRTC offer from caller
      // Don't setup WebRTC here - wait for webrtc_offer event
      
      return call;
    } catch (error) {
      console.error('Failed to answer call:', error);
      console.error('Error response data:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error response message:', error.response?.data?.message);
      throw error;
    }
  };

  const rejectCall = async (callId) => {
    try {
      await api.post(`/calls/${callId}/reject`);
      
      if (socket) {
        socket.emit('reject_call', {
          callId,
          callerId: incomingCall?.callerId
        });
      }

      setIncomingCall(null);
    } catch (error) {
      console.error('Failed to reject call:', error);
      throw error;
    }
  };

  const endCall = async (callId) => {
    try {
      await api.post(`/calls/${callId}/end`);
      
      if (activeCall && socket) {
        console.log('Ending call, activeCall:', activeCall);
        console.log('Current user ID:', user._id);
        
        // Get the other user's ID - handle different data structures
        let otherUserId;
        
        if (activeCall.callerId && activeCall.receiverId) {
          // Handle object format
          if (typeof activeCall.callerId === 'object' && activeCall.callerId._id) {
            otherUserId = activeCall.callerId._id === user._id 
              ? (activeCall.receiverId._id || activeCall.receiverId)
              : activeCall.callerId._id;
          }
          // Handle string format
          else if (typeof activeCall.callerId === 'string') {
            otherUserId = activeCall.callerId === user._id 
              ? activeCall.receiverId 
              : activeCall.callerId;
          }
          // Handle mixed format (caller is object, receiver is string)
          else if (typeof activeCall.callerId === 'object' && typeof activeCall.receiverId === 'string') {
            otherUserId = activeCall.callerId._id === user._id 
              ? activeCall.receiverId
              : activeCall.callerId._id;
          }
          // Handle mixed format (caller is string, receiver is object)
          else if (typeof activeCall.callerId === 'string' && typeof activeCall.receiverId === 'object') {
            otherUserId = activeCall.callerId === user._id 
              ? activeCall.receiverId._id
              : activeCall.callerId;
          }
        }
        
        console.log('Other user ID:', otherUserId);
        
        if (otherUserId) {
          socket.emit('end_call', {
            callId: activeCall._id,
            receiverId: otherUserId
          });
        } else {
          console.error('Could not determine other user ID for end call');
          console.error('activeCall structure:', {
            callerId: activeCall.callerId,
            receiverId: activeCall.receiverId,
            callerIdType: typeof activeCall.callerId,
            receiverIdType: typeof activeCall.receiverId
          });
        }
      }

      // Clean up streams
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
      }

      setLocalStream(null);
      setRemoteStream(null);
      setActiveCall(null);
      setIsInCall(false);
      setIncomingCall(null);
      
      // Clean up audio element
      if (window.remoteAudio) {
        window.remoteAudio.pause();
        window.remoteAudio.srcObject = null;
        window.remoteAudio = null;
      }
      
      // Clean up video element
      if (window.remoteVideo) {
        window.remoteVideo.pause();
        window.remoteVideo.srcObject = null;
        window.remoteVideo = null;
      }
      
      // Clear video container
      const videoContainer = document.getElementById('remote-video-container');
      if (videoContainer) {
        videoContainer.innerHTML = '';
      }
      
      // Close peer connection
      if (window.currentPeerConnection) {
        window.currentPeerConnection.close();
        window.currentPeerConnection = null;
      }
      
      // Refresh call history
      fetchCallHistory();
    } catch (error) {
      console.error('Failed to end call:', error);
      throw error;
    }
  };

  const setupWebRTC = async (roomId, targetUserId, callType = 'audio') => {
    try {
      console.log('Setting up WebRTC:', { roomId, targetUserId, callType });
      
      // Close any existing connection first
      if (window.currentPeerConnection) {
        window.currentPeerConnection.close();
        window.currentPeerConnection = null;
      }

      // Get user media based on call type
      console.log('Getting user media for:', callType);
      console.log('activeCall.type:', activeCall?.type);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: callType === 'video'
      });
      console.log('Got local stream:', stream);
      console.log('Local stream tracks:', stream.getTracks());
      console.log('Video tracks:', stream.getVideoTracks());
      console.log('Audio tracks:', stream.getAudioTracks());
      console.log('Video track enabled:', stream.getVideoTracks()[0]?.enabled);
      console.log('Video track state:', stream.getVideoTracks()[0]?.readyState);
      setLocalStream(stream);

      // Join call room
      if (socket) {
        socket.emit('join_call_room', roomId);
      }

      // Create peer connection
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };

      const peerConnection = new RTCPeerConnection(configuration);
      window.currentPeerConnection = peerConnection;
      
      console.log('Peer connection created');
      
      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        console.log('Adding track to peer connection:', track);
        console.log('Track kind:', track.kind);
        console.log('Track enabled:', track.enabled);
        peerConnection.addTrack(track, stream);
      });
      console.log('Local tracks added to peer connection');

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket) {
          console.log('Sending ICE candidate to:', targetUserId);
          socket.emit('webrtc_ice_candidate', {
            targetUserId,
            candidate: event.candidate
          });
        }
      };

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log('Received remote stream in setupWebRTC');
        console.log('Remote stream:', event.streams[0]);
        console.log('Remote stream tracks:', event.streams[0].getTracks());
        console.log('Remote video tracks:', event.streams[0].getVideoTracks());
        console.log('Remote audio tracks:', event.streams[0].getAudioTracks());
        console.log('Remote video track enabled:', event.streams[0].getVideoTracks()[0]?.enabled);
        console.log('Remote video track state:', event.streams[0].getVideoTracks()[0]?.readyState);
        
        setRemoteStream(event.streams[0]);
        createAudioElement(event.streams[0]);
        
        // Create video element if this is a video call
        if (callType === 'video') {
          console.log('Creating video element for remote stream');
          createVideoElement(event.streams[0]);
        }
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
      };

      // Only create offer if this is the caller
      console.log('Creating WebRTC offer');
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      socket.emit('webrtc_offer', {
        targetUserId,
        offer: offer
      });
      console.log('WebRTC offer sent to:', targetUserId);

    } catch (error) {
      console.error('Failed to setup WebRTC:', error);
      throw error;
    }
  };

  const createAudioElement = (stream) => {
    // Clean up existing audio element
    if (window.remoteAudio) {
      window.remoteAudio.pause();
      window.remoteAudio.srcObject = null;
    }

    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.muted = false;
    audio.volume = 1.0;
    
    // Store globally
    window.remoteAudio = audio;
    
    console.log('Audio element created and stored globally');

    // Try to play
    const playAudio = async () => {
      try {
        await audio.play();
        console.log('Remote audio playing successfully');
        console.log('Audio volume:', audio.volume);
        console.log('Audio muted:', audio.muted);
      } catch (err) {
        console.log('Audio autoplay blocked, waiting for user interaction');
        const startAudio = () => {
          audio.play().then(() => {
            console.log('Audio started after user interaction');
            console.log('Audio volume:', audio.volume);
            console.log('Audio muted:', audio.muted);
          }).catch(e => console.log('Audio still failed:', e));
          document.removeEventListener('click', startAudio);
        };
        document.addEventListener('click', startAudio, { once: true });
      }
    };
    
    playAudio();
  };

  // Separate function to create and manage video element
  const createVideoElement = (stream) => {
    console.log('createVideoElement called, activeCall:', activeCall);
    console.log('activeCall.type:', activeCall?.type);
    console.log('isInCall:', isInCall);
    console.log('Stream being passed to video element:', stream);
    console.log('Stream video tracks:', stream.getVideoTracks());
    
    // Clean up existing video element
    if (window.remoteVideo) {
      window.remoteVideo.pause();
      window.remoteVideo.srcObject = null;
      if (window.remoteVideo.parentNode) {
        window.remoteVideo.parentNode.removeChild(window.remoteVideo);
      }
    }

    const video = document.createElement('video');
    console.log('Video element created:', video);
    video.srcObject = stream;
    video.autoplay = true;
    video.muted = false; // Don't mute remote video
    video.playsInline = true;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    
    console.log('Video element properties set:', {
      srcObject: video.srcObject,
      autoplay: video.autoplay,
      muted: video.muted,
      playsInline: video.playsInline
    });
    
    // Store the video element globally for later attachment
    window.pendingVideoElement = video;
    
    // Try multiple times with increasing delays to find the container
    const tryAttachVideo = (attempt = 1) => {
      console.log(`Trying to attach video, attempt ${attempt}/5`);
      const container = document.getElementById('remote-video-container');
      if (container) {
        console.log('Found video container:', container);
        // Clear any existing content
        container.innerHTML = '';
        container.appendChild(video);
        console.log('Remote video element attached to container');
        console.log('Video element parent:', video.parentNode);
        console.log('Video element playing:', !video.paused);
        window.pendingVideoElement = null; // Clear the pending element
      } else {
        console.log(`Remote video container not found, attempt ${attempt}/5`);
        if (attempt < 5) {
          // Retry with increasing delays
          setTimeout(() => tryAttachVideo(attempt + 1), 200 * attempt);
        } else {
          console.error('Remote video container not found after 5 attempts');
        }
      }
    };
    
    // Start trying to attach the video
    setTimeout(() => tryAttachVideo(1), 200);
    
    // Store globally
    window.remoteVideo = video;
    
    console.log('Video element created and will be attached to container');
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!isMuted);
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    // In a real implementation, you'd change the audio output device
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
      }
    }
  };

  // Test audio function for debugging
  const testAudio = () => {
    if (window.remoteAudio) {
      console.log('Audio element debug info:');
      console.log('srcObject:', window.remoteAudio.srcObject);
      console.log('paused:', window.remoteAudio.paused);
      console.log('currentTime:', window.remoteAudio.currentTime);
      console.log('volume:', window.remoteAudio.volume);
      console.log('muted:', window.remoteAudio.muted);
      console.log('readyState:', window.remoteAudio.readyState);
      
      // Try to play manually
      window.remoteAudio.play().then(() => {
        console.log('Manual audio play successful');
      }).catch(err => {
        console.log('Manual audio play failed:', err);
      });
    } else {
      console.log('No remote audio element found');
    }
  };

  // Socket event handlers
  const handleIncomingCall = (data) => {
    console.log('Incoming call received:', data);
    console.log('Setting incomingCall state');
    setIncomingCall(data);
  };

  const handleCallAnswered = (data) => {
    setActiveCall(prev => ({ ...prev, status: 'connected' }));
    setIsInCall(true);
    // Receiver doesn't setup WebRTC here - they wait for the offer
    // setupWebRTC will be called when they receive the webrtc_offer event
  };

  const handleCallRejected = (data) => {
    setActiveCall(null);
    setIsInCall(false);
  };

  const handleCallEnded = (data) => {
    console.log('Call ended event received:', data);
    console.log('Current activeCall:', activeCall);
    console.log('Current isInCall:', isInCall);
    
    // Always end the call regardless of current state
    setActiveCall(null);
    setIsInCall(false);
    setIncomingCall(null);
    
    // Clean up streams
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    
    // Clean up audio element
    if (window.remoteAudio) {
      window.remoteAudio.pause();
      window.remoteAudio.srcObject = null;
      window.remoteAudio = null;
    }
    
    // Clean up video element
    if (window.remoteVideo) {
      window.remoteVideo.pause();
      window.remoteVideo.srcObject = null;
      window.remoteVideo = null;
    }
    
    // Clear video container
    const videoContainer = document.getElementById('remote-video-container');
    if (videoContainer) {
      videoContainer.innerHTML = '';
    }
    
    // Close peer connection
    if (window.currentPeerConnection) {
      window.currentPeerConnection.close();
      window.currentPeerConnection = null;
    }
    
    console.log('Call cleanup completed - call should be ended for all users');
  };

  const handleWebRTCOffer = async (data) => {
    try {
      console.log('Received WebRTC offer:', data);
      
      // Always create a fresh peer connection for the receiver
      // Close any existing connection first
      if (window.currentPeerConnection) {
        console.log('Closing existing peer connection');
        window.currentPeerConnection.close();
        window.currentPeerConnection = null;
      }
      
      // Create new peer connection
      console.log('Creating new peer connection for receiver');
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };
      const peerConnection = new RTCPeerConnection(configuration);
      window.currentPeerConnection = peerConnection;
      
      console.log('Peer connection created, signaling state:', peerConnection.signalingState);
      
      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('webrtc_ice_candidate', {
            targetUserId: data.callerId,
            candidate: event.candidate
          });
        }
      };

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log('Received remote stream in WebRTC offer handler');
        console.log('Remote stream tracks:', event.streams[0].getTracks());
        console.log('Remote video tracks:', event.streams[0].getVideoTracks());
        
        setRemoteStream(event.streams[0]);
        createAudioElement(event.streams[0]);
        
        // Create video element if this is a video call
        const callType = activeCall?.type || incomingCall?.type || 'video';
        if (callType === 'video') {
          console.log('Creating video element for remote stream, call type:', callType);
          createVideoElement(event.streams[0]);
        } else {
          console.log('Not creating video element - call type:', callType);
        }
      };

      // Get local media for receiver
      const callType = activeCall?.type || incomingCall?.type || 'video';
      console.log('Getting local media for receiver, call type:', callType);
      console.log('activeCall.type:', activeCall?.type);
      console.log('incomingCall.type:', incomingCall?.type);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: callType === 'video'
      });
      console.log('Got local stream for receiver:', stream);
      console.log('Receiver local video tracks:', stream.getVideoTracks());
      setLocalStream(stream);
      
      // Add local tracks to peer connection
      stream.getTracks().forEach(track => {
        console.log('Adding track to receiver peer connection:', track.kind);
        peerConnection.addTrack(track, stream);
      });
      console.log('Local tracks added to receiver peer connection');

      // Set remote description (caller's offer)
      console.log('Setting remote description from caller');
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      console.log('Remote description set successfully');
      
      // Create answer
      console.log('Creating WebRTC answer');
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log('WebRTC answer created and set as local description');
      
      // Send answer back to caller
      if (socket) {
        socket.emit('webrtc_answer', {
          targetUserId: data.callerId,
          answer: answer
        });
        console.log('WebRTC answer sent to caller');
      }
      
    } catch (error) {
      console.error('Error handling WebRTC offer:', error);
      console.error('Error details:', error.message);
    }
  };

  const handleWebRTCAnswer = async (data) => {
    try {
      if (window.currentPeerConnection) {
        const pc = window.currentPeerConnection;
        console.log('WebRTC current signaling state:', pc.signalingState);
        
        // Only caller should handle answers
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(data.answer);
          console.log('WebRTC answer set successfully');
        } else if (pc.signalingState === 'stable') {
          console.log('WebRTC already connected, ignoring answer');
        } else {
          console.log('WebRTC state mismatch, current state:', pc.signalingState);
        }
      }
    } catch (error) {
      console.error('Error handling WebRTC answer:', error);
    }
  };

  const handleWebRTCIceCandidate = async (data) => {
    try {
      if (window.currentPeerConnection) {
        // Only add ICE candidate if remote description is set
        if (window.currentPeerConnection.remoteDescription) {
          await window.currentPeerConnection.addIceCandidate(data.candidate);
          console.log('ICE candidate added successfully');
        } else {
          console.log('ICE candidate received but remote description not set yet, queuing...');
          // Store candidate for later if needed
          if (!window.pendingIceCandidates) {
            window.pendingIceCandidates = [];
          }
          window.pendingIceCandidates.push(data.candidate);
        }
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  };

  return (
    <CallContext.Provider value={{
      incomingCall,
      activeCall,
      isInCall,
      callHistory,
      localStream,
      remoteStream,
      isMuted,
      isSpeakerOn,
      initiateCall,
      answerCall,
      rejectCall,
      endCall,
      toggleMute,
      toggleSpeaker,
      toggleVideo,
      fetchCallHistory,
      testAudio
    }}>
      {children}
    </CallContext.Provider>
  );
};

export default CallContext;
