import { normalizeEmail, isValidEmail, checkPassword } from '../../core/credentials.js'
import { escapeHtml } from '../escape.js'

const MESSAGES = {
  'invalid-email': '이메일 형식이 아니에요',
  'weak-password': '비밀번호는 8자 이상이어야 해요',
  'password-mismatch': '비밀번호가 서로 달라요',
  'bad-invite': '초대 코드가 맞지 않아요',
  'email-taken': '이미 가입된 이메일이에요',
  'bad-credentials': '이메일이나 비밀번호가 맞지 않아요',
  'too-many-attempts': '너무 많이 틀렸어요. 15분 뒤에 다시 해 주세요',
  network: '인터넷 연결을 확인해 주세요'
}

export function errorMessage(code) {
  return MESSAGES[code] ?? '잠시 뒤에 다시 해 주세요'
}

/** 서버에 보내기 전에 알 수 있는 오류. 로그인은 비밀번호 규칙을 따지지 않는다(예전 비밀번호일 수도 있다) */
function localError(mode, fields) {
  if (!isValidEmail(fields.email)) return 'invalid-email'
  if (mode === 'login') return null
  if (checkPassword(fields.password) !== 'ok') return 'weak-password'
  if (fields.password !== fields.confirm) return 'password-mismatch'
  if (!fields.inviteCode) return 'bad-invite'
  return null
}

const field = (id, label, type, autocomplete, value = '') => `
  <label class="account-field" for="${id}">
    <span>${label}</span>
    <input id="${id}" type="${type}" autocomplete="${autocomplete}" value="${escapeHtml(value)}"
      ${type === 'email' ? 'inputmode="email" autocapitalize="off" spellcheck="false"' : ''}>
  </label>`

/**
 * 로그인 / 가입 화면.
 * onSubmit(mode, fields) 는 성공하면 null, 실패하면 오류 코드를 돌려주는 Promise.
 * 성공 뒤 다음 화면으로 넘기는 일은 onSubmit 쪽(app.js)이 한다.
 */
export function renderAccount(container, { mode = 'login', email = '', onSubmit, onBack }) {
  const isSignup = mode === 'signup'

  container.innerHTML = `
    <div class="account">
      <h2 class="account-title">${isSignup ? '가입하기' : '로그인'}</h2>
      <p class="account-lead">로그인하면 어느 컴퓨터에서든 내 카피바라를 이어서 키울 수 있어요.</p>
      <div class="account-tabs" role="tablist">
        <button type="button" role="tab" id="tab-login" class="account-tab ${isSignup ? '' : 'is-active'}"
          aria-selected="${!isSignup}">로그인</button>
        <button type="button" role="tab" id="tab-signup" class="account-tab ${isSignup ? 'is-active' : ''}"
          aria-selected="${isSignup}">가입</button>
      </div>
      <form id="account-form" class="account-form" novalidate>
        ${field('account-email', '이메일', 'email', 'username', email)}
        ${field('account-password', isSignup ? '비밀번호 (8자 이상)' : '비밀번호', 'password',
          isSignup ? 'new-password' : 'current-password')}
        ${isSignup ? field('account-confirm', '비밀번호 확인', 'password', 'new-password') : ''}
        ${isSignup ? field('account-invite', '초대 코드', 'text', 'off') : ''}
        <p id="account-error" class="account-error" role="alert"></p>
        <button type="submit" id="account-submit" class="btn-primary">${isSignup ? '가입하기' : '로그인'}</button>
      </form>
      <button type="button" id="account-back" class="btn-ghost account-back">집으로</button>
    </div>`

  const $ = (id) => container.querySelector(`#${id}`)
  const errorBox = $('account-error')
  const submit = $('account-submit')
  let busy = false

  const switchTo = (next) => renderAccount(container, { mode: next, email: $('account-email').value, onSubmit, onBack })
  $('tab-login').addEventListener('click', () => { if (!busy && isSignup) switchTo('login') })
  $('tab-signup').addEventListener('click', () => { if (!busy && !isSignup) switchTo('signup') })
  $('account-back').addEventListener('click', () => { if (!busy) onBack() })

  $('account-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    if (busy) return
    const fields = {
      email: normalizeEmail($('account-email').value),
      password: $('account-password').value
    }
    if (isSignup) {
      fields.confirm = $('account-confirm').value
      fields.inviteCode = $('account-invite').value.trim()
    }
    const local = localError(mode, fields)
    if (local) { errorBox.textContent = errorMessage(local); return }

    const { confirm, ...payload } = fields
    busy = true
    submit.disabled = true
    errorBox.textContent = ''
    const error = await onSubmit(mode, payload)
    busy = false
    submit.disabled = false
    if (error) errorBox.textContent = errorMessage(error)
  })

  $('account-email').focus?.()
}

/** 로그인 직후, 이 기기의 게스트 진도를 계정에 합칠지 묻는다 */
export function renderMergePrompt(container, { level, badges }, { onMerge, onSkip }) {
  container.innerHTML = `
    <div class="account">
      <h2 class="account-title">진도를 합칠까요?</h2>
      <p class="account-lead">이 기기에서 쌓은 진도(Lv.${level}, 배지 ${badges}개)를 계정에 합칠까요?</p>
      <p class="account-note">합치면 두 진도 중 더 많이 한 쪽이 항목마다 남아요. 줄어드는 건 없어요.</p>
      <button type="button" id="merge-yes" class="btn-primary">합치기</button>
      <button type="button" id="merge-no" class="btn-ghost account-back">합치지 않기</button>
    </div>`
  let done = false
  const once = (fn) => () => { if (done) return; done = true; fn() }
  container.querySelector('#merge-yes').addEventListener('click', once(onMerge))
  container.querySelector('#merge-no').addEventListener('click', once(onSkip))
}
