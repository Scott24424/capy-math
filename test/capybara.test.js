import { describe, it, expect } from 'vitest'
import { capybaraSvg, seriesOf, stageOf, clampLevel, SERIES } from '../src/ui/capybara.js'

describe('계열과 단계', () => {
  it('5계열 × 10단계로 나뉜다', () => {
    expect(SERIES).toHaveLength(5)
    expect(seriesOf(1).name).toBe(SERIES[0].name)
    expect(seriesOf(10).name).toBe(SERIES[0].name)
    expect(seriesOf(11).name).toBe(SERIES[1].name)
    expect(seriesOf(50).name).toBe(SERIES[4].name)
  })

  it('단계는 계열 안에서 0부터 9까지다', () => {
    expect(stageOf(1)).toBe(0)
    expect(stageOf(10)).toBe(9)
    expect(stageOf(11)).toBe(0)
    expect(stageOf(50)).toBe(9)
  })
})

// Review Focus 3: 저장된 레벨이 범위를 벗어나도 터지지 않는다
describe('clampLevel', () => {
  it('범위를 벗어난 값을 안전하게 보정한다', () => {
    expect(clampLevel(0)).toBe(1)
    expect(clampLevel(-5)).toBe(1)
    expect(clampLevel(51)).toBe(50)
    expect(clampLevel(9999)).toBe(50)
    expect(clampLevel(7.8)).toBe(7)
    expect(clampLevel(NaN)).toBe(1)
    expect(clampLevel(undefined)).toBe(1)
    expect(clampLevel('무엇')).toBe(1)
    expect(clampLevel(null)).toBe(1)
  })
})

describe('capybaraSvg', () => {
  it('1부터 50까지 전부 SVG 를 만든다', () => {
    for (let lv = 1; lv <= 50; lv++) {
      const svg = capybaraSvg(lv)
      expect(svg.startsWith('<svg')).toBe(true)
      expect(svg.endsWith('</svg>')).toBe(true)
      expect(svg).toContain('viewBox')
    }
  })

  it('잘못된 레벨을 줘도 터지지 않고 그림이 나온다', () => {
    for (const bad of [0, -3, 51, NaN, undefined, null, '무엇']) {
      expect(() => capybaraSvg(bad)).not.toThrow()
      expect(capybaraSvg(bad).startsWith('<svg')).toBe(true)
    }
  })

  it('레벨이 오르면 그림이 달라진다', () => {
    expect(capybaraSvg(1)).not.toBe(capybaraSvg(9))
    expect(capybaraSvg(9)).not.toBe(capybaraSvg(19))
  })

  it('계열마다 털색이 다르다', () => {
    const colors = SERIES.map(s => s.body)
    expect(new Set(colors).size).toBe(5)
  })

  it('외부 이미지를 참조하지 않는다', () => {
    for (let lv = 1; lv <= 50; lv += 7) {
      expect(capybaraSvg(lv)).not.toContain('http')
      expect(capybaraSvg(lv)).not.toContain('<image')
    }
  })
})
