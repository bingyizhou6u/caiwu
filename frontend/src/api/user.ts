import { client } from './client'
import { User } from '../types'

export const userApi = {
    getProfile: () => client.get<{ user: User }>('/auth/me'),
    // Add other user-related API calls here
}
