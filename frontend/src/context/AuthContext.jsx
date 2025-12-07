import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = async (emailOrMobile, password) => {
    const res = await api.post("/auth/login", { emailOrMobile, password });
    localStorage.setItem("token", res.data.token);
    setUser(res.data.user);
  };

  const register = async (payload) => {
    const res = await api.post("/auth/register", payload);
    localStorage.setItem("token", res.data.token);
    setUser(res.data.user);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  const refreshMe = async () => {
    try {
      const res = await api.get("/users/me");
      setUser(res.data);
    } catch {
      logout();
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      refreshMe().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);