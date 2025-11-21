import { message } from 'antd'
import { APIResponse } from '../types'

// Base API URL
export const BASE_URL = '/api'

// Generic request handler
async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const defaultHeaders = {
        'Content-Type': 'application/json',
    }

    const config: RequestInit = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
        credentials: 'include', // Always include cookies
    }

    try {
        const response = await fetch(`${BASE_URL}${url}`, config)
        const data = await response.json()

        if (!response.ok) {
            throw new Error(data.error || `Request failed with status ${response.status}`)
        }

        return data as T
    } catch (error: any) {
        console.error('API Request Error:', error)
        // Optional: Global error handling (e.g., redirect to login on 401)
        if (error.message === 'Unauthorized' || error.status === 401) {
            // Handle unauthorized access if needed
        }
        throw error
    }
}

export const client = {
    get: <T>(url: string) => request<T>(url, { method: 'GET' }),
    post: <T>(url: string, body: any) => request<T>(url, { method: 'POST', body: JSON.stringify(body) }),
    put: <T>(url: string, body: any) => request<T>(url, { method: 'PUT', body: JSON.stringify(body) }),
    delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
}
