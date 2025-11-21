import { client } from './client'
import { LoginPayload, LoginResponse, User } from '../types'

export const authApi = {
    login: (payload: LoginPayload) => client.post<LoginResponse>('/auth/login', payload),
    logout: () => client.post<{ success: boolean }>('/auth/logout', {}),
    me: () => client.get<{ user: User }>('/auth/me'),
    changePasswordFirst: (payload: LoginPayload) => client.post<LoginResponse>('/auth/change-password-first', payload),
    bindTotp: (totp: string) => client.post<LoginResponse>('/auth/totp/bind', { totp }),
    verifyTotp: (totp: string) => client.post<LoginResponse>('/auth/totp/verify', { totp }),
}
