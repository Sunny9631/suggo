# SUGGO Backend

Real-time chat backend with friend system.

## Features
- JWT Authentication
- Real-time messaging
- Friend requests system
- Online presence tracking
- File uploads (Cloudinary)

## Tech Stack
- Node.js
- Express
- MongoDB
- Socket.io
- JWT
- Cloudinary

## Setup
1. Clone repo
2. Install deps: `npm install`
3. Create .env file
4. Add env vars (see below)
5. Run: `npm start`

## Environment Variables
PORT=5000
MONGO_URI=mongodb+srv://...
JWT_SECRET=your_secret
CLIENT_ORIGIN=http://localhost:5173
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_UPLOAD_PRESET=...

## API Endpoints
- `/api/auth` - Login/Register
- `/api/users` - User management
- `/api/conversations` - Chat conversations
- `/api/messages` - Messages
- `/api/friends` - Friend system
- `/api/uploads` - File uploads

## Socket Events
- `presence_update` - Online status
- `new_message` - New messages
- `friend_request` - Friend requests
- `typing` - Typing indicators

## Deployment
Set env vars in your deployment platform dashboard, not via .env file.