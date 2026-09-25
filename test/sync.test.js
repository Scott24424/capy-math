import { describe, it, expect, beforeEach } from 'vitest'
import { createApi, createAccount, ACCOUNT_PREFIX, CURRENT_ACCOUNT_KEY } from '../src/sync.js'
import { defaultState, saveState, loadState, STORAGE_KEY } from '../src/storage.js'

class FakeStorage {
  constructor() { this.map = new Map() }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null }
  setItem(k, v) { this.map.set(k, String(v)) }
  removeItem(k) { this.map.delete(k) }
}

const st = (patch = {}) => ({ ...defaultState(), ...patch })

const response = (status, body) => ({ status, json: async () => body })

describe('createApi', () => {
  const apiWith = (reply) => {
    const calls = []
    const api = createApi(async (url, init) => {
      calls.push({ url, ...init })
      if (reply instanceof Error) throw reply
      return reply
    })
    return { api, calls }
  }

  it('me: 200 이면 로그인, unauthorized 401 이면 게스트, 그 외는 서버 없음', async () => {
    expect(await apiWith(response(200, { email: 'a@b.co', state: st({ level: 3 }) })).api.me())
      .toEqual({ kind: 'ok', email: 'a@b.co', state: st({ level: 3 }) })
    expect(await apiWith(response(401, { error: 'unauthorized' })).api.me()).toEqual({ kind: 'guest' })
    expect(await apiWith(response(401, null)).api.me()).toEqual({ kind: 'unavailable' })
    expect(await apiWith(response(404, null)).api.me()).toEqual({ kind: 'unavailable' })
    expect(await apiWith(new TypeError('offline')).api.me()).toEqual({ kind: 'unavailable' })
    expect(await apiWith(response(200, { email: 'a@b.co', state: { version: 99 } })).api.me()).toEqual({ kind: 'unavailable' })
  })

  it('login/signup: JSON 으로 보내고 오류 코드를 돌려준다', async () => {
    const { api, calls } = apiWith(response(200, { email: 'a@b.co' }))
    expect(await api.login({ email: 'a@b.co', password: 'password1' })).toEqual({ ok: true })
    expect(calls[0].url).toBe('/api/login')
    expect(calls[0].method).toBe('POST')
    expect(calls[0].headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(calls[0].body)).toEqual({ email: 'a@b.co', password: 'password1' })

    expect(await apiWith(response(409, { error: 'email-taken' })).api.signup({})).toEqual({ ok: false, error: 'email-taken' })
    expect(await apiWith(response(500, 'x')).api.signup({})).toEqual({ ok: false, error: 'server-error' })
    expect(await apiWith(new TypeError('offline')).api.login({})).toEqual({ ok: false, error: 'network' })
  })

  it('save: 병합 결과 / 401 / 연결 안 됨', async () => {
    const { api, calls } = apiWith(response(200, { state: st({ level: 4 }) }))
    expect(await api.save(st())).toEqual({ kind: 'ok', state: st({ level: 4 }) })
    expect(calls[0].method).toBe('PUT')
    expect(calls[0].url).toBe('/api/progress')
    expect(await apiWith(response(401, { error: 'unauthorized' })).api.save(st())).toEqual({ kind: 'unauthorized' })
    expect(await apiWith(new TypeError('x')).api.save(st())).toEqual({ kind: 'unavailable' })
  })
})

/** 서버 흉내: 계정 하나, 진도는 병합 없이 마지막 값만 들고 있는 단순판 + 응답 조절 */
function fakeApi() {
  const f = {
    mode: 'ok',           // 'ok' | 'guest' | 'unavailable'
    email: 'kid@x.com',
    serverState: st(),
    saves: [],
    loginResult: { ok: true },
    async me() {
      if (f.mode === 'ok') return { kind: 'ok', email: f.email, state: structuredClone(f.serverState) }
      return { kind: f.mode }
    },
    async login() { if (f.loginResult.ok) f.mode = 'ok'; return f.loginResult },
    async signup() { if (f.loginResult.ok) f.mode = 'ok'; return f.loginResult },
    async logout() { f.mode = 'guest'; return { ok: true } },
    async save(state) {
      f.saves.push(structuredClone(state))
      if (f.mode === 'ok') { f.serverState = structuredClone(state); return { kind: 'ok', state: structuredClone(state) } }
      if (f.mode === 'guest') return { kind: 'unauthorized' }
      return { kind: 'unavailable' }
    }
  }
  return f
}

