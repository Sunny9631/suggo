import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Register = () => {
  const { register } = useAuth();
  const [form, setForm] = useState({
    username: "",
    email: "",
    mobile: "",
    displayName: "",
    password: ""
  });
  const [error, setError] = useState("");

  const onChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await register(form);
    } catch (err) {
      setError(err.response?.data?.message || "Register failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="w-full max-w-md bg-slate-800 rounded-lg p-6">
        <h1 className="text-xl font-semibold mb-4">Register</h1>
        {error && <div className="text-red-400 text-sm mb-2">{error}</div>}
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            name="username"
            className="w-full px-3 py-2 rounded bg-slate-700 outline-none"
            placeholder="Username"
            value={form.username}
            onChange={onChange}
          />
          <input
            name="email"
            className="w-full px-3 py-2 rounded bg-slate-700 outline-none"
            placeholder="Email"
            value={form.email}
            onChange={onChange}
          />
          <input
            name="mobile"
            className="w-full px-3 py-2 rounded bg-slate-700 outline-none"
            placeholder="Mobile number (optional)"
            value={form.mobile}
            onChange={onChange}
          />
          <input
            name="displayName"
            className="w-full px-3 py-2 rounded bg-slate-700 outline-none"
            placeholder="Display name (optional)"
            value={form.displayName}
            onChange={onChange}
          />
          <input
            type="password"
            name="password"
            className="w-full px-3 py-2 rounded bg-slate-700 outline-none"
            placeholder="Password"
            value={form.password}
            onChange={onChange}
          />
          <button className="w-full py-2 rounded bg-indigo-500 hover:bg-indigo-600">
            Create account
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-300">
          Already have an account?{" "}
          <Link className="text-indigo-400" to="/login">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;