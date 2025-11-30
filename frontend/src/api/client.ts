import { getAuthToken, clearAuthToken } from '../utils/authToken'

export const BASE_URL = '/api'

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const token = getAuthToken()
    const customHeaders = (options.headers || {}) as Record<string, string>
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...customHeaders
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`
        headers['X-Caiwu-Token'] = token
    }

    const config: RequestInit = {
        ...options,
        headers,
        credentials: 'include'
    }

    const response = await fetch(`${BASE_URL}${url}`, config)
    let data: any = null
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
        data = await response.json()
    } else {
        data = await response.text()
    }

    if (!response.ok) {
        if (response.status === 401) {
            clearAuthToken()
        }
        const message = typeof data === 'string' ? data : data?.error
        throw new Error(message || `Request failed with status ${response.status}`)
    }

    return data as T
}

export const client = {
    get: <T>(url: string) => request<T>(url, { method: 'GET' }),
    post: <T>(url: string, body: any) => request<T>(url, { method: 'POST', body: JSON.stringify(body) }),
    put: <T>(url: string, body: any) => request<T>(url, { method: 'PUT', body: JSON.stringify(body) }),
    delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
}
