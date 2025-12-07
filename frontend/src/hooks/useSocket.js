import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

export const useSocket = (enabled = true) => {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    const socket = io(import.meta.env.VITE_SOCKET_URL, {
      auth: { token }
    });
    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [enabled]);

  return socketRef;
};