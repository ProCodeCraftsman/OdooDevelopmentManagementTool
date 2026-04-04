import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth-store";
import { ThemeProvider } from "@/components/theme-provider";
import { LoginPage } from "@/pages/login";
import { RegisterPage } from "@/pages/register";
import { DashboardPage } from "@/pages/dashboard";
import { EnvironmentsPage } from "@/pages/environments/list";
import { EnvironmentDetailPage } from "@/pages/environments/details";
import { ModulesPage } from "@/pages/modules";
import { ComparisonPage } from "@/pages/reports/comparison";
import { SettingsEnvironmentsPage } from "@/pages/settings/environments";
import { SettingsRolesPage } from "@/pages/settings/roles";
import { SettingsUsersPage } from "@/pages/settings/users";
import { SettingsControlParametersPage } from "@/pages/settings/control-parameters";
import { MainLayout } from "@/components/layout/main-layout";
import { DevelopmentRequestsListPage } from "@/pages/development-requests/list";
import { DevelopmentRequestsDetailPage } from "@/pages/development-requests/detail";
import { DevelopmentRequestsFormPage } from "@/pages/development-requests/form";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAdmin = useAuthStore((state) => state.user?.is_admin);
  return isAuthenticated && isAdmin ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <MainLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="modules" element={<ModulesPage />} />
          <Route path="environments" element={<EnvironmentsPage />} />
          <Route path="environments/:name" element={<EnvironmentDetailPage />} />
          <Route path="reports/comparison" element={<ComparisonPage />} />
          <Route path="development-requests" element={<DevelopmentRequestsListPage />} />
          <Route path="development-requests/new" element={<DevelopmentRequestsFormPage />} />
          <Route path="development-requests/:id" element={<DevelopmentRequestsDetailPage />} />
          <Route path="development-requests/:id/edit" element={<DevelopmentRequestsFormPage />} />
          <Route path="settings/environments" element={<SettingsEnvironmentsPage />} />
          <Route
            path="settings/users"
            element={
              <AdminRoute>
                <SettingsUsersPage />
              </AdminRoute>
            }
          />
          <Route
            path="settings/roles"
            element={
              <AdminRoute>
                <SettingsRolesPage />
              </AdminRoute>
            }
          />
          <Route
            path="settings/control-parameters"
            element={
              <AdminRoute>
                <SettingsControlParametersPage />
              </AdminRoute>
            }
          />
        </Route>
      </Routes>
    </ThemeProvider>
  );
}

export default App;
