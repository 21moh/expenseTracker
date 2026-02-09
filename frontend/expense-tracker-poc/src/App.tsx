import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ExpenseTrackerPage from './pages/ExpenseTrackerPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isReady } = useAuth()
  if (!isReady) return null
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRedirect() {
  const { token, isReady } = useAuth()
  if (!isReady) return null
  return <Navigate to={token ? '/app' : '/login'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <ExpenseTrackerPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
