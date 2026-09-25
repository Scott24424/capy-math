import { describe, it, expect, beforeEach } from 'vitest'
import { hashPassword, verifyPassword, safeEqual } from '../api/_lib/password.js'
import {
  createSessionToken, readSessionToken, readCookie, sessionCookie, COOKIE_NAME, SESSION_DAYS
} from '../api/_lib/session.js'
import { memoryStore, upstashStore } from '../api/_lib/store.js'
import { readConfig, toInput, toResponse } from '../api/_lib/http.js'
import {
  signup, login, logout, getProgress, putProgress, MAX_FAILED_LOGINS, MAX_FAILED_INVITES, LOCK_SECONDS
} from '../api/_lib/handlers.js'
import { defaultState } from '../src/storage.js'

const SECRET = 's'.repeat(40)

describe('password', () => {
  it('해시한 비밀번호만 통과한다', async () => {
    const record = await hashPassword('password123')
    expect(record.salt).toMatch(/^[0-9a-f]{32}$/)
    expect(record.hash).not.toContain('password123')
    expect(await verifyPassword('password123', record)).toBe(true)
    expect(await verifyPassword('password124', record)).toBe(false)
  })
  it('같은 비밀번호도 salt 가 달라 해시가 다르다', async () => {
    const [a, b] = await Promise.all([hashPassword('same-pass'), hashPassword('same-pass')])
    expect(a.hash).not.toBe(b.hash)
  })
  it('safeEqual', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
    expect(safeEqual(undefined, 'abc')).toBe(false)
  })
})

describe('session', () => {
  it('만든 토큰을 읽으면 사용자 정보가 나온다', () => {
    const token = createSessionToken({ uid: 'u1', email: 'a@b.co' }, SECRET, 1000)
    expect(readSessionToken(token, SECRET, 2000)).toEqual({ uid: 'u1', email: 'a@b.co' })
  })
  it('비밀키가 다르거나 내용을 고치면 null', () => {
    const token = createSessionToken({ uid: 'u1', email: 'a@b.co' }, SECRET, 1000)
    expect(readSessionToken(token, 'x'.repeat(40), 2000)).toBeNull()
    const [payload, sig] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ uid: 'u2', email: 'a@b.co', exp: 9e15 })).toString('base64url')
    expect(readSessionToken(`${forged}.${sig}`, SECRET, 2000)).toBeNull()
    expect(readSessionToken(`${payload}.${sig}x`, SECRET, 2000)).toBeNull()
    expect(readSessionToken('garbage', SECRET, 2000)).toBeNull()
    expect(readSessionToken(null, SECRET, 2000)).toBeNull()
  })
  it('90일이 지나면 null', () => {
    const token = createSessionToken({ uid: 'u1', email: 'a@b.co' }, SECRET, 0)
    const day = 24 * 60 * 60 * 1000
    expect(readSessionToken(token, SECRET, SESSION_DAYS * day - 1)).not.toBeNull()
    expect(readSessionToken(token, SECRET, SESSION_DAYS * day)).toBeNull()
  })
  it('쿠키 문자열', () => {
    const c = sessionCookie('tok')
    expect(c).toMatch(/^capy_session=tok;/)
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) expect(c).toContain(flag)
    expect(readCookie(`a=1; ${COOKIE_NAME}=tok.en; b=2`)).toBe('tok.en')
    expect(readCookie('a=1')).toBeNull()
    expect(readCookie(null)).toBeNull()
  })
})

describe('memoryStore', () => {
  it('onlyIfAbsent 와 만료', async () => {
    let t = 0
    const store = memoryStore(() => t)
    expect(await store.setJSON('k', { a: 1 }, { onlyIfAbsent: true })).toBe(true)
    expect(await store.setJSON('k', { a: 2 }, { onlyIfAbsent: true })).toBe(false)
    expect(await store.getJSON('k')).toEqual({ a: 1 })
    expect(await store.increment('n', 10)).toBe(1)
    expect(await store.increment('n', 10)).toBe(2)
    expect(await store.getJSON('n')).toBe(2)
    t = 10_000
    expect(await store.getJSON('n')).toBeNull()
  })
})

