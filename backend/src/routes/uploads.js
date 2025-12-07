const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const auth = require("../middleware/auth");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const router = express.Router();

// Configure multer with file size limits
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only allow one file at a time
  },
  fileFilter: (req, file, cb) => {
    // Allowed file types
    const allowedTypes = /jpeg|jpg|png|gif|mp4|webm|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, videos, and documents are allowed.'));
    }
  }
});

router.get("/preset", auth, (req, res) => {
  res.json({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET,
    folder: process.env.CLOUDINARY_UPLOAD_FOLDER || "mern-chat"
  });
});

router.post("/file", auth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file provided" });
    }

    const result = await cloudinary.uploader.upload_stream(
      {
        folder: process.env.CLOUDINARY_UPLOAD_FOLDER || "mern-chat",
        resource_type: "auto",
        max_bytes: 10 * 1024 * 1024, // 10MB limit on Cloudinary side
        format: async (req, res) => {
          // Let Cloudinary handle the format automatically
        }
      },
      (error, uploaded) => {
        if (error) {
          console.error("Cloudinary error:", error);
          return res.status(500).json({ 
            message: "Upload failed",
            error: error.message 
          });
        }
        return res.json({
          url: uploaded.secure_url,
          mimeType: uploaded.resource_type === "image" ? `image/${uploaded.format}` :
                   uploaded.resource_type === "video" ? `video/${uploaded.format}` :
                   "application/octet-stream",
          filename: uploaded.original_filename || uploaded.public_id,
          size: req.file.size
        });
      }
    );

    result.end(req.file.buffer);
  } catch (err) {
    console.error("Upload error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File size too large. Maximum size is 10MB.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ message: 'Too many files. Only one file allowed.' });
    }
  }
  if (error.message === 'Invalid file type. Only images, videos, and documents are allowed.') {
    return res.status(400).json({ message: error.message });
  }
  res.status(500).json({ message: 'Upload failed' });
});

module.exports = router;