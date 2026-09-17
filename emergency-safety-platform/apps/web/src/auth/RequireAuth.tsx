import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext.js";

export function RequireAuth() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
