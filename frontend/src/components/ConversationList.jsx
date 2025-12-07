import React from "react";
import Avatar from "./Avatar";

const ConversationList = ({ conversations, activeId, onSelect }) => {
  return (
    <div className="border-r border-slate-700 h-full overflow-y-auto">
      {conversations.map((c) => {
        const other = c.participants?.find((p) => !p.isSelf) || c.participants?.[0];
        return (
          <button
            key={c._id}
            onClick={() => onSelect(c)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-800 ${
              activeId === c._id ? "bg-slate-800" : ""
            }`}
          >
            <div className="relative">
              <Avatar url={other?.avatarUrl} size={32} />
              {other?.online && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-800"></div>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {other?.displayName || other?.username}
              </span>
              <span className={`text-xs ${other?.online ? "text-green-400" : "text-slate-400"}`}>
                {other?.online ? "Online" : "Offline"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default ConversationList;