import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { CallProvider } from "./context/CallContext";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import Chat from "./pages/Chat";

// Protected Route wrapper
const PrivateRoute = ({ user, children }) => {
  if (!user) {
    // yaha replace: false rakha hai taki history me entry add ho
    return <Navigate to="/login" replace={false} />;
  }
  return children;
};

const App = () => {
  const { user, loading } = useAuth();

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <ThemeProvider>
      <CallProvider>
        <Routes>
          {/* Default route -> login ya chat */}
          <Route
            path="/"
            element={
              user ? (
                <Navigate to="/chat" replace={false} />
              ) : (
                <Navigate to="/login" replace={false} />
              )
            }
          />

          {/* Auth routes */}
          <Route
            path="/login"
            element={user ? <Navigate to="/chat" replace={false} /> : <Login />}
          />
          <Route
            path="/register"
            element={
              user ? <Navigate to="/chat" replace={false} /> : <Register />
            }
          />

          {/* Protected routes */}
          <Route
            path="/profile"
            element={
              <PrivateRoute user={user}>
                <Profile />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile/:userId"
            element={
              <PrivateRoute user={user}>
                <UserProfile />
              </PrivateRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <PrivateRoute user={user}>
                <Chat />
              </PrivateRoute>
            }
          />

          {/* Agar koi random path ho to user ke hisaab se redirect */}
          <Route
            path="*"
            element={
              <Navigate
                to={user ? "/chat" : "/login"}
                replace={false}
              />
            }
          />
        </Routes>
      </CallProvider>
    </ThemeProvider>
  );
};

export default App;