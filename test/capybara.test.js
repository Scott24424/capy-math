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

  // 코드 리뷰 2회차: 손상된 저장 값이 무한대일 때도 안전해야 한다.
  // 거대한 일반 숫자(9999)는 50으로 보정되는데, Infinity 만 1로 튕겨서는 안 된다.
  it('Infinity 는 50으로, -Infinity 는 1로 보정한다', () => {
    expect(clampLevel(Infinity)).toBe(50)
    expect(clampLevel(-Infinity)).toBe(1)
  })
})

// --- 아래 테스트들이 쓰는 헬퍼: SVG 문자열만 보고 검증한다 (새 export 없이) ---

// <g scale(S)> 에서 S 값을 뽑아낸다
function extractScale(svg) {
  const m = svg.match(/scale\(([-\d.]+)\)/)
  return m ? parseFloat(m[1]) : null
}

// circle/ellipse 의 cx,cy 와 path 의 첫 M 좌표를 모두 뽑아낸다
function extractPoints(svg) {
  const points = []
  const attrRe = /cx="(-?[\d.]+)"\s+cy="(-?[\d.]+)"/g
  let m
  while ((m = attrRe.exec(svg))) points.push([parseFloat(m[1]), parseFloat(m[2])])
  const pathRe = /d="M\s*(-?[\d.]+)\s+(-?[\d.]+)/g
  while ((m = pathRe.exec(svg))) points.push([parseFloat(m[1]), parseFloat(m[2])])
  return points
}

