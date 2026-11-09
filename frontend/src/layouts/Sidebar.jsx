import { NavLink } from "react-router-dom";
import { BarChart3, ClipboardCheck, History, LayoutDashboard, Package, ScanSearch, Settings, X } from "lucide-react";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/shipments", label: "Shipments", icon: Package },
  { to: "/review", label: "Document Review", icon: ScanSearch },
  { to: "/approvals", label: "Approvals", icon: ClipboardCheck, roles: ["manager"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["manager"] },
  { to: "/activity", label: "Activity History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

function initials(name = "") {
  return name.replace(/\(.*\)/, "").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export default function Sidebar({ mobileOpen, onClose }) {
  const { user } = useAuth();
  const items = NAV.filter((n) => !n.roles || n.roles.includes(user?.role));

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-4 md:justify-center lg:justify-between lg:px-5">
        <span className="md:hidden lg:inline"><Logo /></span>
        <span className="hidden md:inline lg:hidden"><Logo withText={false} /></span>
        <button onClick={onClose} className="rounded p-1 text-slate-400 hover:text-white md:hidden" aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main navigation">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            title={label}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors md:justify-center lg:justify-start ${
                isActive ? "bg-white/10 text-white shadow-inner" : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-brand-200" : "text-slate-400 group-hover:text-slate-200"}`} aria-hidden />
                <span className="md:hidden lg:inline">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2 md:justify-center lg:justify-start">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{initials(user?.full_name)}</div>
          <div className="min-w-0 md:hidden lg:block">
            <p className="truncate text-sm font-medium text-white">{user?.full_name?.replace(/\(.*\)/, "").trim()}</p>
            <p className="text-xs capitalize text-slate-400">{user?.role}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden bg-navy-900 md:block md:w-[72px] lg:w-64">{content}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-navy-950/60" onClick={onClose} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-64 bg-navy-900 shadow-pop">{content}</aside>
        </div>
      )}
    </>
  );
}