describe('upstashStore', () => {
  it('Redis 명령을 REST 로 보낸다', async () => {
    const calls = []
    const replies = ['OK', null, 1, 1]
    const fakeFetch = async (url, init) => {
      calls.push({ url, auth: init.headers.Authorization, body: JSON.parse(init.body) })
      return { ok: true, status: 200, json: async () => ({ result: replies.shift() }) }
    }
    const store = upstashStore({ url: 'https://r.example', token: 'T' }, fakeFetch)
    expect(await store.setJSON('user:a', { x: 1 }, { onlyIfAbsent: true })).toBe(true)
    expect(await store.getJSON('user:b')).toBeNull()
    expect(await store.increment('att', 900)).toBe(1)
    expect(calls.map(c => c.body)).toEqual([
      ['SET', 'user:a', '{"x":1}', 'NX'], ['GET', 'user:b'], ['INCR', 'att'], ['EXPIRE', 'att', 900]
    ])
    expect(calls[0].auth).toBe('Bearer T')
  })
  it('오류 응답이면 예외', async () => {
    const fakeFetch = async () => ({ ok: false, status: 401, json: async () => ({ error: 'bad token' }) })
    await expect(upstashStore({ url: 'u', token: 't' }, fakeFetch).getJSON('k')).rejects.toThrow()
  })
})

describe('http', () => {
  it('설정이 하나라도 빠지면 null', () => {
    const env = { KV_REST_API_URL: 'u', KV_REST_API_TOKEN: 't', INVITE_CODE: 'i', SESSION_SECRET: SECRET }
    expect(readConfig(env)).toEqual({ redis: { url: 'u', token: 't' }, inviteCode: 'i', sessionSecret: SECRET })
    expect(readConfig({ ...env, INVITE_CODE: '' })).toBeNull()
    expect(readConfig({ ...env, SESSION_SECRET: 'short' })).toBeNull()
    const { KV_REST_API_URL, KV_REST_API_TOKEN, ...rest } = env
    expect(readConfig({ ...rest, UPSTASH_REDIS_REST_URL: 'u2', UPSTASH_REDIS_REST_TOKEN: 't2' }).redis)
      .toEqual({ url: 'u2', token: 't2' })
  })
  it('Request 를 핸들러 입력으로, 결과를 Response 로', async () => {
    const request = new Request('https://x/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 'a=1', 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
      body: '{"a":1}'
    })
    expect(await toInput(request)).toEqual({
      method: 'POST', contentType: 'application/json', cookie: 'a=1', ip: '1.2.3.4', bodyText: '{"a":1}'
    })
    const res = toResponse({ status: 201, body: { email: 'a@b.co' }, cookie: 'c=1' })
    expect(res.status).toBe(201)
    expect(res.headers.get('set-cookie')).toBe('c=1')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual({ email: 'a@b.co' })
  })
})

