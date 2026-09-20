import { describe, it, expect } from 'vitest'
import { createSession, currentCell, submit, sessionResults } from '../src/core/session.js'

const problems = [
  { id: '47x3', category: 'two-by-one', difficulty: 'normal', a: 47, b: 3 },
  { id: '7x8', category: 'times-table', difficulty: 'normal', a: 7, b: 8 }
]

describe('createSession', () => {
  it('첫 문제의 첫 칸에서 시작한다', () => {
    const s = createSession(problems)
    expect(s.index).toBe(0)
    expect(currentCell(s).id).toBe('p0-c0')
  })
})

describe('submit', () => {
  it('맞히면 다음 칸으로 넘어간다', () => {
    const s = createSession(problems)
    const r = submit(s, 1)              // 7×3=21 → 1
    expect(r.correct).toBe(true)
    expect(r.problemDone).toBe(false)
    expect(currentCell(s).kind).toBe('carry')
  })

  it('칸을 다 채우면 문제가 끝난다', () => {
    const s = createSession(problems)
    for (const v of [1, 2, 4, 1]) submit(s, v)
    expect(s.index).toBe(1)
    expect(sessionResults(s)[0]).toMatchObject({ problemId: '47x3', correct: true, usedHint: false })
  })

  it('한 칸에서 두 번 틀리면 정답이 채워지고 다음 칸으로 간다', () => {
    const s = createSession(problems)
    expect(submit(s, 9).reveal).toBe(false)
    const second = submit(s, 8)
    expect(second.reveal).toBe(true)
    expect(currentCell(s).kind).toBe('carry')
    expect(s.filled['p0-c0']).toBe(1)     // 정답이 대신 채워졌다
  })

  it('한 칸이라도 공개된 문제는 오답이고 힌트를 쓴 것으로 남는다', () => {
    const s = createSession(problems)
    submit(s, 9); submit(s, 8)            // 첫 칸 공개
    for (const v of [2, 4, 1]) submit(s, v)
    expect(sessionResults(s)[0]).toMatchObject({ correct: false, usedHint: true })
  })

  it('첫 시도에 틀렸다가 두 번째에 맞히면 오답이지만 힌트는 안 쓴 것이다', () => {
    const s = createSession(problems)
    submit(s, 9)
    submit(s, 1)
    for (const v of [2, 4, 1]) submit(s, v)
    expect(sessionResults(s)[0]).toMatchObject({ correct: false, usedHint: false })
  })

  it('구구단은 한 칸으로 끝난다', () => {
    const s = createSession([problems[1]])
    const r = submit(s, 56)
    expect(r.correct).toBe(true)
    expect(r.problemDone).toBe(true)
    expect(r.setDone).toBe(true)
  })

  it('마지막 문제를 끝내면 세트가 끝난다', () => {
    const s = createSession(problems)
    for (const v of [1, 2, 4, 1]) submit(s, v)
    const last = submit(s, 56)
    expect(last.setDone).toBe(true)
    expect(currentCell(s)).toBeNull()
  })

  it('세트가 끝난 뒤 더 넣어도 터지지 않는다', () => {
    const s = createSession([problems[1]])
    submit(s, 56)
    expect(() => submit(s, 3)).not.toThrow()
  })

  it('복습 표시가 결과까지 따라간다', () => {
    const s = createSession([{ ...problems[1], isReview: true }])
    submit(s, 56)
    expect(sessionResults(s)[0].isReview).toBe(true)
  })
})
