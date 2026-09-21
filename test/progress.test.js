import { describe, it, expect } from 'vitest'
import {
  MAX_LEVEL, xpForLevel, problemXp, setBonus, applyXp, updateStreak, earnedBadges, BADGES
} from '../src/core/progress.js'

describe('xpForLevel', () => {
  it('레벨이 오를수록 더 많이 필요하다', () => {
    expect(xpForLevel(1)).toBe(60)
    expect(xpForLevel(2)).toBe(70)
    expect(xpForLevel(49)).toBe(540)
  })

  it('50레벨까지 누적은 14700이다', () => {
    let total = 0
    for (let n = 1; n < MAX_LEVEL; n++) total += xpForLevel(n)
    expect(total).toBe(14700)
  })
})

describe('problemXp', () => {
  it('어려운 카테고리일수록 많이 준다', () => {
    const base = (category, difficulty) => problemXp({ category, difficulty })
    expect(base('times-table', 'easy')).toBe(2)
    expect(base('times-table', 'hard')).toBe(4)
    expect(base('two-by-one', 'normal')).toBe(5)
    expect(base('three-by-one', 'hard')).toBe(10)
    expect(base('two-by-two', 'hard')).toBe(12)
  })

  it('구구단만 반복하는 것보다 두 자리 × 두 자리가 훨씬 값지다', () => {
    expect(problemXp({ category: 'two-by-two', difficulty: 'hard' }))
      .toBeGreaterThan(problemXp({ category: 'times-table', difficulty: 'hard' }) * 2)
  })

  it('복습 문제를 맞히면 1.5배다', () => {
    expect(problemXp({ category: 'two-by-one', difficulty: 'normal', isReview: true })).toBe(8)
  })

  it('힌트로 채워진 칸이 있었으면 절반이다', () => {
    expect(problemXp({ category: 'two-by-two', difficulty: 'hard', usedHint: true })).toBe(6)
  })

  it('복습이면서 힌트를 썼으면 1.5배 후 절반이다', () => {
    expect(problemXp({
      category: 'two-by-two', difficulty: 'hard', isReview: true, usedHint: true
    })).toBe(9)
  })
})

describe('setBonus', () => {
  it('세트를 끝내면 5를 준다', () => {
    expect(setBonus({ allCorrect: false, streakDays: 0 })).toBe(5)
  })

  it('전부 맞으면 10을 더 준다', () => {
    expect(setBonus({ allCorrect: true, streakDays: 0 })).toBe(15)
  })

  it('연속 출석은 하루당 2, 최대 10까지다', () => {
    expect(setBonus({ allCorrect: false, streakDays: 3 })).toBe(11)
    expect(setBonus({ allCorrect: false, streakDays: 30 })).toBe(15)
  })
})

describe('applyXp', () => {
  it('경험치를 더하고 레벨이 오르면 알려준다', () => {
    expect(applyXp({ level: 1, xp: 0 }, 65))
      .toEqual({ level: 2, xp: 5, leveledUp: true, levelsGained: 1 })
  })

  it('한 번에 두 레벨도 오를 수 있다', () => {
    const r = applyXp({ level: 1, xp: 0 }, 60 + 70 + 3)
    expect(r.level).toBe(3)
    expect(r.levelsGained).toBe(2)
  })

  it('모자라면 레벨은 그대로다', () => {
    expect(applyXp({ level: 1, xp: 0 }, 10))
      .toEqual({ level: 1, xp: 10, leveledUp: false, levelsGained: 0 })
  })

  it('50레벨에서는 더 오르지 않고 경험치도 쌓이지 않는다', () => {
    expect(applyXp({ level: 50, xp: 0 }, 9999))
      .toEqual({ level: 50, xp: 0, leveledUp: false, levelsGained: 0 })
  })
})

