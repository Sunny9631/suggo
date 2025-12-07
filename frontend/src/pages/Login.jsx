import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const { login } = useAuth();
  const [emailOrMobile, setEmailOrMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(emailOrMobile, password);
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="w-full max-w-md bg-slate-800 rounded-lg p-6">
        <h1 className="text-xl font-semibold mb-4">Login</h1>
        {error && <div className="text-red-400 text-sm mb-2">{error}</div>}
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className="w-full px-3 py-2 rounded bg-slate-700 outline-none"
            placeholder="Email, Mobile, or Username"
            value={emailOrMobile}
            onChange={(e) => setEmailOrMobile(e.target.value)}
          />
          <input
            type="password"
            className="w-full px-3 py-2 rounded bg-slate-700 outline-none"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="w-full py-2 rounded bg-indigo-500 hover:bg-indigo-600">
            Login
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-300">
          No account?{" "}
          <Link className="text-indigo-400" to="/register">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;