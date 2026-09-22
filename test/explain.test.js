import { describe, it, expect } from 'vitest'
import { buildVertical, buildAnswerOnly } from '../src/core/vertical.js'
import { explanationSteps } from '../src/ui/screens/explain.js'

describe('explanationSteps', () => {
  it('47 × 36 — 계산이 실제로 벌어지는 순서(자리가 작은 것부터)로 설명한다', () => {
    // vertical.js 의 cells 는 "입력 순서"(두 자리 수가 나오면 십의 자리를 먼저
    // 입력)라, 그 순서를 그대로 쓰면 "28의 십의 자리 2를 그대로 써요"가 "4×6=24,
    // 올린 4를 더하면 28이에요"보다 먼저 나오는 등 앞뒤가 바뀐다.
    // explanationSteps 는 이를 (row, col) 기준으로 다시 정렬해 바로잡는다.
    const v = buildVertical(47, 36)
    expect(explanationSteps(v)).toEqual([
      '7 × 6 = 42예요',
      '4 × 6 = 24, 올린 4를 더하면 28이에요',
      '28의 십의 자리 2를 그대로 써요',
      '7 × 3 = 21이에요',
      '4 × 3 = 12, 올린 2를 더하면 14예요',
      '14의 십의 자리 1을 그대로 써요',
      '2를 그대로 내려 써요',
      '8 + 1 = 9예요',
      '2 + 4 = 6이에요',
      '1을 그대로 내려 써요'
    ])
  })

  it('306 × 3 — 첫 계산(6×3=18)의 설명이 입력 순서가 아니라 계산 순서를 따른다', () => {
    const v = buildVertical(306, 3)
    // 입력 순서로는 올림칸(십의 자리)이 먼저지만, 설명은 "6×3=18이에요"가
    // 먼저 나와야 한다 — 그래야 "18의 십의 자리 1을 위에 올려 써요"가 뒤따를 때
    // 무엇의 십의 자리인지 아이가 알 수 있다.
    expect(explanationSteps(v)[0]).toBe('6 × 3 = 18이에요')
  })

  it('sum 줄은 항상 부분곱 줄들 뒤에 온다', () => {
    const v = buildVertical(87, 69)
    const steps = explanationSteps(v)
    const lastPartialIdx = v.cells
      .filter(c => c.kind === 'product')
      .reduce((max, c) => Math.max(max, steps.indexOf(c.hint)), -1)
    const firstSumIdx = steps.findIndex((_, i) =>
      v.sumCells.some(c => c.kind === 'sum' && c.hint === steps[i])
    )
    expect(firstSumIdx).toBeGreaterThan(lastPartialIdx)
  })

  it('구구단(답 한 칸)에서도 그대로 동작한다', () => {
    const v = buildAnswerOnly(7, 8)
    expect(explanationSteps(v)).toEqual(['7 × 8 = 56이에요'])
  })

  it('carry/sumCarry 칸의 힌트는 설명 목록에 나오지 않는다 — 격자에서 직접 보인다', () => {
    const v = buildVertical(99, 99)
    const steps = explanationSteps(v)
    const carryHints = v.cells
      .filter(c => c.kind === 'carry' || c.kind === 'sumCarry')
      .map(c => c.hint)
    for (const h of carryHints) expect(steps).not.toContain(h)
  })
})
