import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { UserDTO } from "@esp/types";
import { apiClient } from "../api/client.js";
import { connectSocket, disconnectSocket } from "../api/socket.js";

interface AuthContextValue {
  user: UserDTO | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, phone?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(() => {
    const raw = localStorage.getItem("esp.user");
    return raw ? (JSON.parse(raw) as UserDTO) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("esp.accessToken");
    if (token && user) connectSocket(token);
    return () => disconnectSocket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistSession(data: { accessToken: string; refreshToken: string; user: UserDTO }) {
    localStorage.setItem("esp.accessToken", data.accessToken);
    localStorage.setItem("esp.refreshToken", data.refreshToken);
    localStorage.setItem("esp.user", JSON.stringify(data.user));
    setUser(data.user);
    connectSocket(data.accessToken);
  }

  async function login(email: string, password: string) {
    setLoading(true);
    try {
      const res = await apiClient.post("/auth/login", { email, password });
      persistSession(res.data);
    } finally {
      setLoading(false);
    }
  }

  async function register(email: string, password: string, fullName: string, phone?: string) {
    setLoading(true);
    try {
      const res = await apiClient.post("/auth/register", { email, password, fullName, phone });
      persistSession(res.data);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("esp.accessToken");
    localStorage.removeItem("esp.refreshToken");
    localStorage.removeItem("esp.user");
    disconnectSocket();
    setUser(null);
  }

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
