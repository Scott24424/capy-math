import { randomBytes } from 'node:crypto'
import { normalizeEmail, isValidEmail, checkPassword } from '../../src/core/credentials.js'
import { mergeStates } from '../../src/core/merge.js'
import { defaultState, validateState } from '../../src/storage.js'
import { hashPassword, verifyPassword, burnPasswordTime, safeEqual } from './password.js'
import { createSessionToken, readSessionToken, readCookie, sessionCookie, clearedCookie } from './session.js'

// 핸들러는 순수한 요청 → 응답 변환이다. Vercel 진입점(api/*.js)이 Request 를
// { method, contentType, cookie, ip, bodyText } 로 풀어 넘기고, 저장소와 설정은
// deps 로 받는다. 그래서 테스트는 메모리 저장소만 끼우면 된다.
//
// 결과: { status, body, cookie? }

export const MAX_BODY_BYTES = 64 * 1024
export const MAX_FAILED_LOGINS = 10
export const MAX_FAILED_INVITES = 10
export const LOCK_SECONDS = 15 * 60

const fail = (status, error) => ({ status, body: { error } })

function parseJsonBody(req) {
  if (!/^application\/json\b/i.test(req.contentType ?? '')) return { error: fail(415, 'bad-request') }
  const text = req.bodyText ?? ''
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) return { error: fail(413, 'bad-request') }
  try {
    const value = JSON.parse(text)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: fail(400, 'bad-request') }
    return { value }
  } catch {
    return { error: fail(400, 'bad-request') }
  }
}

function signedIn(user, config, now) {
  const token = createSessionToken({ uid: user.id, email: user.email }, config.sessionSecret, now)
  return sessionCookie(token)
}

export async function signup(req, { store, config, now = Date.now() }) {
  const parsed = parseJsonBody(req)
  if (parsed.error) return parsed.error
  const { email: rawEmail, password, inviteCode } = parsed.value
  const email = normalizeEmail(rawEmail)
  if (!isValidEmail(email)) return fail(400, 'invalid-email')
  if (checkPassword(password) !== 'ok') return fail(400, 'weak-password')

  // 초대 코드를 맞힐 때까지 계속 두드리지 못하게 접속 주소별로 실패를 센다
  const inviteKey = `attempts:invite:${req.ip ?? 'unknown'}`
  const failedInvites = (await store.getJSON(inviteKey)) ?? 0
  if (failedInvites >= MAX_FAILED_INVITES) return fail(429, 'too-many-attempts')
  if (!safeEqual(inviteCode, config.inviteCode)) {
    await store.increment(inviteKey, LOCK_SECONDS)
    return fail(403, 'bad-invite')
  }

  const { salt, hash } = await hashPassword(password)
  const user = { id: randomBytes(12).toString('hex'), email, salt, hash, createdAt: new Date(now).toISOString() }
  const created = await store.setJSON(`user:${email}`, user, { onlyIfAbsent: true })
  if (!created) return fail(409, 'email-taken')

  return { status: 201, body: { email }, cookie: signedIn(user, config, now) }
}

export async function login(req, { store, config, now = Date.now() }) {
  const parsed = parseJsonBody(req)
  if (parsed.error) return parsed.error
  const { email: rawEmail, password } = parsed.value
  const email = normalizeEmail(rawEmail)
  if (!isValidEmail(email) || typeof password !== 'string' || checkPassword(password) === 'too-long') {
    return fail(401, 'bad-credentials')
  }

  const attemptsKey = `attempts:login:${email}`
  const failures = (await store.getJSON(attemptsKey)) ?? 0
  if (failures >= MAX_FAILED_LOGINS) return fail(429, 'too-many-attempts')

  const user = await store.getJSON(`user:${email}`)
  const ok = user ? await verifyPassword(password, user) : (await burnPasswordTime(password), false)
  if (!ok) {
    await store.increment(attemptsKey, LOCK_SECONDS)
    return fail(401, 'bad-credentials')
  }

  await store.remove(attemptsKey)
  return { status: 200, body: { email: user.email }, cookie: signedIn(user, config, now) }
}

export async function logout() {
  return { status: 200, body: { ok: true }, cookie: clearedCookie() }
}

function sessionOf(req, config, now) {
  return readSessionToken(readCookie(req.cookie), config.sessionSecret, now)
}

async function loadProgress(store, uid) {
  return validateState(await store.getJSON(`progress:${uid}`)) ?? defaultState()
}

export async function getProgress(req, { store, config, now = Date.now() }) {
  const session = sessionOf(req, config, now)
  if (!session) return fail(401, 'unauthorized')
  return { status: 200, body: { email: session.email, state: await loadProgress(store, session.uid) } }
}

export async function putProgress(req, { store, config, now = Date.now() }) {
  const session = sessionOf(req, config, now)
  if (!session) return fail(401, 'unauthorized')
  const parsed = parseJsonBody(req)
  if (parsed.error) return parsed.error
  const incoming = validateState(parsed.value.state)
  if (!incoming) return fail(400, 'invalid-state')

  const merged = mergeStates(await loadProgress(store, session.uid), incoming)
  await store.setJSON(`progress:${session.uid}`, merged)
  return { status: 200, body: { state: merged } }
}
