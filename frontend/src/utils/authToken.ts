const TOKEN_STORAGE_KEY = 'caiwu:auth_token'

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

export function getAuthToken() {
  if (!isBrowser()) return null
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function saveAuthToken(token: string) {
  if (!isBrowser()) return
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function clearAuthToken() {
  if (!isBrowser()) return
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}
