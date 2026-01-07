import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { AuthProvider } from '@/lib/auth'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

// Layouts
import { MainLayout } from '@/components/layouts/MainLayout'
import { AuthLayout } from '@/components/layouts/AuthLayout'

// Auth Pages
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'

// Main Pages
import { DashboardPage } from '@/pages/DashboardPage'
import { ProjectsPage } from '@/pages/projects/ProjectsPage'
import { ProjectDetailPage } from '@/pages/projects/ProjectDetailPage'
import { LotsPage } from '@/pages/lots/LotsPage'
import { LotDetailPage } from '@/pages/lots/LotDetailPage'
import { ITPPage } from '@/pages/itp/ITPPage'
import { HoldPointsPage } from '@/pages/holdpoints/HoldPointsPage'
import { TestResultsPage } from '@/pages/tests/TestResultsPage'
import { NCRPage } from '@/pages/ncr/NCRPage'
import { DailyDiaryPage } from '@/pages/diary/DailyDiaryPage'
import { ClaimsPage } from '@/pages/claims/ClaimsPage'
import { DocumentsPage } from '@/pages/documents/DocumentsPage'
import { SubcontractorsPage } from '@/pages/subcontractors/SubcontractorsPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        {/* Protected Routes */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Projects */}
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />

          {/* Lots */}
          <Route path="/projects/:projectId/lots" element={<LotsPage />} />
          <Route path="/projects/:projectId/lots/:lotId" element={<LotDetailPage />} />

          {/* ITP */}
          <Route path="/projects/:projectId/itp" element={<ITPPage />} />

          {/* Hold Points */}
          <Route path="/projects/:projectId/hold-points" element={<HoldPointsPage />} />

          {/* Test Results */}
          <Route path="/projects/:projectId/tests" element={<TestResultsPage />} />

          {/* NCR */}
          <Route path="/projects/:projectId/ncr" element={<NCRPage />} />

          {/* Daily Diary */}
          <Route path="/projects/:projectId/diary" element={<DailyDiaryPage />} />

          {/* Progress Claims */}
          <Route path="/projects/:projectId/claims" element={<ClaimsPage />} />

          {/* Documents */}
          <Route path="/projects/:projectId/documents" element={<DocumentsPage />} />

          {/* Subcontractors */}
          <Route path="/projects/:projectId/subcontractors" element={<SubcontractorsPage />} />

          {/* Reports */}
          <Route path="/projects/:projectId/reports" element={<ReportsPage />} />

          {/* Settings */}
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster />
    </AuthProvider>
  )
}

export default App
