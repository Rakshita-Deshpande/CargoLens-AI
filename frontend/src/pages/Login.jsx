import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, Eye, EyeOff, FileSearch, GitCompareArrows, Lock, ShieldCheck, User } from "lucide-react";
import Logo from "../components/Logo";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { parseError } from "../services/api";

const FEATURES = [
  { icon: FileSearch, title: "Extract", text: "Read invoices, packing lists and bills of lading into structured, confidence-scored fields." },
  { icon: GitCompareArrows, title: "Cross-verify", text: "Deterministic checks across documents. People resolve discrepancies; the system never guesses." },
  { icon: ShieldCheck, title: "Approve and export", text: "Manager sign-off and an audit trail before anything leaves the platform." },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      const p = parseError(err);
      setError(p.status === 401 ? "Incorrect username or password." : p.message);
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy-900 p-12 text-white lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl" aria-hidden />
        <Logo size={36} />
        <div className="relative max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white">Import documentation, verified before it reaches customs.</h1>
          <p className="mt-4 text-base text-slate-300">CargoLens AI replaces manual re-keying and WhatsApp discrepancy chasing with one reviewed, approved record per shipment.</p>
          <ul className="mt-10 space-y-6">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand-200"><Icon className="h-5 w-5" /></span>
                <div>
                  <p className="font-medium text-white">{title}</p>
                  <p className="text-sm text-slate-300">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-400">Extraction, validation, review and export only. CargoLens AI does not file on the customs portal.</p>
      </div>

      <div className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo dark={false} /></div>
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Use your CargoLens account to continue.</p>

          <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {error}
              </div>
            )}
            <div>
              <label htmlFor="username" className="label">Username</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <input id="username" className="input pl-9" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <input id="password" className="input px-9" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600" aria-label={show ? "Hide password" : "Show password"}>
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
              {loading && <Spinner />} {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="eyebrow">Demonstration accounts</p>
            <p className="mt-1 text-xs text-slate-500">Demo credentials only. They must be changed before any real use.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn-secondary btn-sm flex-1" onClick={() => { setUsername("executive"); setPassword("Executive@123"); setError(""); }}>Fill executive</button>
              <button type="button" className="btn-secondary btn-sm flex-1" onClick={() => { setUsername("manager"); setPassword("Manager@123"); setError(""); }}>Fill manager</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
