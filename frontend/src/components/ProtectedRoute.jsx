import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Spinner from "./Spinner";

export default function ProtectedRoute({ roles, children }) {
  const { user, booting } = useAuth();
  const location = useLocation();
  if (booting)
    return (
      <div className="flex h-screen items-center justify-center text-brand-600">
        <Spinner className="h-8 w-8" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