// Review Focus 2: 연속 출석의 날짜 경계
describe('updateStreak', () => {
  it('처음 플레이하면 1일이다', () => {
    expect(updateStreak({ streakDays: 0, lastPlayedDate: null }, '2026-09-20'))
      .toEqual({ streakDays: 1, lastPlayedDate: '2026-09-20' })
  })

  it('어제 했으면 하루 늘어난다', () => {
    expect(updateStreak({ streakDays: 3, lastPlayedDate: '2026-09-19' }, '2026-09-20'))
      .toEqual({ streakDays: 4, lastPlayedDate: '2026-09-20' })
  })

  it('같은 날 여러 번 해도 더 늘지 않는다', () => {
    expect(updateStreak({ streakDays: 4, lastPlayedDate: '2026-09-20' }, '2026-09-20'))
      .toEqual({ streakDays: 4, lastPlayedDate: '2026-09-20' })
  })

  it('하루 이상 건너뛰면 1일부터 다시 센다', () => {
    expect(updateStreak({ streakDays: 9, lastPlayedDate: '2026-09-17' }, '2026-09-20'))
      .toEqual({ streakDays: 1, lastPlayedDate: '2026-09-20' })
  })

  it('달을 넘어가도 이어진다', () => {
    expect(updateStreak({ streakDays: 2, lastPlayedDate: '2026-08-31' }, '2026-09-01'))
      .toEqual({ streakDays: 3, lastPlayedDate: '2026-09-01' })
  })

  it('기기 시계를 과거로 돌려도 음수나 폭주가 없다', () => {
    const r = updateStreak({ streakDays: 9, lastPlayedDate: '2026-09-20' }, '2026-09-01')
    expect(r.streakDays).toBe(1)
    expect(r.lastPlayedDate).toBe('2026-09-01')
  })
})

describe('earnedBadges', () => {
  const base = {
    setsPlayed: 0, perfectSets: 0, streakDays: 0, level: 1,
    solvedByCategory: {}, verticalSolved: 0, reviewQueue: [], reviewEverHad: false
  }

  it('아무것도 안 했으면 배지가 없다', () => {
    expect(earnedBadges(base)).toEqual([])
  })

  it('첫 세트를 끝내면 배지를 준다', () => {
    expect(earnedBadges({ ...base, setsPlayed: 1 })).toContain('first-set')
  })

  it('첫 만점 배지', () => {
    expect(earnedBadges({ ...base, perfectSets: 1 })).toContain('first-perfect')
  })

  it('연속 출석 배지는 단계별로 쌓인다', () => {
    const b = earnedBadges({ ...base, streakDays: 7 })
    expect(b).toContain('streak-3')
    expect(b).toContain('streak-7')
    expect(b).not.toContain('streak-30')
  })

  it('카테고리별 문제 수 배지', () => {
    const b = earnedBadges({ ...base, solvedByCategory: { 'two-by-one': 100 } })
    expect(b).toContain('two-by-one-100')
    expect(b).not.toContain('two-by-one-500')
  })

  it('복습 주머니를 한 번이라도 채웠다가 비우면 배지를 준다', () => {
    expect(earnedBadges({ ...base, reviewEverHad: true, reviewQueue: [] }))
      .toContain('review-cleared')
    expect(earnedBadges({ ...base, reviewEverHad: true, reviewQueue: [{ id: 'x' }] }))
      .not.toContain('review-cleared')
  })

  it('계열 졸업 배지는 레벨로 판정한다', () => {
    expect(earnedBadges({ ...base, level: 11 })).toContain('series-1')
    expect(earnedBadges({ ...base, level: 50 })).toContain('series-5')
  })

  it('모든 배지 id 에 이름과 설명이 있다', () => {
    const all = earnedBadges({
      ...base, setsPlayed: 1, perfectSets: 1, streakDays: 30, level: 50,
      solvedByCategory: Object.fromEntries(
        ['times-table', 'two-by-one', 'three-by-one', 'two-by-two'].map(c => [c, 500])
      ),
      verticalSolved: 1, reviewEverHad: true, reviewQueue: []
    })
    for (const id of all) {
      expect(BADGES[id]).toBeDefined()
      expect(typeof BADGES[id].label).toBe('string')
      expect(typeof BADGES[id].description).toBe('string')
    }
  })
})
