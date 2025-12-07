import React, { useEffect, useRef } from "react";

const MessageList = ({ messages, currentUserId }) => {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {messages.map((m) => {
        const isMine = m.senderId === currentUserId || m.senderId?._id === currentUserId;
        return (
          <div
            key={m._id}
            className={`max-w-xs md:max-w-md rounded px-3 py-2 text-sm ${
              isMine
                ? "ml-auto bg-indigo-600 text-white"
                : "mr-auto bg-slate-700 text-slate-50"
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
            <div className="mt-1 text-[10px] opacity-70">
              {new Date(m.createdAt).toLocaleTimeString()}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;