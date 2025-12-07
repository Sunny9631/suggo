import React from "react";
import ConversationList from "./ConversationList";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";

const ChatLayout = ({
  user,
  conversations,
  activeConvo,
  onSelectConversation,
  messages,
  typingActive,
  onSendMessage,
  uploading,
  uploadProgress
}) => {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <header className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="font-semibold">SUGGO</span>
          {user && (
            <span className="text-xs text-slate-400">
              {user.displayName || user.username}
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="w-1/3 max-w-xs hidden md:block">
          <ConversationList
            conversations={conversations}
            activeId={activeConvo?._id}
            onSelect={onSelectConversation}
          />
        </div>

        <div className="flex-1 flex flex-col">
          {activeConvo ? (
            <>
              <MessageList
                messages={messages}
                currentUserId={user?._id}
              />
              {typingActive && (
                <div className="px-3 pb-1 text-xs text-slate-400">
                  Typing...
                </div>
              )}
              <MessageInput
                onSend={onSendMessage}
                uploading={uploading}
                uploadProgress={uploadProgress}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatLayout;