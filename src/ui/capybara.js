export const SERIES = [
  { name: '풀밭 카피바라',  bg: '#eef7e4', body: '#ab8a65', dark: '#8b6c4b', muzzle: '#c2a382', accent: '#5aa544', early: 'leaf',  neck: 'flower', head: 'butterfly' },
  { name: '온천 카피바라',  bg: '#e2f2f7', body: '#b09071', dark: '#8f7055', muzzle: '#c9a988', accent: '#3fa3c4', early: 'drop',  neck: 'towel',  head: 'bucket' },
  { name: '과수원 카피바라', bg: '#fdf0dd', body: '#a8845d', dark: '#876743', muzzle: '#c0a077', accent: '#f0912f', early: 'seed',  neck: 'basket', head: 'orange' },
  { name: '눈나라 카피바라', bg: '#eaf1fa', body: '#c3a888', dark: '#a08a6c', muzzle: '#dcc7ab', accent: '#6f9fe0', early: 'flake', neck: 'scarf',  head: 'earmuff' },
  { name: '별나라 카피바라', bg: '#ece7fa', body: '#9f8cb8', dark: '#7e6c96', muzzle: '#bcacd0', accent: '#7451d8', early: 'star',  neck: 'collar', head: 'crown' }
]

export function clampLevel(level) {
  const num = Number(level)
  if (num === Infinity) return 50
  const n = Math.floor(num)
  if (!Number.isFinite(n)) return 1
  return Math.min(Math.max(n, 1), 50)
}

export const seriesOf = (level) => SERIES[Math.floor((clampLevel(level) - 1) / 10)]
export const stageOf = (level) => (clampLevel(level) - 1) % 10

// early 소품은 얼굴 옆이 아니라 발치(왼쪽 바닥)에 둔다 — 얼굴에 겹치면
// 눈물/핏방울처럼 보이는 사고가 났었다 (2026-09-20 리뷰).
const EARLY = {
  leaf:  '<path d="M10 96 q9 -3 12 -9 q-9 0 -12 9" fill="#5aa544"/>',
  drop:  '<circle cx="12" cy="92" r="4" fill="#bfe9f5" opacity=".85" stroke="#8ed0e6" stroke-width=".6"/><circle cx="19" cy="96.5" r="2.6" fill="#bfe9f5" opacity=".85" stroke="#8ed0e6" stroke-width=".6"/><circle cx="9" cy="98.5" r="2" fill="#bfe9f5" opacity=".85" stroke="#8ed0e6" stroke-width=".6"/>',
  seed:  '<circle cx="14" cy="93" r="5.5" fill="#e8564f"/><path d="M14 87.5 v-3" stroke="#6b4a24" stroke-width="1.6" stroke-linecap="round"/><path d="M14 87 q4 -3 6 0 q-4 2 -6 0" fill="#5aa544"/>',
  flake: '<path d="M14 90 v10 M9 92 l10 6 M19 92 l-10 6" stroke="#cfe0f5" stroke-width="2" stroke-linecap="round"/>',
  star:  '<path d="M14 88 l2.2 4.6 5 .7 -3.6 3.5 .9 5 -4.5 -2.4 -4.5 2.4 .9 -5 -3.6 -3.5 5 -.7 z" fill="#f5c542"/>'
}

// 5장 꽃잎을 회전시켜 만든 꽃 — 원 하나짜리는 단추처럼 보였다.
const petalFlower = (() => {
  const petals = Array.from({ length: 5 }, (_, i) =>
    `<ellipse transform="rotate(${i * 72})" cx="0" cy="-3.6" rx="2.3" ry="3.3" fill="#fff" stroke="#f2c8dd" stroke-width=".5"/>`
  ).join('')
  return `<g transform="translate(50,84)">${petals}<circle r="1.8" fill="#f5c542"/></g>`
})()

const NECK = {
  flower: petalFlower,
  towel:  '<rect x="34" y="79" width="32" height="8" rx="4" fill="#fff"/><rect x="34" y="82" width="32" height="2" fill="#8ed0e6"/>',
  basket: '<path d="M34 82 h32 l-4 10 h-24 z" fill="#c68a4a"/><path d="M34 82 h32" stroke="#a06f37" stroke-width="2"/>',
  scarf:  '<rect x="32" y="79" width="36" height="9" rx="4.5" fill="#e8564f"/><rect x="60" y="84" width="8" height="14" rx="3" fill="#e8564f"/>',
  collar: '<rect x="34" y="80" width="32" height="7" rx="3.5" fill="#7451d8"/><circle cx="50" cy="90" r="4" fill="#f5c542"/>'
}

const HEAD = {
  butterfly: '<g transform="translate(50,14)"><ellipse cx="-6" cy="0" rx="6" ry="7" fill="#f2a0d0"/><ellipse cx="6" cy="0" rx="6" ry="7" fill="#f2a0d0"/><rect x="-1" y="-6" width="2" height="12" rx="1" fill="#6b4a24"/></g>',
  bucket:    '<path d="M38 20 h24 l-3 -12 h-18 z" fill="#e6d3b3" stroke="#c9b189" stroke-width="1.5"/><rect x="36" y="18" width="28" height="5" rx="2.5" fill="#d9c2a0"/>',
  orange:    '<circle cx="50" cy="16" r="11" fill="#f0912f"/><path d="M50 7 q3 -4 7 -3 q-3 4 -7 3" fill="#4f9d3a"/><path d="M50 7 v-3" stroke="#6b4a24" stroke-width="2" stroke-linecap="round"/>',
  earmuff:   '<path d="M23 24 q27 -22 54 0" stroke="#e8564f" stroke-width="4" fill="none"/><circle cx="23" cy="27" r="10" fill="#e8564f"/><circle cx="77" cy="27" r="10" fill="#e8564f"/>',
  crown:     '<path d="M30 22 L36 9 L44 17 L50 4 L56 17 L64 9 L70 22 Z" fill="#f5c542" stroke="#d9a520" stroke-width="1.5" stroke-linejoin="round"/><circle cx="50" cy="11" r="2.4" fill="#e8564f"/>'
}

