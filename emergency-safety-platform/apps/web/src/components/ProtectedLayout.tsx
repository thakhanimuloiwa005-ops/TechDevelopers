import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar.js";

export function ProtectedLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
