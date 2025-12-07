import React, { useState } from 'react';
import { useCall } from '../context/CallContext';
import { useTheme } from '../context/ThemeContext';

const CallButton = ({ userId, className = '' }) => {
  const { initiateCall } = useCall();
  const { theme } = useTheme();
  const [showOptions, setShowOptions] = useState(false);

  const handleAudioCall = async () => {
    try {
      await initiateCall(userId, 'audio');
      setShowOptions(false);
    } catch (error) {
      console.error('Failed to initiate audio call:', error);
    }
  };

  const handleVideoCall = async () => {
    try {
      await initiateCall(userId, 'video');
      setShowOptions(false);
    } catch (error) {
      console.error('Failed to initiate video call:', error);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowOptions(!showOptions)}
        className={`p-2 rounded-full transition-colors ${theme.colors.buttonSecondary} ${theme.colors.text} hover:opacity-80 ${className}`}
        title="Start Call"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
        </svg>
      </button>

      {showOptions && (
        <div className={`absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 ${theme.colors.surface} border ${theme.colors.border} rounded-lg shadow-lg p-2 z-50`}>
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
  );
};

export default CallButton;