describe('createAccount', () => {
  let store, api
  beforeEach(() => { store = new FakeStorage(); api = fakeApi() })

  const make = () => createAccount({ api, store })

  it('처음에는 게스트 진도로 시작한다', () => {
    saveState(st({ level: 7 }), store)
    const account = make()
    expect(account.state.level).toBe(7)
    expect(account.view()).toBeNull()   // 서버 확인 전에는 계정 버튼을 숨긴다
  })

  it('서버가 없으면 계정 버튼을 숨긴 채 게스트로 계속한다', async () => {
    api.mode = 'unavailable'
    const account = make()
    await account.connect()
    expect(account.view()).toBeNull()
  })

  it('서버가 있고 로그인 안 했으면 게스트 버튼', async () => {
    api.mode = 'guest'
    const account = make()
    await account.connect()
    expect(account.view()).toEqual({ kind: 'guest' })
  })

  it('게스트일 때 update 는 기존 게스트 저장소에 쓴다', async () => {
    api.mode = 'guest'
    const account = make()
    await account.connect()
    await account.update(st({ level: 2 }))
    expect(loadState(store).level).toBe(2)
    expect(api.saves).toHaveLength(0)
  })

  it('로그인 → 게스트 진도가 있으면 알려 주고, 합치면 서버에 올리고 게스트 진도를 비운다', async () => {
    api.mode = 'guest'
    saveState(st({ level: 6, setsPlayed: 20, badges: ['first-set', 'streak-3'] }), store)
    api.serverState = st({ level: 2, setsPlayed: 3 })
    const account = make()
    await account.connect()

    const res = await account.signIn('login', { email: 'kid@x.com', password: 'password1' })
    expect(res).toEqual({ ok: true, email: 'kid@x.com', guest: { level: 6, badges: 2 } })

    await account.finishSignIn({ mergeGuest: true })
    expect(account.state).toMatchObject({ level: 6, setsPlayed: 20 })
    expect(api.serverState).toMatchObject({ level: 6, setsPlayed: 20 })
    expect(loadState(store)).toEqual(defaultState())
    expect(account.view()).toEqual({ kind: 'user', email: 'kid@x.com', pending: false, expired: false })
    expect(store.getItem(CURRENT_ACCOUNT_KEY)).toBe('kid@x.com')
  })

  it('합치지 않으면 계정 진도만 쓰고 게스트 진도는 그대로 둔다', async () => {
    api.mode = 'guest'
    saveState(st({ level: 6, setsPlayed: 20 }), store)
    api.serverState = st({ level: 2 })
    const account = make()
    await account.connect()
    await account.signIn('login', {})
    await account.finishSignIn({ mergeGuest: false })
    expect(account.state.level).toBe(2)
    expect(loadState(store).level).toBe(6)
    expect(api.saves).toHaveLength(0)
  })

  it('게스트 진도가 없으면 물어볼 것이 없다', async () => {
    api.mode = 'guest'
    const account = make()
    await account.connect()
    expect((await account.signIn('login', {})).guest).toBeNull()
  })

  it('로그인 실패는 오류 코드를 그대로 돌려준다', async () => {
    api.mode = 'guest'
    api.loginResult = { ok: false, error: 'bad-credentials' }
    const account = make()
    expect(await account.signIn('login', {})).toEqual({ ok: false, error: 'bad-credentials' })
  })

  it('로그인 중 update 는 계정 캐시에 쓰고 서버에 올린다', async () => {
    const account = make()
    await account.signIn('login', {})
    await account.finishSignIn({ mergeGuest: false })
    await account.update(st({ level: 3 }))
    expect(api.serverState.level).toBe(3)
    expect(JSON.parse(store.getItem(ACCOUNT_PREFIX + 'kid@x.com'))).toMatchObject({ dirty: false, state: { level: 3 } })
    expect(loadState(store)).toEqual(defaultState())   // 게스트 진도는 건드리지 않는다
  })

  it('인터넷이 끊기면 저장 대기로 남고, 다시 연결되면 올린다', async () => {
    const account = make()
    await account.signIn('login', {})
    await account.finishSignIn({ mergeGuest: false })
    api.mode = 'unavailable'
    await account.update(st({ level: 4 }))
    expect(account.view().pending).toBe(true)
    api.mode = 'ok'
    await account.retry()
    expect(account.view().pending).toBe(false)
    expect(api.serverState.level).toBe(4)
  })

  it('다시 열면 계정 캐시로 바로 시작하고, 연결되면 저장 대기분을 올린다', async () => {
    const first = make()
    await first.signIn('login', {})
    await first.finishSignIn({ mergeGuest: false })
    api.mode = 'unavailable'
    await first.update(st({ level: 5 }))

    const second = make()
    expect(second.state.level).toBe(5)
    expect(second.view()).toEqual({ kind: 'user', email: 'kid@x.com', pending: true, expired: false })
    api.mode = 'ok'
    await second.connect()
    expect(api.serverState.level).toBe(5)
    expect(second.view().pending).toBe(false)
  })

  it('다른 기기에서 쌓은 진도를 시작할 때 받아 온다', async () => {
    const account = make()
    await account.signIn('login', {})
    await account.finishSignIn({ mergeGuest: false })
    api.serverState = st({ level: 9 })
    const reopened = make()
    await reopened.connect()
    expect(reopened.state.level).toBe(9)
  })

  it('로그인이 만료되면 캐시를 지우지 않고 다시 로그인하면 합쳐 올린다', async () => {
    const account = make()
    await account.signIn('login', {})
    await account.finishSignIn({ mergeGuest: false })
    api.mode = 'guest'
    await account.update(st({ level: 8, setsPlayed: 30 }))
    expect(account.view()).toMatchObject({ kind: 'user', expired: true, pending: true })

    api.serverState = st({ level: 1, perfectSets: 2 })
    const res = await account.signIn('login', {})
    expect(res.guest).toBeNull()   // 만료 상태에서는 게스트 진도를 묻지 않는다
    await account.finishSignIn({ mergeGuest: false })
    expect(api.serverState).toMatchObject({ level: 8, setsPlayed: 30, perfectSets: 2 })
    expect(account.view()).toMatchObject({ expired: false, pending: false })
  })

  it('로그아웃하면 게스트 진도로 돌아가고 계정 캐시를 지운다', async () => {
    saveState(st({ level: 2 }), store)
    const account = make()
    await account.signIn('login', {})
    await account.finishSignIn({ mergeGuest: false })
    await account.update(st({ level: 7 }))
    await account.logout()
    expect(account.state.level).toBe(2)
    expect(account.view()).toEqual({ kind: 'guest' })
    expect(store.getItem(ACCOUNT_PREFIX + 'kid@x.com')).toBeNull()
    expect(store.getItem(CURRENT_ACCOUNT_KEY)).toBeNull()
  })

  it('저장 못 한 진도가 있으면 로그아웃해도 캐시를 남긴다', async () => {
    const account = make()
    await account.signIn('login', {})
    await account.finishSignIn({ mergeGuest: false })
    api.mode = 'unavailable'
    await account.update(st({ level: 7 }))
    await account.logout()
    expect(JSON.parse(store.getItem(ACCOUNT_PREFIX + 'kid@x.com')).dirty).toBe(true)
    expect(store.getItem(CURRENT_ACCOUNT_KEY)).toBeNull()
  })

  it('저장 도중 새로 푼 판이 있어도 잃지 않는다', async () => {
    const account = make()
    await account.signIn('login', {})
    await account.finishSignIn({ mergeGuest: false })
    let release
    const slowSave = api.save
    api.save = (state) => new Promise(resolve => { release = () => resolve(slowSave(state)) })
    const pending = account.update(st({ setsPlayed: 1 }))
    api.save = slowSave
    await account.update(st({ setsPlayed: 2 }))
    release()           // 첫 저장의 응답(setsPlayed 1)이 늦게 도착한다
    await pending
    expect(account.state.setsPlayed).toBe(2)
    expect(account.view().pending).toBe(false)
  })

  it('저장소가 막혀 있어도 예외를 던지지 않는다', async () => {
    const broken = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() { throw new Error('blocked') } }
    const account = createAccount({ api, store: broken })
    expect(account.state).toEqual(defaultState())
    await account.signIn('login', {})
    await expect(account.finishSignIn({ mergeGuest: false })).resolves.not.toThrow()
  })

  it('STORAGE_KEY 와 계정 키가 겹치지 않는다', () => {
    expect(ACCOUNT_PREFIX.startsWith(STORAGE_KEY)).toBe(true)
    expect(ACCOUNT_PREFIX).not.toBe(STORAGE_KEY)
  })
})
