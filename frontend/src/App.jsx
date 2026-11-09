import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./layouts/AppLayout";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Shipments from "./pages/Shipments";
import ShipmentDetail from "./pages/ShipmentDetail";
import Review from "./pages/Review";
import ReviewQueue from "./pages/ReviewQueue";
import Approvals from "./pages/Approvals";
import Reports from "./pages/Reports";
import Activity from "./pages/Activity";
import SettingsPage from "./pages/Settings";
import NotFound from "./pages/NotFound";

export default function App() {
  const { user, booting } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user && !booting ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="shipments" element={<Shipments />} />
        <Route path="shipments/:ref" element={<ShipmentDetail />} />
        <Route path="shipments/:ref/review" element={<Review />} />
        <Route path="review" element={<ReviewQueue />} />
        <Route path="approvals" element={<ProtectedRoute roles={["manager"]}><Approvals /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute roles={["manager"]}><Reports /></ProtectedRoute>} />
        <Route path="activity" element={<Activity />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
