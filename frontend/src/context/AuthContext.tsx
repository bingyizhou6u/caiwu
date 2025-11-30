import React, { createContext, useContext, useState, useEffect } from 'react'
import { message } from 'antd'
import { authApi } from '../api/auth'
import { User, LoginResponse } from '../types'
import { getAuthToken, saveAuthToken, clearAuthToken } from '../utils/authToken'

interface AuthContextType {
    user: User | null
    loggedIn: boolean
    loading: boolean
    permissions: Record<string, boolean>
    login: (data: LoginResponse) => Promise<void>
    logout: () => Promise<void>
    checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loggedIn, setLoggedIn] = useState(false)
    const [loading, setLoading] = useState(true)
    const [permissions, setPermissions] = useState<Record<string, boolean>>({})

    const checkAuth = async () => {
        const token = getAuthToken()
        if (!token) {
            setUser(null)
            setLoggedIn(false)
            setPermissions({})
            setLoading(false)
            return
        }
        try {
            const { user } = await authApi.me()
            if (user) {
                setUser(user)
                setLoggedIn(true)
                // Use permissions from user object if available, otherwise empty
                setPermissions(user.position?.permissions || {})
            } else {
                setUser(null)
                setLoggedIn(false)
                setPermissions({})
            }
        } catch (error) {
            setUser(null)
            setLoggedIn(false)
            setPermissions({})
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        checkAuth()
    }, [])

    const login = async (data: LoginResponse) => {
        if (data.token) {
            saveAuthToken(data.token)
        }
        if (data.user) {
            setUser(data.user)
            setLoggedIn(true)
            setPermissions(data.user.position?.permissions || {})
        }
    }

    const logout = async () => {
        try {
            await authApi.logout()
            message.success('已退出登录')
        } catch (error) {
            message.error('退出失败')
        } finally {
            clearAuthToken()
            setUser(null)
            setLoggedIn(false)
            setPermissions({})
        }
    }

    return (
        <AuthContext.Provider value={{ user, loggedIn, loading, permissions, login, logout, checkAuth }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
