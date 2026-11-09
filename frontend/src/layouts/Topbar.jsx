import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChevronDown, FlaskConical, LogOut, Menu, Search, Settings, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useExtractionStatus } from "../hooks/useAsync";
import { useClickOutside } from "../hooks/useClickOutside";
import { Pill } from "../components/Badge";

function Dropdown({ button, children, align = "right", label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={label} className="rounded-lg">
        {button}
      </button>
      {open && (
        <div className={`absolute top-full z-40 mt-2 animate-fade-in rounded-xl border border-slate-200 bg-white shadow-pop ${align === "right" ? "right-0" : "left-0"}`} onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function Topbar({ onMenu }) {
  const { user, logout, isManager } = useAuth();
  const navigate = useNavigate();
  const status = useExtractionStatus();
  const [q, setQ] = useState("");

  const submit = (e) => {
    e.preventDefault();
    navigate(q.trim() ? `/shipments?search=${encodeURIComponent(q.trim())}` : "/shipments");
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-6">
      <button onClick={onMenu} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden" aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      <form onSubmit={submit} className="relative w-full max-w-md" role="search">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} className="input bg-slate-50 pl-9" placeholder="Search shipments, importers, suppliers..." aria-label="Search shipments" />
      </form>
      <div className="ml-auto flex items-center gap-2">
        {status?.is_demo && (
          <Pill tone="amber" className="hidden lg:inline-flex" title={status.message}>
            <FlaskConical className="h-3 w-3" aria-hidden /> Demo extraction mode
          </Pill>
        )}
        {status && !status.is_demo && <Pill tone="violet" className="hidden lg:inline-flex">AI extraction: {status.model}</Pill>}

        <Dropdown label="Notifications" button={<span className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><Bell className="h-5 w-5" /></span>}>
          <div className="w-72 p-4">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <p className="mt-2 text-sm text-slate-500">No notifications. This is a placeholder: the backend has no notifications endpoint yet. Use Activity History for events.</p>
          </div>
        </Dropdown>

        <Dropdown
          label="Account menu"
          button={
            <span className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-slate-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-800 text-xs font-semibold text-white">{user.full_name.replace(/\(.*\)/, "").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("")}</span>
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-medium leading-tight text-slate-900">{user.full_name.replace(/\(.*\)/, "").trim()}</span>
                <span className="flex items-center gap-1 text-[11px] capitalize leading-tight text-slate-500"><ShieldCheck className="h-3 w-3" aria-hidden />{user.role}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
            </span>
          }
        >
          <div className="w-56 p-1.5" role="menu">
            <div className="border-b border-slate-100 px-3 pb-2 pt-1.5">
              <p className="text-sm font-medium text-slate-900">{user.username}</p>
              <p className="text-xs capitalize text-slate-500">{isManager ? "Documentation Manager" : "Documentation Executive"}</p>
            </div>
            <button role="menuitem" onClick={() => navigate("/settings")} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <Settings className="h-4 w-4" /> Settings
            </button>
            <button role="menuitem" onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </Dropdown>
      </div>
    </header>
  );
}
