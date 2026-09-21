import { describe, it, expect } from 'vitest'
import { importFailureMessage } from '../src/ui/screens/records.js'

// 진도 불러오기 실패 안내문. GitHub Pages 에서는 "화면이 캐시돼 예전 버전"이
// 흔한 일이라, "더 새 파일"과 "더 오래된 파일"은 서 있는 사람에게 서로 다른
// 말을 해야 한다 — 하나는 새로고침하면 풀리고, 하나는 안 풀린다.
describe('importFailureMessage', () => {
  it('더 새로운 버전에서 온 파일이면 새로고침을 안내한다', () => {
    const msg = importFailureMessage('wrong-version-newer')
    expect(msg).toContain('새로고침')
    expect(msg).not.toContain('어른')
  })

  it('더 오래된 버전에서 온 파일이면 지금은 안 된다고 말하고, 새로고침을 권하지 않는다', () => {
    const msg = importFailureMessage('wrong-version-older')
    expect(msg).not.toContain('새로고침')
    expect(msg).toMatch(/못|없|안/)
  })

  it('그 밖의 이유(파일이 아님/다른 앱 것/구조 손상)는 기존의 공통 안내문을 쓴다', () => {
    const generic = importFailureMessage('not-object')
    expect(importFailureMessage('wrong-kind')).toBe(generic)
    expect(importFailureMessage('invalid-state')).toBe(generic)
    expect(importFailureMessage('아무거나')).toBe(generic)
  })

  it('두 버전 메시지는 서로 다르다', () => {
    expect(importFailureMessage('wrong-version-newer')).not.toBe(importFailureMessage('wrong-version-older'))
  })
})
