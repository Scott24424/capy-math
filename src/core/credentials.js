// 가입·로그인 입력 검사. 브라우저(즉시 안내)와 서버(최종 판정)가 같은 규칙을 쓴다.

export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 128
const MAX_EMAIL_LENGTH = 254

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/** x@y.z 수준만 본다 — 진짜 주소인지는 메일을 보내지 않는 한 알 수 없다 */
export function isValidEmail(value) {
  if (typeof value !== 'string' || value.length > MAX_EMAIL_LENGTH) return false
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value)
}

/** 'ok' | 'too-short' | 'too-long' */
export function checkPassword(value) {
  if (typeof value !== 'string') return 'too-short'
  const length = [...value].length
  if (length < MIN_PASSWORD_LENGTH) return 'too-short'
  if (length > MAX_PASSWORD_LENGTH) return 'too-long'
  return 'ok'
}
