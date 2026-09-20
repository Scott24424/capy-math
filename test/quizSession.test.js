import { describe, it, expect, vi } from 'vitest'
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

  it('빈 제출은 시도 횟수를 쓰지 않아, 그 다음 진짜 오답이 바로 공개되지 않는다', () => {
    const s = createSession(problems)
    submit(s, '')     // 빈 제출 1 — 숫자를 누르지 않음
    submit(s, 'abc')  // 빈 제출 2 — 숫자가 아님
    const r = submit(s, 9)   // 이제야 첫 번째 진짜 오답
    expect(r.correct).toBe(false)
    expect(r.reveal).toBe(false)
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

  it('completedOnly: 아직 끝나지 않은 문제(지금 푸는 중이거나 손도 안 댄 문제)는 뺀다', () => {
    const s = createSession(problems) // 47x3(2자리x1자리, 칸 4개: 1,2,4,1), 7x8(구구단)
    for (const v of [1, 2, 4, 1]) submit(s, v)   // 47x3 을 다 끝낸다
    expect(sessionResults(s, { completedOnly: true })).toHaveLength(1)
    expect(sessionResults(s, { completedOnly: true })[0].problemId).toBe('47x3')
    // 옵션을 안 주면(기본값) 여전히 손도 안 댄 두 번째 문제까지 전부 돌려준다 — 기존 동작 유지
    expect(sessionResults(s)).toHaveLength(2)
  })

  it('completedOnly: 아무 문제도 못 끝냈으면 빈 배열이다', () => {
    const s = createSession(problems)
    expect(sessionResults(s, { completedOnly: true })).toEqual([])
  })

  it('completedOnly: 세트를 다 끝내면 옵션이 있든 없든 같은 결과다', () => {
    const s = createSession([problems[1]])
    submit(s, 56)
    expect(sessionResults(s, { completedOnly: true })).toEqual(sessionResults(s))
  })

  it('빈 입력 메시지 문구가 바뀌어도 시도 횟수는 여전히 소모되지 않는다', async () => {
    // grading.js 의 안내 문구를 다른 것으로 바꿔치기해도, session.js 는
    // verdict.blank 구조적 필드만 보고 판단하므로 계약이 깨지지 않아야 한다.
    vi.resetModules()
    vi.doMock('../src/core/grading.js', async () => {
      const actual = await vi.importActual('../src/core/grading.js')
      return {
        ...actual,
        judgeCell: (cell, input, attemptsSoFar) => {
          const verdict = actual.judgeCell(cell, input, attemptsSoFar)
          return verdict.blank ? { ...verdict, message: '숫자를 눌러 주세요' } : verdict
        }
      }
    })
    const { createSession: freshCreateSession, submit: freshSubmit } =
      await import('../src/core/session.js')

    const s = freshCreateSession(problems)
    freshSubmit(s, '')     // 빈 제출 1 — 문구가 바뀌었다
    freshSubmit(s, 'abc')  // 빈 제출 2
    const r = freshSubmit(s, 9)   // 이제야 첫 번째 진짜 오답이어야 한다
    expect(r.correct).toBe(false)
    expect(r.reveal).toBe(false)

    vi.doUnmock('../src/core/grading.js')
    vi.resetModules()
  })
})
