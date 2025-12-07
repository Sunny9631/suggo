import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';
import { useSocket } from '../hooks/useSocket';

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

    socket.on('incoming_call', handleIncomingCall);
    socket.on('call_answered', handleCallAnswered);
    socket.on('call_rejected', handleCallRejected);
    socket.on('call_ended', handleCallEnded);
    socket.on('webrtc_offer', handleWebRTCOffer);
    socket.on('webrtc_answer', handleWebRTCAnswer);
    socket.on('webrtc_ice_candidate', handleWebRTCIceCandidate);

    return () => {
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
      await setupWebRTC(call.roomId, receiverId);
      
      return call;
    } catch (error) {
      console.error('Failed to initiate call:', error);
      throw error;
    }
  };

  const answerCall = async (callId) => {
    try {
      const response = await api.post(`/calls/${callId}/answer`);
      const call = response.data;
      
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
      throw error;
    }
  };

  const rejectCall = async (callId) => {
    try {
      await api.post(`/calls/${callId}/reject`);
      
      socket.emit('reject_call', {
        callId,
        callerId: incomingCall.callerId
      });

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
        // Get the other user's ID
        const otherUserId = activeCall.receiverId._id === activeCall.callerId?._id 
          ? activeCall.receiverId._id 
          : activeCall.callerId._id;
          
        socket.emit('end_call', {
          callId,
          receiverId: otherUserId
        });
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
      
      // Refresh call history
      fetchCallHistory();
    } catch (error) {
      console.error('Failed to end call:', error);
      throw error;
    }
  };

  const setupWebRTC = async (roomId, targetUserId) => {
    try {
      // Close any existing connection first
      if (window.currentPeerConnection) {
        window.currentPeerConnection.close();
        window.currentPeerConnection = null;
      }

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: false 
      });
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
      
      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('webrtc_ice_candidate', {
            targetUserId,
            candidate: event.candidate
          });
        }
      };

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log('Received remote stream');
        setRemoteStream(event.streams[0]);
        
        // Create audio element to play remote audio
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.muted = false; // Ensure not muted
        
        // Try to play with user interaction fallback
        const playAudio = async () => {
          try {
            await audio.play();
            console.log('Remote audio playing successfully');
          } catch (err) {
            console.log('Audio autoplay blocked, waiting for user interaction');
            // Create a click listener to start audio on user interaction
            const startAudio = () => {
              audio.play().then(() => {
                console.log('Audio started after user interaction');
                document.removeEventListener('click', startAudio);
              }).catch(e => console.log('Audio still failed:', e));
            };
            document.addEventListener('click', startAudio, { once: true });
          }
        };
        
        playAudio();
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log('WebRTC connection state:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
          console.log('WebRTC connection established!');
        } else if (peerConnection.connectionState === 'failed') {
          console.log('WebRTC connection failed');
        }
      };

      // Store peer connection for later use
      window.currentPeerConnection = peerConnection;

      // If this is the caller, create and send offer
      if (socket && targetUserId) {
        console.log('Creating WebRTC offer...');
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        socket.emit('webrtc_offer', {
          targetUserId,
          offer: offer
        });
        console.log('WebRTC offer sent');
      }

    } catch (error) {
      console.error('Failed to setup WebRTC:', error);
      throw error;
    }
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

  // Test audio function for debugging
  const testAudio = () => {
    if (window.remoteAudio) {
      console.log('Audio element debug info:');
      console.log('srcObject:', window.remoteAudio.srcObject);
      console.log('paused:', window.remoteAudio.paused);
      console.log('currentTime:', window.remoteAudio.currentTime);
      console.log('volume:', window.remoteAudio.volume);
      console.log('muted:', window.remoteAudio.muted);
      
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
    
    // Close peer connection
    if (window.currentPeerConnection) {
      window.currentPeerConnection.close();
      window.currentPeerConnection = null;
    }
    
    console.log('Call cleanup completed');
  };

  const handleWebRTCOffer = async (data) => {
    try {
      // Close any existing connection first
      if (window.currentPeerConnection) {
        window.currentPeerConnection.close();
      }

      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };

      const peerConnection = new RTCPeerConnection(configuration);
      
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
        console.log('Received remote stream');
        setRemoteStream(event.streams[0]);
        
        // Create audio element to play remote audio
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.muted = false; // Ensure not muted
        
        // Try to play with user interaction fallback
        const playAudio = async () => {
          try {
            await audio.play();
            console.log('Remote audio playing successfully');
          } catch (err) {
            console.log('Audio autoplay blocked, waiting for user interaction');
            // Create a click listener to start audio on user interaction
            const startAudio = () => {
              audio.play().then(() => {
                console.log('Audio started after user interaction');
                document.removeEventListener('click', startAudio);
              }).catch(e => console.log('Audio still failed:', e));
            };
            document.addEventListener('click', startAudio, { once: true });
          }
        };
        
        playAudio();
      };

      // Store peer connection
      window.currentPeerConnection = peerConnection;

      // Set remote description first
      await peerConnection.setRemoteDescription(data.offer);
      
      // Get user media and add to connection
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: false 
      });
      setLocalStream(stream);
      
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      // Create and send answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      // Send answer back
      socket.emit('webrtc_answer', {
        targetUserId: data.callerId,
        answer: answer
      });

      console.log('WebRTC offer handled and answer sent');

    } catch (error) {
      console.error('Error handling WebRTC offer:', error);
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
        await window.currentPeerConnection.addIceCandidate(data.candidate);
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
      fetchCallHistory,
      testAudio
    }}>
      {children}
    </CallContext.Provider>
  );
};

export default CallContext;
