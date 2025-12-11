import { Navigate, useLocation } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'

export function PrivateRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, token, userInfo } = useAppStore()
    const location = useLocation()

    // Double verification: check flag AND actual token/userInfo existence
    // This prevents access even if localStorage is manually tampered with
    if (!isAuthenticated || !token || !userInfo) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    return <>{children}</>
}