describe('handlers', () => {
  let store, deps, t
  const config = { inviteCode: 'family-code', sessionSecret: SECRET }
  const json = (body, extra = {}) => ({
    method: 'POST', contentType: 'application/json', ip: '9.9.9.9', bodyText: JSON.stringify(body), ...extra
  })
  const cookieOf = (res) => res.cookie.split(';')[0]

  beforeEach(() => {
    t = Date.UTC(2026, 8, 25)
    store = memoryStore(() => t)
    deps = { store, config, get now() { return t } }
  })

  const join = (email = 'Mom@Example.com', password = 'password123') =>
    signup(json({ email, password, inviteCode: 'family-code' }), deps)

  it('가입하면 201, 세션 쿠키, 정규화된 이메일', async () => {
    const res = await join()
    expect(res.status).toBe(201)
    expect(res.body).toEqual({ email: 'mom@example.com' })
    expect(res.cookie).toMatch(/^capy_session=/)
    const user = await store.getJSON('user:mom@example.com')
    expect(user.hash).toBeTruthy()
    expect(JSON.stringify(user)).not.toContain('password123')
  })

  it('가입 입력 오류', async () => {
    expect((await signup(json({ email: 'nope', password: 'password123', inviteCode: 'family-code' }), deps)).body.error).toBe('invalid-email')
    expect((await signup(json({ email: 'a@b.co', password: 'short', inviteCode: 'family-code' }), deps)).body.error).toBe('weak-password')
    expect((await signup(json({ email: 'a@b.co', password: 'password123', inviteCode: 'wrong' }), deps)).body.error).toBe('bad-invite')
    expect((await signup(json({ email: 'a@b.co', password: 'password123' }), deps)).body.error).toBe('bad-invite')
    expect(store.data.has('user:a@b.co')).toBe(false)
  })

  it('같은 이메일은 대소문자가 달라도 한 번만 가입된다', async () => {
    await join('kid@x.com')
    const again = await join('KID@x.com ')
    expect(again.status).toBe(409)
    expect(again.body.error).toBe('email-taken')
  })

  it('초대 코드를 계속 틀리면 잠긴다 — 맞는 코드도 막힌다', async () => {
    for (let i = 0; i < MAX_FAILED_INVITES; i++) {
      await signup(json({ email: 'a@b.co', password: 'password123', inviteCode: `guess${i}` }), deps)
    }
    expect((await join()).body.error).toBe('too-many-attempts')
    t += LOCK_SECONDS * 1000
    expect((await join()).status).toBe(201)
  })

  it('JSON 이 아니면 거부한다', async () => {
    expect((await signup(json({}, { contentType: 'text/plain' }), deps)).body.error).toBe('bad-request')
    expect((await signup(json({}, { bodyText: '{oops' }), deps)).body.error).toBe('bad-request')
    expect((await signup(json({}, { bodyText: '[]' }), deps)).body.error).toBe('bad-request')
  })

  it('로그인 성공과 실패 — 실패 사유를 구분하지 않는다', async () => {
    await join()
    const ok = await login(json({ email: ' MOM@example.com', password: 'password123' }), deps)
    expect(ok.status).toBe(200)
    expect(ok.body).toEqual({ email: 'mom@example.com' })
    const wrongPw = await login(json({ email: 'mom@example.com', password: 'password999' }), deps)
    const noUser = await login(json({ email: 'ghost@example.com', password: 'password123' }), deps)
    expect(wrongPw).toEqual({ status: 401, body: { error: 'bad-credentials' } })
    expect(noUser).toEqual(wrongPw)
  })

  it('로그인을 10번 틀리면 15분 동안 잠기고, 성공하면 카운터가 지워진다', async () => {
    await join()
    for (let i = 0; i < MAX_FAILED_LOGINS - 1; i++) {
      await login(json({ email: 'mom@example.com', password: 'wrongpass' }), deps)
    }
    expect((await login(json({ email: 'mom@example.com', password: 'password123' }), deps)).status).toBe(200)
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      await login(json({ email: 'mom@example.com', password: 'wrongpass' }), deps)
    }
    const locked = await login(json({ email: 'mom@example.com', password: 'password123' }), deps)
    expect(locked).toEqual({ status: 429, body: { error: 'too-many-attempts' } })
    t += LOCK_SECONDS * 1000
    expect((await login(json({ email: 'mom@example.com', password: 'password123' }), deps)).status).toBe(200)
  })

  it('로그아웃은 쿠키를 지운다', async () => {
    const res = await logout()
    expect(res.status).toBe(200)
    expect(res.cookie).toMatch(/^capy_session=;.*Max-Age=0/)
  })

  it('진도: 쿠키 없으면 401, 새 계정은 기본값', async () => {
    expect((await getProgress({ method: 'GET' }, deps)).status).toBe(401)
    const cookie = cookieOf(await join())
    const res = await getProgress({ method: 'GET', cookie }, deps)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ email: 'mom@example.com', state: defaultState() })
  })

  it('진도 저장은 병합이다 — 두 기기가 번갈아 저장해도 줄지 않는다', async () => {
    const cookie = cookieOf(await join())
    const deviceA = { ...defaultState(), level: 5, xp: 3, setsPlayed: 12, badges: ['first-set'] }
    const deviceB = { ...defaultState(), level: 2, xp: 40, setsPlayed: 3, perfectSets: 1, badges: ['first-perfect'] }
    await putProgress(json({ state: deviceA }, { method: 'PUT', cookie }), deps)
    const res = await putProgress(json({ state: deviceB }, { method: 'PUT', cookie }), deps)
    expect(res.status).toBe(200)
    expect(res.body.state).toMatchObject({ level: 5, xp: 3, setsPlayed: 12, perfectSets: 1 })
    expect([...res.body.state.badges].sort()).toEqual(['first-perfect', 'first-set'])
    const reread = await getProgress({ method: 'GET', cookie }, deps)
    expect(reread.body.state).toEqual(res.body.state)
  })

  it('계정마다 진도가 따로다', async () => {
    const mom = cookieOf(await join('mom@x.com'))
    const kid = cookieOf(await join('kid@x.com'))
    await putProgress(json({ state: { ...defaultState(), level: 9 } }, { method: 'PUT', cookie: kid }), deps)
    expect((await getProgress({ method: 'GET', cookie: mom }, deps)).body.state.level).toBe(1)
    expect((await getProgress({ method: 'GET', cookie: kid }, deps)).body.state.level).toBe(9)
  })

  it('진도 저장 거부: 잘못된 state, 너무 큰 본문, 로그인 안 됨', async () => {
    const cookie = cookieOf(await join())
    expect((await putProgress(json({ state: { version: 99 } }, { method: 'PUT', cookie }), deps)).body.error).toBe('invalid-state')
    expect((await putProgress(json({ state: defaultState(), pad: 'x'.repeat(70_000) }, { method: 'PUT', cookie }), deps)).status).toBe(413)
    expect((await putProgress(json({ state: defaultState() }, { method: 'PUT' }), deps)).status).toBe(401)
  })

  it('만료된 쿠키는 401', async () => {
    const cookie = cookieOf(await join())
    t += 91 * 24 * 60 * 60 * 1000
    expect((await getProgress({ method: 'GET', cookie }, deps)).status).toBe(401)
  })
})
