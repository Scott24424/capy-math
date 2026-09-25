import { STORAGE_KEY, defaultState, loadState, saveState, validateState } from './storage.js'
import { mergeStates } from './core/merge.js'

// 계정 진도 동기화. 화면은 모르고, 서버(api)와 기기 저장소(store)만 안다.
//
// 기기 저장:
//   capy-math-v1                      게스트 진도 (예전 그대로)
//   capy-math-v1:account:<이메일>      { state, dirty } — 계정 진도 사본
//   capy-math-v1:current-account      지금 로그인한 이메일
// dirty 는 "서버에 아직 못 올렸다"는 표시다. 인터넷이 끊겨도 아이는 계속 풀고,
// 연결되면 올린다. 서버는 받은 진도를 병합하므로 여러 번 올려도 줄지 않는다.

export const ACCOUNT_PREFIX = `${STORAGE_KEY}:account:`
export const CURRENT_ACCOUNT_KEY = `${STORAGE_KEY}:current-account`

export function createApi(fetchImpl = (...args) => globalThis.fetch(...args)) {
  const call = async (method, path, body) => {
    let res
    try {
      res = await fetchImpl(path, {
        method,
        credentials: 'same-origin',
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
      })
    } catch {
      return { status: 0, data: null }
    }
    let data = null
    try { data = await res.json() } catch { /* HTML 404 등 */ }
    return { status: res.status, data }
  }

  const credentialCall = async (path, fields) => {
    const r = await call('POST', path, fields)
    if (r.status === 200 || r.status === 201) return { ok: true }
    if (r.status === 0) return { ok: false, error: 'network' }
    return { ok: false, error: typeof r.data?.error === 'string' ? r.data.error : 'server-error' }
  }

  return {
    async me() {
      const r = await call('GET', '/api/progress')
      if (r.status === 200 && typeof r.data?.email === 'string') {
        const state = validateState(r.data.state)
        if (state) return { kind: 'ok', email: r.data.email, state }
      }
      // 다른 곳(GitHub Pages 등)의 401 과 헷갈리지 않게 우리 서버의 오류 모양까지 본다
      if (r.status === 401 && r.data?.error === 'unauthorized') return { kind: 'guest' }
      return { kind: 'unavailable' }
    },
    signup: (fields) => credentialCall('/api/signup', fields),
    login: (fields) => credentialCall('/api/login', fields),
    logout: () => call('POST', '/api/logout'),
    async save(state) {
      const r = await call('PUT', '/api/progress', { state })
      if (r.status === 200) {
        const merged = validateState(r.data?.state)
        if (merged) return { kind: 'ok', state: merged }
      }
      if (r.status === 401 && r.data?.error === 'unauthorized') return { kind: 'unauthorized' }
      return { kind: 'unavailable' }
    }
  }
}

// --- 기기 저장소 (막혀 있어도 예외를 던지지 않는다) ---

const safeGet = (store, key) => { try { return store?.getItem(key) ?? null } catch { return null } }
const safeSet = (store, key, value) => { try { store?.setItem(key, value) } catch { /* 저장 불가 */ } }
const safeRemove = (store, key) => { try { store?.removeItem(key) } catch { /* 저장 불가 */ } }

function readCache(store, email) {
  try {
    const parsed = JSON.parse(safeGet(store, ACCOUNT_PREFIX + email))
    const state = validateState(parsed?.state)
    return state ? { state, dirty: parsed.dirty === true } : null
  } catch {
    return null
  }
}

const writeCache = (store, email, state, dirty) =>
  safeSet(store, ACCOUNT_PREFIX + email, JSON.stringify({ state, dirty }))

/**
 * 지금 쓰는 진도(state)와 계정 상태를 들고 있는 객체.
 * 앱은 account.state 를 읽고, 바꿀 때는 account.update(새 state) 를 부른다.
 * onChange 는 서버 응답으로 표시할 것(저장 대기 등)이 바뀌었을 때 불린다.
 */
