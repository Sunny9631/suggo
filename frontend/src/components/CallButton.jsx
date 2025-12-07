import React from 'react';
import { useCall } from '../context/CallContext';
import { useTheme } from '../context/ThemeContext';

const CallButton = ({ userId }) => {
  const { initiateCall } = useCall();
  const { theme } = useTheme();

  const handleCall = async () => {
    try {
      await initiateCall(userId, 'audio');
    } catch (error) {
      console.error('Failed to start call:', error);
      alert('Failed to start call. Please try again.');
    }
  };

  return (
    <button
      onClick={handleCall}
      className={`p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg`}
      title="Start Audio Call"
    >
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
      </svg>
    </button>
  );
};

export default CallButton;
