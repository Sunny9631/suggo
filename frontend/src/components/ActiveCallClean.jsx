import React, { useEffect, useState } from 'react';
import { useCall } from '../context/CallContextClean';
import { useTheme } from '../context/ThemeContext';

const ActiveCallClean = () => {
  const { 
    activeCall, 
    isInCall, 
    localStream, 
    remoteStream, 
    isMuted, 
    isVideoOn,
    localVideoRef,
    remoteVideoRef,
    endCall,
    toggleMute,
    toggleVideo
  } = useCall();
  
  const { theme } = useTheme();
  const [callDuration, setCallDuration] = useState(0);

  // Update call duration
  useEffect(() => {
    let interval;
    if (isInCall && activeCall?.startTime) {
      interval = setInterval(() => {
        const duration = Math.floor((Date.now() - new Date(activeCall.startTime)) / 1000);
        setCallDuration(duration);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isInCall, activeCall]);

  // Don't render if not in call
  if (!isInCall || !activeCall) return null;

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getOtherUser = () => {
    // Determine the other user in the call
    if (activeCall.callerId && activeCall.receiverId) {
      const callerId = typeof activeCall.callerId === 'object' 
        ? activeCall.callerId._id 
        : activeCall.callerId;
      const receiverId = typeof activeCall.receiverId === 'object' 
        ? activeCall.receiverId._id 
        : activeCall.receiverId;
      
      // Return the user who is NOT the current user
      // This is a simplified version - adjust based on your auth context
      return callerId === 'currentUserId' ? activeCall.receiverId : activeCall.callerId;
    }
    return null;
  };

  const otherUser = getOtherUser();

  return (
    <div className={`fixed inset-0 z-50 ${theme.colors.background} flex flex-col`}>
      {/* Main Video Area - Remote User */}
      <div className="flex-1 relative bg-black">
        {/* Remote Video (Large Main Frame) */}
        <div className="absolute inset-0 flex items-center justify-center">
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
闲
              className="w-full h-full object-cover"
              muted={false} // Don't mute remote video
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-white">
              {otherUser?.avatarUrl ? (
                <img 
                  src={otherUser.avatarUrl} 
                  alt={otherUser.displayName || otherUser.username}
                  className="w-32 h-32 rounded-full object-cover opacity-50 mb-4"
                />
              ) : (
                <svg className="w-32 h-32 text-gray-400 opacity-50 mb-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              )}
              <p className="text-xl font-semibold">
                {otherUser?.displayName || otherUser?.username || 'Connecting...'}
              </p>
              <p className="text-sm opacity-75 mt-2">
                {remoteStream ? 'Connected' : 'Waiting for video...'}
              </p>
            </div>
          )}
        </div>

        {/* Local Video (Small PiP Frame - Top Right) */}
        <div className="absolute top-4 right-4 w-32 h-24 bg-gray-900 rounded-lg overflow-hidden shadow-2xl border-2 border-gray-700">
          {localStream ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted={true} // Mute local video to prevent echo
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }} // Mirror local video
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-800">
              <svg className="w-8 h-8 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
            </div>
          )}
        </div>

 Sorting
        {/*.
        {/* {/* Call Info Overlay (Top Left) */}
        <div className="absolute top-4 left-4 text-white bg-black bg-opacity-50 rounded-lg px-4 py-2">
          <h2 className="text-xl font-semibold">
            {otherUser?.displayName || otherUser?.username || 'Unknown'}
          </h2>
          <p className="text-sm opacity-90">
            {formatDuration(callDuration)}
          </p>
          {activeCall.type === 'video' && (
            <p className="text-xs opacity-75">
              {isVideoOn ? 'Video On' : 'Video Off'}
            </p>
          )}
        </div>

        {/* Connection Status Indicator */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            remoteStream 
              ? 'bg-green-500 text-white' 
              : 'bg-yellow-500 text-black'
          }`}>
            {remoteStream ? 'Connected' : 'Connecting...'}
          </div>
        </div>
      </div>

      {/* Control Panel */}
      <div className={`${theme.colors.surface} border-t ${theme.colors.border} p-4`}>
        <div className="flex justify-center items-center space-x-4">
          {/* Mute/Unmute Button */}
          <button
            onClick={toggleMute}
            className={`p-4 rounded-full transition-colors ${
              isMuted 
                ? 'bg-red-500 hover:bg-red-600 text都是从' 
                :: 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Video On/Off Button (only for video calls) */}
          {activeCall.type === 'video' && (
            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full transition-colors ${
                !isVideoOn 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
              title={isVideoOn ? 'Turn off video' : 'Turn on video'}
            >
              {isVideoOn ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                  <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                </svg>
              )}
            </button>
          )}

          {/* End Call Button */}
          <button
            onClick={endCall}
            className="p-4 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
            title="End call"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActiveCallClean;
