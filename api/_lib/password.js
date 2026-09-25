import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto'

const KEY_LENGTH = 64
const PARAMS = { N: 16384, r: 8, p: 1 }

function derive(password, salt) {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFC'), salt, KEY_LENGTH, PARAMS, (err, key) => (err ? reject(err) : resolve(key)))
  })
}

/** { salt, hash } — 둘 다 hex 문자열 */
export async function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = await derive(password, salt)
  return { salt: salt.toString('hex'), hash: hash.toString('hex') }
}

export async function verifyPassword(password, { salt, hash }) {
  const expected = Buffer.from(hash, 'hex')
  const actual = await derive(password, Buffer.from(salt, 'hex'))
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

/** 없는 계정에도 해시 한 번만큼 시간을 쓴다 — 응답 시간으로 가입 여부가 드러나지 않게 */
export async function burnPasswordTime(password) {
  await derive(typeof password === 'string' ? password : '', Buffer.alloc(16))
}

/** 길이가 달라도 시간 차이가 나지 않게 해시끼리 비교한다 */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb) && a.length === b.length
}
