import { describe, it, expect } from 'vitest'
import {
  normalizeEmail, isValidEmail, checkPassword,
  MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH
} from '../src/core/credentials.js'

describe('normalizeEmail', () => {
  it('앞뒤 공백을 지우고 소문자로 바꾼다', () => {
    expect(normalizeEmail('  Mom@Example.COM ')).toBe('mom@example.com')
  })
  it('문자열이 아니면 빈 문자열', () => {
    expect(normalizeEmail(undefined)).toBe('')
    expect(normalizeEmail(42)).toBe('')
  })
})

describe('isValidEmail', () => {
  it.each(['a@b.co', 'kid.one+math@naver.com', 'x_y@sub.domain.kr'])('%s 는 맞다', (e) => {
    expect(isValidEmail(e)).toBe(true)
  })
  it.each(['', 'abc', 'a@b', '@b.com', 'a@.com', 'a b@c.com', 'a@b.c ', 'a@@b.com'])('%j 는 틀리다', (e) => {
    expect(isValidEmail(e)).toBe(false)
  })
  it('254자를 넘으면 틀리다', () => {
    expect(isValidEmail('a'.repeat(250) + '@b.co')).toBe(false)
  })
})

describe('checkPassword', () => {
  it('8자 이상이면 ok', () => {
    expect(checkPassword('12345678')).toBe('ok')
    expect(checkPassword('한글비밀번호입니다')).toBe('ok')
  })
  it('8자 미만이면 too-short', () => {
    expect(checkPassword('1234567')).toBe('too-short')
    expect(checkPassword('')).toBe('too-short')
  })
  it('너무 길면 too-long', () => {
    expect(checkPassword('a'.repeat(MAX_PASSWORD_LENGTH + 1))).toBe('too-long')
  })
  it('문자열이 아니면 too-short', () => {
    expect(checkPassword(null)).toBe('too-short')
  })
  it('최소 길이는 8', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8)
  })
})
