import { describe, it, expect, vi } from 'vitest'
import { renderAccount, renderMergePrompt, errorMessage } from '../src/ui/screens/account.js'
import { escapeHtml } from '../src/ui/escape.js'
import { accountBarHtml } from '../src/ui/screens/home.js'

// 다른 화면 테스트처럼 jsdom 없이, 이 화면이 쓰는 만큼만 흉내 낸다.
class FakeElement {
  constructor() {
    this._innerHTML = ''
    this._children = new Map()
    this._listeners = {}
    this.value = ''
    this.textContent = ''
    this.disabled = false
  }
  set innerHTML(html) {
    this._innerHTML = html
    this._children = new Map()
    const re = /id="([^"]+)"/g
    let m
    while ((m = re.exec(html))) this._children.set(m[1], new FakeElement())
  }
  get innerHTML() { return this._innerHTML }
  querySelector(sel) { return sel.startsWith('#') ? this._children.get(sel.slice(1)) ?? null : null }
  focus() {}
  addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn) }
  fire(type, event = {}) {
    const e = { preventDefault() {}, ...event }
    return Promise.all((this._listeners[type] || []).map(fn => fn(e)))
  }
}

const $ = (container, id) => container.querySelector(`#${id}`)

function fill(container, fields) {
  for (const [id, value] of Object.entries(fields)) $(container, id).value = value
}

describe('errorMessage', () => {
  it.each([
    ['invalid-email', '이메일 형식이 아니에요'],
    ['weak-password', '비밀번호는 8자 이상이어야 해요'],
    ['password-mismatch', '비밀번호가 서로 달라요'],
    ['bad-invite', '초대 코드가 맞지 않아요'],
    ['email-taken', '이미 가입된 이메일이에요'],
    ['bad-credentials', '이메일이나 비밀번호가 맞지 않아요'],
    ['too-many-attempts', '너무 많이 틀렸어요. 15분 뒤에 다시 해 주세요'],
    ['network', '인터넷 연결을 확인해 주세요'],
    ['anything-else', '잠시 뒤에 다시 해 주세요']
  ])('%s', (code, text) => expect(errorMessage(code)).toBe(text))
})

describe('escapeHtml', () => {
  it('HTML 특수문자를 바꾼다', () => {
    expect(escapeHtml(`<b a="1">'&`)).toBe('&lt;b a=&quot;1&quot;&gt;&#39;&amp;')
  })
})

