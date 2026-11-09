import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setUnauthorizedHandler, tokenStore } from "../services/api";
import { useToast } from "./ToastContext";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(Boolean(tokenStore.get()));

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      toast.warning("Session expired", "Please sign in again.");
    });
  }, [toast]);

  useEffect(() => {
    if (!tokenStore.get()) return;
    api
      .me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setBooting(false));
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await api.login(username, password);
    tokenStore.set(res.access_token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* the token is discarded regardless */
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, booting, login, logout, isManager: user?.role === "manager", isExecutive: user?.role === "executive" }),
    [user, booting, login, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