export function createAccount({ api, store = globalThis.localStorage, onChange = () => {} }) {
  let email = safeGet(store, CURRENT_ACCOUNT_KEY)
  const cached = email ? readCache(store, email) : null
  if (!cached) email = null

  let state = cached ? cached.state : loadState(store)
  let dirty = cached?.dirty ?? false
  let expired = false
  let available = false
  let seq = 0
  let signingIn = null

  const persistLocal = () => {
    if (email) writeCache(store, email, state, dirty)
    else saveState(state, store)
  }

  async function push() {
    if (!email || expired) return
    const my = ++seq
    const sentFor = email
    const res = await api.save(state)
    if (email !== sentFor) return   // 기다리는 사이 로그아웃했다
    if (res.kind === 'ok') {
      available = true
      state = mergeStates(state, res.state)   // 기다리는 사이 새로 푼 판을 잃지 않는다
      if (my === seq) dirty = false
    } else if (res.kind === 'unauthorized') {
      available = true
      expired = true
    }
    persistLocal()
    onChange()
  }

  return {
    get state() { return state },

    /** null(계정 버튼 숨김) | { kind: 'guest' } | { kind: 'user', email, pending, expired } */
    view() {
      if (email) return { kind: 'user', email, pending: dirty, expired }
      return available ? { kind: 'guest' } : null
    },

    /** 앱을 열 때 한 번. 서버가 있는지, 로그인이 살아 있는지 확인하고 진도를 맞춘다 */
    async connect() {
      const me = await api.me()
      if (me.kind === 'unavailable') return
      available = true
      if (me.kind === 'guest') {
        if (email) expired = true
        onChange()
        return
      }
      if (email !== me.email) {
        // 이 기기가 기억하는 계정과 쿠키의 계정이 다르다 — 쿠키(서버)를 따른다.
        // 원래 계정의 사본은 지우지 않고 남겨 두어, 그 계정으로 다시 들어오면 올린다.
        email = me.email
        const own = readCache(store, email)
        state = own ? own.state : defaultState()
        dirty = own?.dirty ?? false
        safeSet(store, CURRENT_ACCOUNT_KEY, email)
      }
      expired = false
      state = mergeStates(me.state, state)
      persistLocal()
      if (dirty) await push()
      else onChange()
    },

    /**
     * 서버에 가입/로그인만 한다. 성공하면 게스트 진도가 있는지(합칠지 물어볼 거리)를
     * 알려 주고, 앱이 물어본 뒤 finishSignIn 으로 마무리한다.
     */
    async signIn(mode, fields) {
      const res = mode === 'signup' ? await api.signup(fields) : await api.login(fields)
      if (!res.ok) return res
      const me = await api.me()
      if (me.kind !== 'ok') return { ok: false, error: me.kind === 'unavailable' ? 'network' : 'server-error' }
      available = true
      signingIn = me
      let guest = null
      if (!email) {
        const g = loadState(store)
        if (g.setsPlayed > 0) guest = { level: g.level, badges: g.badges.length }
      }
      return { ok: true, email: me.email, guest }
    },

    async finishSignIn({ mergeGuest }) {
      const me = signingIn
      signingIn = null
      if (!me) return
      const parts = [me.state]
      const own = readCache(store, me.email)
      if (own) parts.push(own.state)
      // 만료된 채로 쓰던 같은 계정의 진도(아직 캐시에 있는 것과 같다)도 합친다
      if (email === me.email) parts.push(state)
      if (mergeGuest) parts.push(loadState(store))

      email = me.email
      expired = false
      state = parts.reduce(mergeStates)
      dirty = parts.length > 1
      safeSet(store, CURRENT_ACCOUNT_KEY, email)
      persistLocal()
      if (mergeGuest) saveState(defaultState(), store)
      if (dirty) await push()
      else onChange()
    },

    async update(next) {
      state = next
      if (!email) { persistLocal(); return }
      dirty = true
      persistLocal()
      await push()
    },

    /** 인터넷이 다시 연결됐을 때 등 — 못 올린 것이 있으면 올린다 */
    async retry() {
      if (email && dirty && !expired) await push()
    },

    async logout() {
      if (email && dirty && !expired) await push()
      await api.logout()
      if (email && !dirty) safeRemove(store, ACCOUNT_PREFIX + email)
      safeRemove(store, CURRENT_ACCOUNT_KEY)
      email = null
      expired = false
      dirty = false
      state = loadState(store)
      onChange()
    }
  }
}
