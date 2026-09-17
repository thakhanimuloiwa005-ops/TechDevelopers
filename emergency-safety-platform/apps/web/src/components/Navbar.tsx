import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

const LINKS = [
  { to: "/", label: "Dashboard" },
  { to: "/trusted-members", label: "Trusted Members" },
  { to: "/wearables", label: "Wearables" },
  { to: "/notifications", label: "Notifications" },
  { to: "/audit-log", label: "Audit Log" },
  { to: "/settings", label: "Settings" },
  { to: "/demo", label: "Demo Mode" },
];

export function Navbar() {
  const { user, logout } = useAuth();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emergency-600 text-sm font-bold text-white">GR</span>
          <span className="font-bold tracking-tight">Guardian Response</span>
        </div>
        <nav className="hidden gap-1 md:flex">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-500 sm:inline">{user?.fullName}</span>
          <button className="btn-outline" onClick={logout}>
            Log out
          </button>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 md:hidden">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
