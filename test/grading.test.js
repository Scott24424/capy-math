import { describe, it, expect } from 'vitest'
import { judgeCell, summarize, MAX_ATTEMPTS } from '../src/core/grading.js'

const cell = { id: 'p0-c0', kind: 'product', value: 2, hint: '7 × 6 = 42예요' }

describe('judgeCell', () => {
  it('맞으면 정답으로 처리하고 아무 말도 하지 않는다', () => {
    expect(judgeCell(cell, 2, 0)).toEqual({ correct: true, reveal: false, message: '' })
  })

  it('숫자를 문자열로 넣어도 맞게 처리한다', () => {
    expect(judgeCell(cell, '2', 0).correct).toBe(true)
  })

  it('처음 틀리면 다시 해보라고 한다', () => {
    const r = judgeCell(cell, 5, 0)
    expect(r.correct).toBe(false)
    expect(r.reveal).toBe(false)
    expect(r.message).toContain('다시')
  })

  it('두 번째로 틀리면 정답을 알려주고 넘어간다', () => {
    const r = judgeCell(cell, 5, 1)
    expect(r.correct).toBe(false)
    expect(r.reveal).toBe(true)
    expect(r.message).toContain('7 × 6 = 42예요')
  })

  it('시도 상한은 2회다', () => {
    expect(MAX_ATTEMPTS).toBe(2)
  })

  it('빈 입력은 틀린 것으로 보되 시도 횟수를 쓰지 않는다', () => {
    const r = judgeCell(cell, '', 0)
    expect(r.correct).toBe(false)
    expect(r.reveal).toBe(false)
  })

  it('구구단처럼 여러 자리 답도 통째로 비교한다', () => {
    const ans = { id: 'answer', kind: 'answer', value: 56, hint: '7 × 8 = 56이에요' }
    expect(judgeCell(ans, 56, 0).correct).toBe(true)
    expect(judgeCell(ans, 5, 0).correct).toBe(false)
  })
})

describe('summarize', () => {
  const results = [
    { problemId: '47x3', correct: true, usedHint: false },
    { problemId: '78x9', correct: false, usedHint: true },
    { problemId: '23x4', correct: true, usedHint: false }
  ]

  it('맞은 개수와 정확도를 센다', () => {
    const s = summarize(results, 192000)
    expect(s).toEqual({
      total: 3, correct: 2, wrong: 1,
      accuracy: 2 / 3, elapsedMs: 192000, allCorrect: false
    })
  })

  it('전부 맞으면 allCorrect 가 참이다', () => {
    const all = results.map(r => ({ ...r, correct: true }))
    expect(summarize(all, 1000).allCorrect).toBe(true)
  })

  it('빈 결과에서도 터지지 않는다', () => {
    expect(summarize([], 0)).toEqual({
      total: 0, correct: 0, wrong: 0, accuracy: 0, elapsedMs: 0, allCorrect: false
    })
  })
})
