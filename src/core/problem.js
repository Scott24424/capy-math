export const CATEGORIES = ['times-table', 'two-by-one', 'three-by-one', 'two-by-two']
export const DIFFICULTIES = ['easy', 'normal', 'hard']

export const CATEGORY_LABELS = {
  'times-table': '구구단',
  'two-by-one': '두 자리 × 한 자리',
  'three-by-one': '세 자리 × 한 자리',
  'two-by-two': '두 자리 × 두 자리'
}

/** 한 자리 수 b 를 곱할 때 생기는 올림 횟수 */
export function countCarries(a, b) {
  let carry = 0
  let count = 0
  for (const d of String(a).split('').reverse().map(Number)) {
    const total = d * b + carry
    carry = Math.floor(total / 10)
    if (carry > 0) count++
  }
  return count
}

const pick = (rng, min, max) => min + Math.floor(rng() * (max - min + 1))

/** 후보를 뽑아 조건을 만족할 때까지 되풀이하되, 상한을 두고 반드시 답을 돌려준다 */
function sample(rng, draw, ok, limit = 300) {
  let last = draw()
  for (let i = 0; i < limit; i++) {
    if (ok(last)) return last
    last = draw()
  }
  return last   // 못 찾으면 마지막 후보를 그대로 쓴다 — 무한 루프보다 낫다
}

const RULES = {
  'times-table': {
    draw: (rng) => ({ a: pick(rng, 2, 9), b: pick(rng, 2, 9) }),
    // floor: 난이도와 무관하게 항상 이 카테고리의 범위 불변식을 지키는 최후의 안전망
    floor: (rng) => ({ a: pick(rng, 2, 9), b: pick(rng, 2, 9) }),
    easy: (p) => [2, 5].includes(p.b) || [2, 5].includes(p.a),
    normal: () => true,
    hard: (p) => [p.a, p.b].some(n => n >= 6 && n <= 8)
  },
  'two-by-one': {
    draw: (rng) => ({ a: pick(rng, 10, 99), b: pick(rng, 2, 9) }),
    floor: (rng) => ({ a: pick(rng, 10, 99), b: pick(rng, 2, 9) }),
    easy: (p) => countCarries(p.a, p.b) === 0,
    normal: (p) => countCarries(p.a, p.b) === 1,
    hard: (p) => countCarries(p.a, p.b) === 2 || p.a % 10 === 0
  },
  'three-by-one': {
    draw: (rng) => ({ a: pick(rng, 100, 999), b: pick(rng, 2, 9) }),
    floor: (rng) => ({ a: pick(rng, 100, 999), b: pick(rng, 2, 9) }),
    easy: (p) => countCarries(p.a, p.b) === 1,
    normal: (p) => countCarries(p.a, p.b) === 2,
    hard: (p) => countCarries(p.a, p.b) === 3 || Math.floor(p.a / 10) % 10 === 0
  },
  'two-by-two': {
    // R1: easy는 b를 10~99에서 뽑아 11~13으로 걸러내지 않고, 처음부터 11~13에서 직접 뽑는다.
    // (뽑을 확률이 3.3%뿐이라 300회 상한에 걸릴 여지가 있어 테스트가 흔들렸다.)
    draw: (rng, difficulty) => ({
      a: pick(rng, 10, 99),
      b: difficulty === 'easy' ? pick(rng, 11, 13) : pick(rng, 10, 99)
    }),
    // floor: RT2-2는 "반드시" 지켜야 하므로, 모든 예외적 draw/predicate 실패를 뚫고서라도
    // b의 일의 자리가 0이 되지 않도록 여기서 직접 보정한다
    floor: (rng) => {
      const a = pick(rng, 10, 99)
      let b = pick(rng, 10, 99)
      if (b % 10 === 0) b += 1
      return { a, b }
    },
    // easy는 draw 단계에서 이미 b를 11~13으로만 뽑으므로 범위 검사만 하면 된다
    easy: (p) => p.b >= 11 && p.b <= 13,
    // RT2-2: b의 일의 자리가 0이면 첫 부분곱이 전부 0이 되어 세로셈의 의미가 사라지므로 제외한다
    normal: (p) => {
      const c = countCarries(p.a, p.b % 10) + countCarries(p.a, Math.floor(p.b / 10))
      return c >= 1 && c <= 2 && p.b % 10 !== 0
    },
    // hard는 countCarries(p.a, p.b % 10) > 0 조건이 b%10===0을 이미 배제한다
    hard: (p) =>
      countCarries(p.a, p.b % 10) > 0 && countCarries(p.a, Math.floor(p.b / 10)) > 0
  }
}

export function generateProblem(category, difficulty, rng = Math.random) {
  const rule = RULES[category]
  if (!rule) throw new Error(`모르는 카테고리: ${category}`)

  // 쉬움/어려움 단계는 조건이 좁아 못 찾을 수 있으므로, 못 찾으면 한 단계 느슨한 조건으로 물러난다
  const ladder = { easy: ['easy', 'normal'], normal: ['normal'], hard: ['hard', 'normal'] }
  const steps = ladder[difficulty] || ['normal']

  for (const step of steps) {
    const candidate = sample(rng, () => rule.draw(rng, difficulty), rule[step])
    if (rule[step](candidate)) {
      return { id: `${candidate.a}x${candidate.b}`, category, difficulty, a: candidate.a, b: candidate.b }
    }
  }

  // 모든 단계가 실패해도(병적인 rng 등) 카테고리 불변식은 반드시 지켜야 하므로,
  // 마지막에는 조건 없이 항상 유효한 floor 후보를 쓴다 — 거부된 후보를 그대로 반환하지 않는다
  const fallback = rule.floor(rng)
  return { id: `${fallback.a}x${fallback.b}`, category, difficulty, a: fallback.a, b: fallback.b }
}

export function adjustDifficulty(current, recentResults) {
  if (recentResults.length < 10) return current
  const recentWindow = recentResults.slice(-10)
  const accuracy = recentWindow.filter(Boolean).length / recentWindow.length
  const i = DIFFICULTIES.indexOf(current)
  if (accuracy >= 0.9) return DIFFICULTIES[Math.min(i + 1, DIFFICULTIES.length - 1)]
  if (accuracy < 0.6) return DIFFICULTIES[Math.max(i - 1, 0)]
  return current
}
