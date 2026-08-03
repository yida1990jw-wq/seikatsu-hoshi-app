import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppDataProvider } from './context/AppDataContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { WeeklyProgramPage } from './pages/WeeklyProgramPage'
import { MembersPage } from './pages/MembersPage'
import { VenuesPage } from './pages/VenuesPage'
import { ProgramTypesPage } from './pages/ProgramTypesPage'
import { SongsPage } from './pages/SongsPage'
import { TeachingPointsPage } from './pages/TeachingPointsPage'

function LoginRoute() {
  const { session, loading } = useAuth()
  if (loading) return <div className="center-message">読み込み中...</div>
  if (session) return <Navigate to="/" replace />
  return <LoginPage />
}

function AdminArea() {
  return (
    <ProtectedRoute>
      <AppDataProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<WeeklyProgramPage />} />
            <Route path="/members" element={<MembersPage />} />
            <Route path="/venues" element={<VenuesPage />} />
            <Route path="/program-types" element={<ProgramTypesPage />} />
            <Route path="/songs" element={<SongsPage />} />
            <Route path="/teaching-points" element={<TeachingPointsPage />} />
          </Routes>
        </Layout>
      </AppDataProvider>
    </ProtectedRoute>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/*" element={<AdminArea />} />
    </Routes>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </HashRouter>
  )
}
