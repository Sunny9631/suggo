import React from "react";

const Avatar = ({ url, size = 32 }) => {
  const style = { width: size, height: size };
  if (url) {
    return (
      <img
        src={url}
        alt="avatar"
        className="rounded-full object-cover"
        style={style}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-slate-600 flex items-center justify-center text-xs"
      style={style}
    >
      ?
    </div>
  );
};

export default Avatar;