import { message } from 'antd'
import { useAppStore } from '../store/useAppStore'

const BASE_URL = ''

interface RequestOptions extends RequestInit {
    skipErrorHandle?: boolean
    responseType?: 'json' | 'text' | 'blob'
}

class ApiClient {
    public async request<T>(url: string, options: RequestOptions = {}): Promise<T> {
        const { token, logout } = useAppStore.getState()

        const headers = new Headers(options.headers)
        if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
            headers.set('Content-Type', 'application/json')
        }

        if (token) {
            headers.set('Authorization', `Bearer ${token}`)
            headers.set('X-Caiwu-Token', token)
        }

        try {
            const response = await fetch(`${BASE_URL}${url}`, {
                ...options,
                headers,
            })

            // Handle 401 Unauthorized - token invalid or expired
            if (response.status === 401) {
                logout()
                // Force redirect to login page
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login'
                }
                throw new Error('Unauthorized')
            }

            const contentType = response.headers.get('content-type') || ''
            let data: any

            if (options.responseType === 'blob') {
                data = await response.blob()
            } else if (contentType.includes('application/json')) {
                data = await response.json()
            } else {
                data = await response.text()
            }

            if (!response.ok) {
                const errorMessage = typeof data === 'object' && data.error ? data.error : (data || response.statusText)
                if (!options.skipErrorHandle) {
                    message.error(errorMessage)
                }
                throw new Error(errorMessage)
            }

            return data as T
        } catch (error: any) {
            if (!options.skipErrorHandle && error.message !== 'Unauthorized') {
                message.error(error.message || 'Network Error')
            }
            throw error
        }
    }

    get<T>(url: string, options?: RequestOptions) {
        return this.request<T>(url, { ...options, method: 'GET' })
    }

    post<T>(url: string, body?: any, options?: RequestOptions) {
        return this.request<T>(url, {
            ...options,
            method: 'POST',
            body: body instanceof FormData ? body : JSON.stringify(body)
        })
    }

    put<T>(url: string, body?: any, options?: RequestOptions) {
        return this.request<T>(url, {
            ...options,
            method: 'PUT',
            body: body instanceof FormData ? body : JSON.stringify(body)
        })
    }

    delete<T>(url: string, options?: RequestOptions) {
        return this.request<T>(url, { ...options, method: 'DELETE' })
    }

    blob(url: string, options?: RequestOptions) {
        return this.request<Blob>(url, { ...options, method: 'GET', responseType: 'blob' })
    }
}

export const api = new ApiClient()
