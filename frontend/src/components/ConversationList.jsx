import React from "react";
import Avatar from "./Avatar";
import CallButton from "./CallButton";

const ConversationList = ({ conversations, activeId, onSelect }) => {
  return (
    <div className="border-r border-slate-700 h-full overflow-y-auto">
      {conversations.map((c) => {
        const other = c.participants?.find((p) => !p.isSelf) || c.participants?.[0];
        return (
          <div
            key={c._id}
            className={`w-full flex items-center gap-2 px-3 py-2 ${
              activeId === c._id ? "bg-slate-800" : ""
            }`}
          >
            <button
              onClick={() => onSelect(c)}
              className="flex items-center gap-2 flex-1 text-left hover:bg-slate-800 rounded px-2 py-1"
            >
              <div className="relative">
                <Avatar url={other?.avatarUrl} size={32} />
                {other?.online && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-800"></div>
                )}
              </div>
              <div className="flex flex-col flex-1">
                <span className="text-sm font-medium">
                  {other?.displayName || other?.username}
                </span>
                <span className={`text-xs ${other?.online ? "text-green-400" : "text-slate-400"}`}>
                  {other?.online ? "Online" : "Offline"}
                </span>
              </div>
            </button>
            <CallButton userId={other?._id} />
          </div>
        );
      })}
    </div>
  );
};

export default ConversationList;