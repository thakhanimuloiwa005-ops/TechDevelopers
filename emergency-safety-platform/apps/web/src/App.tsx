import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth.js";
import { ProtectedLayout } from "./components/ProtectedLayout.js";
import { LoginPage } from "./pages/LoginPage.js";
import { RegisterPage } from "./pages/RegisterPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { IncidentDetailPage } from "./pages/IncidentDetailPage.js";
import { TrustedMembersPage } from "./pages/TrustedMembersPage.js";
import { WearablesPage } from "./pages/WearablesPage.js";
import { NotificationsPage } from "./pages/NotificationsPage.js";
import { AuditLogPage } from "./pages/AuditLogPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { DemoModePage } from "./pages/DemoModePage.js";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/incidents/:id" element={<IncidentDetailPage />} />
          <Route path="/trusted-members" element={<TrustedMembersPage />} />
          <Route path="/wearables" element={<WearablesPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/audit-log" element={<AuditLogPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/demo" element={<DemoModePage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