export function capybaraSvg(level, size = 120) {
  const lv = clampLevel(level)
  const s = seriesOf(lv)
  const t = stageOf(lv)
  // 계열 안에서 레벨이 오르면 몸집이 커진다: 고정된 반경 조정 대신
  // 바닥을 기준점으로 삼아 그림 전체를 확대한다 (0단계 0.80배 → 9단계 1.00배).
  const scale = 0.80 + 0.20 * (t / 9)

  const back = []
  const body = []

  // 배경 — 확대 대상이 아니다
  if (t >= 8) back.push(`<circle cx="50" cy="52" r="47" fill="${s.accent}" opacity=".10"/>`)

  // 몸통과 머리 — 이 안의 요소들은 모두 스케일 그룹 안에서 함께 자란다
  //
  // 카피바라 vs 곰(2026-09-21 리뷰): 머리는 옆으로 넓은 사각, 주둥이는 아래 얼굴을
  // 채울 만큼 크고, 코는 가로 띠, 눈은 위쪽 양 구석, 귀는 옆머리에 작게.
  // 그 뼈대는 지키면서 "말랑 인형" 느낌으로 다듬었다(2026-09-27): 머리 모서리를
  // 더 둥글게 하고 얇은 테두리를 두르고, 점눈에 반짝이, 귀 안쪽 분홍, 늘 있는 볼터치,
  // ω 입, 몸 아래 작은 발 두 개.
  body.push(`<ellipse cx="50" cy="89" rx="30" ry="14" fill="${s.dark}"/>`)
  body.push(`<ellipse cx="37" cy="100" rx="6" ry="3.6" fill="${s.dark}"/><ellipse cx="63" cy="100" rx="6" ry="3.6" fill="${s.dark}"/>`)
  // 귀 — 작고 옆머리에, 안쪽은 분홍
  for (const x of [21, 79]) {
    body.push(`<ellipse cx="${x}" cy="29" rx="6" ry="5.5" fill="${s.dark}"/><ellipse cx="${x}" cy="29.5" rx="2.8" ry="2.4" fill="#e9a3a3"/>`)
  }
  // 머리 — 옆으로 넓은 사각을 모서리만 크게 둥글린다
  body.push(`<rect x="14" y="24" width="72" height="54" rx="25" fill="${s.body}" stroke="${s.dark}" stroke-width="1.4"/>`)
  // 주둥이 — 아래 얼굴 대부분을 채우는 크고 뭉툭한 사각
  body.push(`<rect x="28" y="50" width="44" height="25" rx="12.5" fill="${s.muzzle}"/>`)
  // 볼터치
  body.push('<ellipse cx="24" cy="57" rx="5.5" ry="3.3" fill="#ff8fab" opacity=".55"/><ellipse cx="76" cy="57" rx="5.5" ry="3.3" fill="#ff8fab" opacity=".55"/>')

  // 눈 — 위쪽 양 구석. 반짝이는 점눈, 5단계부터 느긋한 반달눈
  if (t >= 5) {
    for (const x of [30, 70]) {
      body.push(`<path d="M${x - 5} 43 q5 -6 10 0" stroke="#33220f" stroke-width="3" fill="none" stroke-linecap="round"/>`)
    }
  } else {
    for (const x of [30, 70]) {
      body.push(`<circle cx="${x}" cy="41" r="4.2" fill="#33220f"/><circle cx="${x + 1.5}" cy="39.4" r="1.5" fill="#fff"/>`)
    }
  }

  // 코 — 주둥이 위쪽을 가로지르는 띠(작은 광택 포함), 그 아래 ω 입
  body.push('<rect x="42" y="52" width="16" height="5.5" rx="2.75" fill="#4a3421"/><rect x="45" y="53" width="4" height="1.4" rx=".7" fill="#fff" opacity=".6"/>')
  body.push('<path d="M44 61 q3 3.5 6 0 q3 3.5 6 0" stroke="#4a3421" stroke-width="1.8" fill="none" stroke-linecap="round"/>')

  if (t >= 2) body.push(EARLY[s.early])
  if (t >= 4) body.push(NECK[s.neck])
  if (t >= 6) body.push(HEAD[s.head])

  const p = [...back, `<g transform="translate(50,100) scale(${scale}) translate(-50,-100)">${body.join('')}</g>`]

  if (t === 9) {
    p.push(`<path d="M12 44 l1.6 3.6 3.6 1.6 -3.6 1.6 -1.6 3.6 -1.6 -3.6 -3.6 -1.6 3.6 -1.6 z" fill="${s.accent}"/>`)
    p.push(`<path d="M88 50 l1.4 3 3 1.4 -3 1.4 -1.4 3 -1.4 -3 -3 -1.4 3 -1.4 z" fill="${s.accent}"/>`)
  }

  return `<svg class="capy" width="${size}" height="${size}" viewBox="0 0 100 108" aria-hidden="true">${p.join('')}</svg>`
}
