import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

export function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("victim@example.com");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate("/");
    } catch {
      setError("Invalid email or password.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm card">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emergency-600 text-lg font-bold text-white">
            GR
          </span>
          <h1 className="text-xl font-bold">Guardian Response</h1>
          <p className="text-sm text-slate-500">Emergency Safety &amp; Incident Response</p>
        </div>
        <form className="space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-emergency-600">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          No account? <Link className="font-semibold text-slate-800 underline" to="/register">Register</Link>
        </p>
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          Seeded demo accounts: <strong>victim@example.com</strong> (has the emergency keyword configured) and{" "}
          <strong>trusted@example.com</strong> (already added as a trusted member) — both use <strong>Password123!</strong>.
        </p>
      </div>
    </div>
  );
}
