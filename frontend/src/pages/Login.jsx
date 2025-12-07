import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const Login = () => {
  const { login } = useAuth();
  const { theme } = useTheme();
  const [emailOrMobile, setEmailOrMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(emailOrMobile, password);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${theme.colors.background}`}>
      <div className={`w-full max-w-md ${theme.colors.surface} rounded-lg p-6`}>
        <h1 className="text-xl font-semibold mb-4">Login</h1>
        {error && <div className="text-red-400 text-sm mb-2">{error}</div>}
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className={`w-full px-3 py-2 rounded ${theme.colors.input} ${theme.colors.text} outline-none ${theme.colors.inputFocus}`}
            placeholder="Email, Mobile, or Username"
            value={emailOrMobile}
            onChange={(e) => setEmailOrMobile(e.target.value)}
          />
          <input
            type="password"
            className={`w-full px-3 py-2 rounded ${theme.colors.input} ${theme.colors.text} outline-none ${theme.colors.inputFocus}`}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className={`w-full py-2 rounded ${theme.colors.button} text-white`}>
            Login
          </button>
        </form>
        <p className={`mt-4 text-sm ${theme.colors.textSecondary}`}>
          No account?{" "}
          <Link className={`${theme.colors.accent}`} to="/register">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;