import { createHmac, timingSafeEqual } from 'node:crypto'

export const COOKIE_NAME = 'capy_session'
export const SESSION_DAYS = 90
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000

const sign = (payload, secret) => createHmac('sha256', secret).update(payload).digest('base64url')

/**
 * 서버에 세션을 저장하지 않는 서명 토큰: base64url(JSON{uid,email,exp}).서명
 * 비밀키를 모르면 만들 수도 고칠 수도 없다.
 */
export function createSessionToken({ uid, email }, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ uid, email, exp: now + SESSION_MS })).toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}

/** 올바르고 만료되지 않았으면 { uid, email }, 아니면 null */
export function readSessionToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string') return null
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra !== undefined) return null
  const expected = Buffer.from(sign(payload, secret))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (typeof data.uid !== 'string' || typeof data.email !== 'string') return null
    if (!Number.isFinite(data.exp) || data.exp <= now) return null
    return { uid: data.uid, email: data.email }
  } catch {
    return null
  }
}

export function sessionCookie(token) {
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}`
}

export function clearedCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}

export function readCookie(header, name = COOKIE_NAME) {
  if (typeof header !== 'string') return null
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim()
  }
  return null
}
