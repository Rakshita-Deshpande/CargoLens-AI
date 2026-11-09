import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="md:pl-[72px] lg:pl-64">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="mx-auto max-w-[1500px] px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
