import React from 'react';
import { useCall } from '../context/CallContext';
import { useTheme } from '../context/ThemeContext';

const IncomingCall = () => {
  const { incomingCall, answerCall, rejectCall } = useCall();
  const { theme } = useTheme();

  if (!incomingCall) return null;

  const handleAnswer = async () => {
    try {
      await answerCall(incomingCall.callId);
    } catch (error) {
      console.error('Failed to answer call:', error);
    }
  };

  const handleReject = async () => {
    try {
      await rejectCall(incomingCall.callId);
    } catch (error) {
      console.error('Failed to reject call:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className={`${theme.colors.surface} rounded-lg p-6 max-w-sm w-full mx-4`}>
        <div className="text-center">
          <div className="mb-4">
            <div className={`w-16 h-16 mx-auto rounded-full ${theme.colors.primary} flex items-center justify-center`}>
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
            </div>
          </div>
          
          <h3 className={`text-lg font-semibold ${theme.colors.text} mb-2`}>
            Incoming {incomingCall.type} Call
          </h3>
          
          <p className={`${theme.colors.textSecondary} mb-6`}>
            {incomingCall.caller?.displayName || incomingCall.caller?.username || 'Unknown'} is calling you...
          </p>

          <div className="flex gap-4 justify-center">
            <button
              onClick={handleReject}
              className={`p-3 rounded-full ${theme.colors.error} text-white hover:opacity-90 transition-opacity`}
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            
            <button
              onClick={handleAnswer}
              className={`p-3 rounded-full ${theme.colors.success} text-white hover:opacity-90 transition-opacity`}
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCall;
