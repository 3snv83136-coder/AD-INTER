import type { AuthUser } from './types'

const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://app-allo-debouchage.vercel.app').replace(/\/+$/, '')

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type TokenGetter = () => Promise<string | null>
let getToken: TokenGetter = async () => null
let onUnauthorized: (() => void) | null = null

export function setTokenGetter(fn: TokenGetter) {
  getToken = fn
}

export function setOnUnauthorized(fn: (() => void) | null) {
  onUnauthorized = fn
}

export function apiBaseUrl(): string {
  return API_URL
}

function errorMessage(data: unknown, status: number): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const err = (data as { error: unknown }).error
    if (typeof err === 'string' && err.trim()) return err
  }
  return `HTTP ${status}`
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData
  if (init.body && !isForm && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers })
  const data: unknown = await res.json().catch(() => ({}))
  if (res.status === 401 && path !== '/api/auth/mobile') {
    onUnauthorized?.()
  }
  if (!res.ok) {
    throw new ApiError(errorMessage(data, res.status), res.status)
  }
  return data as T
}

export async function loginRequest(username: string, password: string): Promise<{ token: string; user: AuthUser }> {
  return api('/api/auth/mobile', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export type RNUploadFile = {
  uri: string
  name: string
  type: string
}

export async function uploadPhoto(
  interventionId: string,
  file: RNUploadFile,
  legende: string,
): Promise<{ ok: boolean; url: string; photos_urls: string[]; photos_legendes: string[]; terrain_step: number }> {
  const form = new FormData()
  form.append('photo', file as unknown as Blob)
  form.append('legende', legende)
  return api(`/api/interventions/${interventionId}/photo`, {
    method: 'POST',
    body: form,
  })
}
