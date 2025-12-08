import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';

const CallContext = createContext();

export const useCall = () => useContext(CallContext);

export const CallProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [isInCall, setIsInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);

  // Refs for video elements
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000');
    setSocket(newSocket);

    // Set up socket event listeners
    newSocket.on('incoming_call', handleIncomingCall);
    newSocket.on('call_answered', handleCallAnswered);
    newSocket.on('call_rejected', handleCallRejected);
    newSocket.on('call_ended', handleCallEnded);
    newSocket.on('webrtc_offer', handleWebRTCOffer);
    newSocket.on('webrtc_answer', handleWebRTCAnswer);
    newSocket.on('webrtc_ice_candidate', handleWebRTCIceCandidate);

    return () => {
      newSocket.off('incoming_call');
      newSocket.off('call_answered');
      newSocket.off('call_rejected');
      newSocket.off('call_ended');
      newSocket.off('webrtc_offer');
      newSocket.off('webrtc_answer');
      newSocket.off('webrtc_ice_candidate');
      newSocket.disconnect();
    };
  }, []);

  // Bind local stream to local video element when stream changes
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Bind remote stream to remote video element when stream changes
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Clean up WebRTC resources
  const cleanupWebRTC = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    setLocalStream(null);
    setRemoteStream(null);
    peerConnectionRef.current = null;
  };

  // Create RTCPeerConnection with proper configuration
  const createPeerConnection = () => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc_ice_candidate', {
          candidate: event.candidate,
          roomId: activeCall?.roomId
        });
      }
    };

    // Handle remote tracks - CORE FIX for two-way video
    pc.ontrack = (event) => {
      console.log('Received remote stream:', event.streams[0]);
      setRemoteStream(event.streams[0]);
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setIsInCall(true);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall();
      }
    };

    return pc;
  };

  // Get user media and setup local stream - SYMMETRIC for both users
  const getLocalMedia = async (type = 'video') => {
    try {
      const constraints = {
        audio: true,
        video: type === 'video'
      };
      
      console.log('Getting user media with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setIsVideoOn(type === 'video');
      return stream;
    } catch (error) {
      console.error('Failed to get local media:', error);
      throw error;
    }
  };

  // Add local tracks to peer connection - SYMMETRIC for both users
  const addLocalTracksToPeerConnection = (pc, stream) => {
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });
    console.log('Local tracks added to peer connection');
  };

  // Initiate call - CALLER flow
  const initiateCall = async (receiverId, type = 'video') => {
    try {
      console.log('Initiating call:', { receiverId, type });
      
      // Clear any existing state
      cleanupWebRTC();
      setActiveCall(null);
      setIsInCall(false);
      setIncomingCall(null);

      // Create call via API
      const response = await api.post('/calls/initiate', { receiverId, type });
      const call = response.data;
      setActiveCall(call);

      // Notify receiver via socket
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

      // CALLER: Get local media and setup WebRTC
      const localMediaStream = await getLocalMedia(type);
      const pc = createPeerConnection();
      
      // Add local tracks BEFORE creating offer
      addLocalTracksToPeerConnection(pc, localMediaStream);

      // Join call room
      if (socket) {
        socket.emit('join_call_room', call.roomId);
      }

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      if (socket) {
        socket.emit('webrtc_offer', {
          targetUserId: receiverId,
          offer: offer,
          roomId: call.roomId
        });
      }

      console.log('Call initiated successfully');
      return call;

    } catch (error) {
      console.error('Failed to initiate call:', error);
      cleanupWebRTC();
      throw error;
    }
  };

  // Answer call - CALLEE flow
  const answerCall = async (callId) => {
    try {
      console.log('Answering call:', callId);

      // Answer call via API
      const response = await api.post(`/calls/${callId}/answer`);
      const call = response.data;
      setActiveCall(call);

      // CALLEE: Get local media and setup WebRTC
      const localMediaStream = await getLocalMedia(call.type);
      const pc = createPeerConnection();
      
      // Add local tracks BEFORE creating answer
      addLocalTracksToPeerConnection(pc, localMediaStream);

      // Join call room
      if (socket) {
        socket.emit('join_call_room', call.roomId);
        socket.emit('answer_call', {
          callId,
          roomId: call.roomId,
          callerId: call.callerId._id
        });
      }

      setIncomingCall(null);
      console.log('Call answered successfully');
      return call;

    } catch (error) {
      console.error('Failed to answer call:', error);
      cleanupWebRTC();
      throw error;
    }
  };

  // Handle WebRTC offer - CALLEE processes offer
  const handleWebRTCOffer = async (data) => {
    try {
      console.log('Received WebRTC offer:', data);
      
      if (!peerConnectionRef.current) {
        console.error('No peer connection found');
        return;
      }

      const pc = peerConnectionRef.current;
      
      // Set remote description (caller's offer)
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      
      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      // Send answer back to caller
      if (socket) {
        socket.emit('webrtc_answer', {
          targetUserId: data.callerId,
          answer: answer,
          roomId: data.roomId
        });
      }

      console.log('WebRTC answer sent');
    } catch (error) {
      console.error('Error handling WebRTC offer:', error);
    }
  };

  // Handle WebRTC answer - CALLER processes answer
  const handleWebRTCAnswer = async (data) => {
    try {
      console.log('Received WebRTC answer:', data);
      
      if (!peerConnectionRef.current) {
        console.error('No peer connection found');
        return;
      }

      const pc = peerConnectionRef.current;
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      
      console.log('WebRTC answer processed');
    } catch (error) {
      console.error('Error handling WebRTC answer:', error);
    }
  };

  // Handle ICE candidates - SYMMETRIC for both users
  const handleWebRTCIceCandidate = async (data) => {
    try {
      if (!peerConnectionRef.current) {
        console.log('ICE candidate received but no peer connection');
        return;
      }

      const pc = peerConnectionRef.current;
      if (pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log('ICE candidate added');
      } else {
        console.log('ICE candidate queued (remote description not set yet)');
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  };

  // Reject call
  const rejectCall = async (callId) => {
    try {
      await api.post(`/calls/${callId}/reject`);
      
      if (socket && incomingCall) {
        socket.emit('reject_call', {
          callId,
          callerId: incomingCall.callerId
        });
      }

      setIncomingCall(null);
    } catch (error) {
      console.error('Failed to reject call:', error);
    }
  };

  // End call
  const endCall = async () => {
    try {
      if (activeCall?._id) {
        await api.post(`/calls/${callId}/end`);
      }

      if (socket && activeCall) {
        socket.emit('end_call', {
          callId: activeCall._id,
          roomId: activeCall.roomId
        });
      }

      cleanupWebRTC();
      setActiveCall(null);
      setIsInCall(false);
      setIncomingCall(null);

    } catch (error) {
      console.error('Failed to end call:', error);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(!videoTrack.enabled);
      }
    }
  };

  // Socket event handlers
  const handleIncomingCall = (data) => {
    console.log('Incoming call received:', data);
    setIncomingCall(data);
  };

  const handleCallAnswered = (data) => {
    console.log('Call answered:', data);
    setIsInCall(true);
  };

  const handleCallRejected = (data) => {
    console.log('Call rejected:', data);
    cleanupWebRTC();
    setActiveCall(null);
    setIsInCall(false);
  };

  const handleCallEnded = (data) => {
    console.log('Call ended:', data);
    cleanupWebRTC();
    setActiveCall(null);
    setIsInCall(false);
    setIncomingCall(null);
  };

  const value = {
    socket,
    activeCall,
    isInCall,
    incomingCall,
    localStream,
    remoteStream,
    isMuted,
    isSpeakerOn,
    isVideoOn,
    localVideoRef,
    remoteVideoRef,
    initiateCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleSpeaker: () => setIsSpeakerOn(!isSpeakerOn)
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
};

export default CallProvider;