describe('renderAccount', () => {
  it('로그인 탭에는 이메일·비밀번호만, 가입 탭에는 확인·초대 코드까지', () => {
    const c = new FakeElement()
    renderAccount(c, { mode: 'login', onSubmit: vi.fn(), onBack: vi.fn() })
    expect($(c, 'account-email')).not.toBeNull()
    expect($(c, 'account-password')).not.toBeNull()
    expect($(c, 'account-confirm')).toBeNull()
    expect($(c, 'account-invite')).toBeNull()
    renderAccount(c, { mode: 'signup', onSubmit: vi.fn(), onBack: vi.fn() })
    expect($(c, 'account-confirm')).not.toBeNull()
    expect($(c, 'account-invite')).not.toBeNull()
  })

  it('탭을 누르면 다른 모드로 다시 그린다', async () => {
    const c = new FakeElement()
    renderAccount(c, { mode: 'login', onSubmit: vi.fn(), onBack: vi.fn() })
    await $(c, 'tab-signup').fire('click')
    expect($(c, 'account-invite')).not.toBeNull()
  })

  it('입력이 틀리면 서버에 보내지 않고 바로 알려 준다', async () => {
    const c = new FakeElement()
    const onSubmit = vi.fn()
    renderAccount(c, { mode: 'signup', onSubmit, onBack: vi.fn() })

    fill(c, { 'account-email': 'nope', 'account-password': 'password1', 'account-confirm': 'password1', 'account-invite': 'x' })
    await $(c, 'account-form').fire('submit')
    expect($(c, 'account-error').textContent).toBe('이메일 형식이 아니에요')

    fill(c, { 'account-email': 'a@b.co', 'account-password': 'short' })
    await $(c, 'account-form').fire('submit')
    expect($(c, 'account-error').textContent).toBe('비밀번호는 8자 이상이어야 해요')

    fill(c, { 'account-password': 'password1', 'account-confirm': 'password2' })
    await $(c, 'account-form').fire('submit')
    expect($(c, 'account-error').textContent).toBe('비밀번호가 서로 달라요')

    fill(c, { 'account-confirm': 'password1', 'account-invite': '  ' })
    await $(c, 'account-form').fire('submit')
    expect($(c, 'account-error').textContent).toBe('초대 코드가 맞지 않아요')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('맞게 넣으면 보내고, 서버 오류를 한국어로 보여 준다', async () => {
    const c = new FakeElement()
    const onSubmit = vi.fn(async () => 'email-taken')
    renderAccount(c, { mode: 'signup', onSubmit, onBack: vi.fn() })
    fill(c, {
      'account-email': ' Kid@X.com ', 'account-password': 'password1',
      'account-confirm': 'password1', 'account-invite': ' family '
    })
    await $(c, 'account-form').fire('submit')
    expect(onSubmit).toHaveBeenCalledWith('signup', { email: 'kid@x.com', password: 'password1', inviteCode: 'family' })
    expect($(c, 'account-error').textContent).toBe('이미 가입된 이메일이에요')
    expect($(c, 'account-submit').disabled).toBe(false)
  })

  it('로그인은 비밀번호 길이를 따지지 않고 서버에 맡긴다', async () => {
    const c = new FakeElement()
    const onSubmit = vi.fn(async () => null)
    renderAccount(c, { mode: 'login', onSubmit, onBack: vi.fn() })
    fill(c, { 'account-email': 'a@b.co', 'account-password': 'x' })
    await $(c, 'account-form').fire('submit')
    expect(onSubmit).toHaveBeenCalledWith('login', { email: 'a@b.co', password: 'x' })
  })

  it('보내는 동안 버튼을 잠가 두 번 보내지 않는다', async () => {
    const c = new FakeElement()
    let finish
    const onSubmit = vi.fn(() => new Promise(r => { finish = r }))
    renderAccount(c, { mode: 'login', onSubmit, onBack: vi.fn() })
    fill(c, { 'account-email': 'a@b.co', 'account-password': 'password1' })
    const first = $(c, 'account-form').fire('submit')
    expect($(c, 'account-submit').disabled).toBe(true)
    await $(c, 'account-form').fire('submit')
    expect(onSubmit).toHaveBeenCalledTimes(1)
    finish('bad-credentials')
    await first
    expect($(c, 'account-error').textContent).toBe('이메일이나 비밀번호가 맞지 않아요')
  })

  it('뒤로 가기', async () => {
    const c = new FakeElement()
    const onBack = vi.fn()
    renderAccount(c, { mode: 'login', onSubmit: vi.fn(), onBack })
    await $(c, 'account-back').fire('click')
    expect(onBack).toHaveBeenCalled()
  })
})

describe('renderMergePrompt', () => {
  it('게스트 진도를 알려 주고 두 가지 선택지를 준다', async () => {
    const c = new FakeElement()
    const onMerge = vi.fn(); const onSkip = vi.fn()
    renderMergePrompt(c, { level: 6, badges: 3 }, { onMerge, onSkip })
    expect(c.innerHTML).toContain('Lv.6')
    expect(c.innerHTML).toContain('배지 3개')
    await $(c, 'merge-yes').fire('click')
    expect(onMerge).toHaveBeenCalledTimes(1)
    // 두 번 누르거나 다른 버튼을 이어 눌러도 한 번만 처리한다
    await $(c, 'merge-yes').fire('click')
    await $(c, 'merge-no').fire('click')
    expect(onMerge).toHaveBeenCalledTimes(1)
    expect(onSkip).not.toHaveBeenCalled()

    renderMergePrompt(c, { level: 1, badges: 0 }, { onMerge, onSkip })
    await $(c, 'merge-no').fire('click')
    expect(onSkip).toHaveBeenCalledTimes(1)
  })
})

describe('accountBarHtml', () => {
  it('서버가 없으면 아무것도 없다', () => {
    expect(accountBarHtml(null)).toBe('')
  })
  it('게스트는 로그인 버튼', () => {
    const html = accountBarHtml({ kind: 'guest' })
    expect(html).toContain('id="account-login"')
    expect(html).not.toContain('account-logout')
  })
  it('로그인 중이면 이메일 앞부분과 로그아웃, 이메일은 이스케이프한다', () => {
    const html = accountBarHtml({ kind: 'user', email: '<kid>@x.com', pending: false, expired: false })
    expect(html).toContain('&lt;kid&gt;')
    expect(html).not.toContain('<kid>')
    expect(html).toContain('id="account-logout"')
    expect(html).not.toContain('sync-note')
  })
  it('저장 대기 / 만료 안내', () => {
    expect(accountBarHtml({ kind: 'user', email: 'a@b.co', pending: true, expired: false }))
      .toContain('아직 계정에 저장 안 됐어요 — 인터넷이 되면 자동으로 저장돼요')
    const expired = accountBarHtml({ kind: 'user', email: 'a@b.co', pending: true, expired: true })
    expect(expired).toContain('다시 로그인')
    expect(expired).toContain('id="account-login"')
    expect(expired).not.toContain('인터넷이 되면')
  })
})
