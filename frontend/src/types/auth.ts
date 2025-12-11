import { User } from './index'

export interface LoginResponse {
    user?: User
    token?: string
    expiresIn?: number
    mustChangePassword?: boolean
    needBindTotp?: boolean
    needTotp?: boolean
    error?: string
}

export interface AuthState {
    user: User | null
    loggedIn: boolean
    loading: boolean
    permissions: Record<string, boolean>
}

export interface LoginPayload {
    email: string
    password?: string
    totp?: string
    newPassword?: string
    oldPassword?: string
}
