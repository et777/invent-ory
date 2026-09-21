import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { SessionsListPage } from './pages/SessionsListPage'
import { SessionDetailPage } from './pages/SessionDetailPage'
import { ReviewQueuePage } from './pages/ReviewQueuePage'
import { ScanComparisonPage } from './pages/ScanComparisonPage'

function RequireAuth({ children }: { children: ReactElement }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/sessions"
        element={
          <RequireAuth>
            <Layout>
              <SessionsListPage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/sessions/:sessionId"
        element={
          <RequireAuth>
            <Layout>
              <SessionDetailPage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/sessions/:sessionId/review"
        element={
          <RequireAuth>
            <Layout>
              <ReviewQueuePage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/compare"
        element={
          <RequireAuth>
            <Layout>
              <ScanComparisonPage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/sessions" replace />} />
    </Routes>
  )
}

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
