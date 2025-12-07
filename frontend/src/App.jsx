import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import Chat from "./pages/Chat";

const App = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <Routes>
      <Route
        path="/"
        element={user ? <Navigate to="/chat" /> : <Navigate to="/login" />}
      />
      <Route
        path="/login"
        element={user ? <Navigate to="/chat" /> : <Login />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to="/chat" /> : <Register />}
      />
      <Route
        path="/profile"
        element={user ? <Profile /> : <Navigate to="/login" />}
      />
      <Route
        path="/chat"
        element={user ? <Chat /> : <Navigate to="/login" />}
      />
    </Routes>
  );
};

export default App;