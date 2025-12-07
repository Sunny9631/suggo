import React from "react";

const UploadPreview = ({ file }) => {
  if (!file) return null;
  const url = URL.createObjectURL(file);
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");

  return (
    <div className="mt-2">
      {isImage && (
        <img src={url} alt="preview" className="max-h-40 rounded border" />
      )}
      {isVideo && (
        <video controls className="max-h-40 rounded border">
          <source src={url} type={file.type} />
        </video>
      )}
      {!isImage && !isVideo && (
        <div className="text-xs text-slate-300">{file.name}</div>
      )}
    </div>
  );
};

export default UploadPreview;