import React, { useEffect, useRef } from "react";
import api from "../api/client";
import { useTheme } from "../context/ThemeContext";

const MessageList = ({ messages, currentUserId }) => {
  const { theme } = useTheme();
  const bottomRef = useRef(null);
  const markedMessages = useRef(new Set());
  const pollingInterval = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-mark messages as seen when they are displayed
  useEffect(() => {
    messages.forEach(async (message) => {
      // Only mark messages sent by others that haven't been marked yet
      if (
        message.senderId !== currentUserId &&
        message.senderId?._id !== currentUserId &&
        !message.seen &&
        !markedMessages.current.has(message._id)
      ) {
        try {
          await api.put(`/messages/${message._id}/seen`);
          markedMessages.current.add(message._id);
        } catch (error) {
          console.error("Failed to mark message as seen:", error);
        }
      }
    });
  }, [messages, currentUserId]);

  // Poll for message seen status updates
  useEffect(() => {
    // Start polling for sent messages to check if they've been seen
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }

    pollingInterval.current = setInterval(async () => {
      // Only poll if we have messages
      if (!messages || messages.length === 0) {
        return;
      }
      
      const sentMessages = messages.filter(
        m => (m.senderId === currentUserId || m.senderId?._id === currentUserId) && !m.seen
      );

      if (sentMessages.length > 0) {
        try {
          // Check each sent message if it's been seen
          for (const message of sentMessages) {
            // Validate message ID before making request
            if (!message._id || message._id.startsWith('tmp-')) {
              console.log('Skipping invalid message ID:', message._id);
              continue;
            }
            
            const response = await api.get(`/messages/${message._id}`);
            if (response.data.seen !== message.seen) {
              // Trigger a re-render by updating the message
              // This will be handled by the parent component refreshing messages
              window.dispatchEvent(new CustomEvent('messageSeenUpdate', { 
                detail: { messageId: message._id, seen: response.data.seen }
              }));
            }
          }
        } catch (error) {
          console.error("Failed to poll message status:", error);
        }
      }
    }, 2000); // Poll every 2 seconds

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [messages, currentUserId]);

  const getStatusIcon = (message) => {
    if (message.senderId !== currentUserId && message.senderId?._id !== currentUserId) {
      return null; // Don't show status for received messages
    }

    if (message.seen) {
      return (
        <span className="text-blue-400" title="Seen">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" transform="translate(6, 0)"/>
          </svg>
        </span>
      );
    } else {
      return (
        <span className="text-gray-400" title="Sent">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          </svg>
        </span>
      );
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {messages.map((m) => {
        const isMine = m.senderId === currentUserId || m.senderId?._id === currentUserId;
        return (
          <div
            key={m._id}
            className={`max-w-xs md:max-w-md rounded px-3 py-2 text-sm ${
              isMine
                ? `ml-auto ${theme.colors.messageSent} text-white`
                : `mr-auto ${theme.colors.messageReceived} ${theme.colors.text}`
            }`}
          >
            {m.text && <div>{m.text}</div>}
            {m.attachments?.map((a, idx) => {
              const isImage = a.mimeType?.startsWith("image/");
              const isVideo = a.mimeType?.startsWith("video/");
              return (
                <div key={idx} className="mt-1">
                  {isImage && (
                    <img src={a.url} alt={a.filename} className="max-h-40 rounded" />
                  )}
                  {isVideo && (
                    <video controls className="max-h-40 rounded">
                      <source src={a.url} type={a.mimeType} />
                    </video>
                  )}
                  {!isImage && !isVideo && (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-xs"
                    >
                      {a.filename || "Attachment"}
                    </a>
                  )}
                </div>
              );
            })}
            <div className="mt-1 text-[10px] opacity-70 flex items-center justify-between">
              <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
              {getStatusIcon(m)}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;