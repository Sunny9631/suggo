import React, { useState, useEffect, useRef } from "react";
import UploadPreview from "./UploadPreview";

const MessageInput = ({ onSend, uploading, uploadProgress, onTyping }) => {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const typingTimeoutRef = useRef(null);

  const handleTextChange = (e) => {
    const newText = e.target.value;
    setText(newText);
    
    // Trigger typing indicator
    if (onTyping) {
      onTyping(true);
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set new timeout to stop typing indicator after 1 second of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 1000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text && !file) return;
    
    // Stop typing indicator when sending
    if (onTyping && typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      onTyping(false);
    }
    
    await onSend({ text, file });
    setText("");
    setFile(null);
  };

  useEffect(() => {
    return () => {
      // Cleanup timeout on unmount
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-slate-700 p-2 flex flex-col gap-2"
    >
      <UploadPreview file={file} />
      {uploading && (
        <div className="text-xs text-slate-300">
          Uploading... {uploadProgress}%
        </div>
      )}
      <div className="flex gap-2">
        <input
          className="flex-1 px-3 py-2 rounded bg-slate-800 outline-none text-sm"
          placeholder="Type a message"
          value={text}
          onChange={handleTextChange}
        />
        <label className="px-3 py-2 bg-slate-800 rounded cursor-pointer text-xs flex items-center">
          Attach
          <input
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
        <button className="px-4 py-2 bg-indigo-500 rounded text-sm">
          Send
        </button>
      </div>
    </form>
  );
};

export default MessageInput;