const inZone = ([x, y], z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1

// 성장 스케일 <g> 안쪽(카피바라 본체)만 잘라낸다 — stage 8부터 배경에 깔리는
// 후광(accent halo)은 그룹 밖에 있고 얼굴과 같은 중심점(50,52)을 쓰므로,
// 그룹 밖까지 좌표를 모으면 얼굴 구역 오탐이 생긴다.
function scaleGroupContent(svg) {
  const start = svg.indexOf('scale(')
  const gOpenIdx = svg.lastIndexOf('<g', start)
  const openTagEnd = svg.indexOf('>', gOpenIdx) + 1
  const closeIdx = svg.lastIndexOf('</g>')
  return svg.slice(openTagEnd, closeIdx)
}

// 눈/코/입/주둥이가 있는 "얼굴" 구역 — 여기 새 도형이 생기면 눈물/핏방울 사고 재발
const FACE_ZONE = { x0: 20, x1: 80, y0: 35, y1: 80 }
// early 소품이 있어야 할 발치 구역 (왼쪽 바닥)
const GROUND_ZONE = { x0: 0, x1: 30, y0: 82, y1: 104 }

// 태그가 짝이 맞는지 손으로 스택을 굴려 확인한다 (self-closing 태그는 무시)
function isWellFormed(svg) {
  const stack = []
  const tagRe = /<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g
  let m
  while ((m = tagRe.exec(svg))) {
    const [, closing, name, selfClose] = m
    if (closing) {
      if (stack.pop() !== name) return false
    } else if (!selfClose) {
      stack.push(name)
    }
  }
  return stack.length === 0
}

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

// 코드 리뷰 2회차 — Important 1: "그림이 다르다"만으로는 성장(scale)이
// 실제로 동작하는지 보장하지 못한다 (계열마다 색이 달라서 무조건 통과함).
// 스케일 값 자체를 stage 0→9, 0.8→1.0 로 핀으로 고정한다.
describe('계열 안에서 몸집이 커진다 (scale)', () => {
  it.each([0, 1, 2, 3, 4])('%i번째 계열: stage 0→9 에서 scale 이 0.8→1.0 로 단조 증가한다', (seriesIdx) => {
    const base = seriesIdx * 10
    const scales = []
    for (let stage = 0; stage <= 9; stage++) {
      const svg = capybaraSvg(base + stage + 1)
      const scale = extractScale(svg)
      expect(scale).not.toBeNull()
      expect(scale).toBeCloseTo(0.8 + 0.2 * (stage / 9), 5)
      scales.push(scale)
    }
    for (let i = 1; i < scales.length; i++) {
      expect(scales[i]).toBeGreaterThan(scales[i - 1])
    }
    expect(scales[0]).toBeCloseTo(0.8, 5)
    expect(scales[9]).toBeCloseTo(1.0, 5)
  })
})

// 코드 리뷰 2회차 — Important 2: prefix/suffix 만 보는 기존 검사는 <g> 가
// 안 닫혀도 통과한다. 태그 균형을 직접 확인한다.
describe('SVG 구조가 온전하다', () => {
  it('1부터 50까지 모든 태그가 열고 닫힘이 맞는다', () => {
    for (let lv = 1; lv <= 50; lv++) {
      const svg = capybaraSvg(lv)
      expect(isWellFormed(svg)).toBe(true)
    }
  })

  it('<g> 여는 태그와 </g> 닫는 태그 개수가 같다', () => {
    for (let lv = 1; lv <= 50; lv++) {
      const svg = capybaraSvg(lv)
      const opens = (svg.match(/<g[\s>]/g) || []).length
      const closes = (svg.match(/<\/g>/g) || []).length
      expect(opens).toBe(closes)
      expect(opens).toBeGreaterThan(0) // 성장 스케일 그룹은 항상 있어야 한다
    }
  })
})

// 코드 리뷰 2회차 — "눈물/핏방울" 사고 재발 방지: early 소품은 stage 2부터
// 항상 발치(바닥)에 있어야 하고, 얼굴 구역에는 아무것도 새로 생기면 안 된다.
describe('early 소품은 얼굴이 아니라 발치에 있다', () => {
  it.each([0, 1, 2, 3, 4])('%i번째 계열: stage 1→2 전환에서 발치엔 늘고 얼굴엔 안 늘어난다', (seriesIdx) => {
    const base = seriesIdx * 10
    const bodyStage1 = scaleGroupContent(capybaraSvg(base + 2)) // stage 1: early 아직 없음
    const bodyStage2 = scaleGroupContent(capybaraSvg(base + 3)) // stage 2: early 등장

    const faceCount1 = extractPoints(bodyStage1).filter(p => inZone(p, FACE_ZONE)).length
    const faceCount2 = extractPoints(bodyStage2).filter(p => inZone(p, FACE_ZONE)).length
    expect(faceCount2).toBe(faceCount1)

    const groundCount1 = extractPoints(bodyStage1).filter(p => inZone(p, GROUND_ZONE)).length
    const groundCount2 = extractPoints(bodyStage2).filter(p => inZone(p, GROUND_ZONE)).length
    expect(groundCount2).toBeGreaterThan(groundCount1)
  })

  it('stage 2 이상 모든 레벨에서 얼굴 구역(주둥이/눈) 좌표가 stage 1과 동일하게 유지된다', () => {
    for (let seriesIdx = 0; seriesIdx < 5; seriesIdx++) {
      const base = seriesIdx * 10
      const baselineFaceCount = extractPoints(scaleGroupContent(capybaraSvg(base + 2))).filter(p => inZone(p, FACE_ZONE)).length
      for (let stage = 2; stage <= 9; stage++) {
        const svg = scaleGroupContent(capybaraSvg(base + stage + 1))
        const faceCount = extractPoints(svg).filter(p => inZone(p, FACE_ZONE)).length
        // 5단계(반달눈)부터는 eye 표현이 path 로 바뀌어 cx/cy 좌표가 아니라
        // 집계 대상에서 빠지므로 얼굴 구역 좌표 개수가 "그대로거나 줄 수"는 있지만
        // 늘어나서는 안 된다 — early 소품이 얼굴로 되돌아오면 여기서 늘어난다.
        expect(faceCount).toBeLessThanOrEqual(baselineFaceCount)
      }
    }
  })
})
