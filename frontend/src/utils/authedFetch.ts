import { getAuthToken, clearAuthToken } from './authToken'

export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = getAuthToken()
  const headers = new Headers(init.headers || {})
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
    headers.set('X-Caiwu-Token', token)
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
  })

  if (response.status === 401) {
    clearAuthToken()
  }

  return response
}

export async function authedJsonFetch<T = any>(input: RequestInfo | URL, init: RequestInit = {}) {
  const res = await authedFetch(input, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = data?.error || res.statusText
    const err = new Error(message)
    ;(err as any).status = res.status
    throw err
  }
  return data as T
}


export function attachAuthInterceptor() {
  if (typeof window === 'undefined') return
  const globalAny = window as any
  if (globalAny.__caiwuFetchPatched) return
  const originalFetch = window.fetch.bind(window)
  globalAny.__caiwuFetchPatched = true

  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const token = getAuthToken()
    const headers = new Headers(init.headers || {})
    if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json')
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
      headers.set('X-Caiwu-Token', token)
    }
    const response = await originalFetch(input, {
      ...init,
      headers,
      credentials: init.credentials ?? 'include',
    })
    if (response.status === 401) {
      clearAuthToken()
    }
    return response
  }
}
