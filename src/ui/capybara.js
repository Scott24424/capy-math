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
  // 카피바라 vs 곰: 카피바라는 (1) 머리가 둥근 타원이 아니라 각진 사각에 가깝고 옆으로
  // 넓다, (2) 주둥이가 아래 얼굴 대부분을 차지할 만큼 크고 뭉툭하다, (3) 코가 작은
  // 점이 아니라 주둥이 위쪽을 가로지르는 넓은 띠다, (4) 눈이 작고 위쪽 양 구석에
  // 몰려 있다, (5) 귀가 정수리에 얹힌 게 아니라 옆머리에 낮게 붙어 실루엣을 거의
  // 깨지 않는다. 이 다섯 가지를 순서대로 고쳤다 (2026-09-21 곰 문제 리뷰).
  body.push('<ellipse cx="50" cy="90" rx="29" ry="15" fill="' + s.dark + '"/>')
  // 귀 — 작고 둥글며 옆머리에 낮게, 정수리가 아니라
  body.push(`<circle cx="17" cy="33" r="6.5" fill="${s.dark}"/>`)
  body.push(`<circle cx="83" cy="33" r="6.5" fill="${s.dark}"/>`)
  // 머리 — 둥근 타원 대신 옆으로 넓고 윗면이 평평한 각진 사각
  body.push(`<rect x="14" y="26" width="72" height="48" rx="16" ry="16" fill="${s.body}"/>`)
  // 주둥이 — 아래 얼굴 대부분을 채우는 크고 뭉툭한 사각
  body.push(`<rect x="26" y="48" width="48" height="28" rx="10" ry="10" fill="${s.muzzle}"/>`)

  if (t >= 1) {
    body.push('<circle cx="24" cy="58" r="5" fill="#ff9eb5" opacity=".5"/>')
    body.push('<circle cx="76" cy="58" r="5" fill="#ff9eb5" opacity=".5"/>')
  }

  // 눈 — 작고, 위쪽 양 구석에 몰려 있다 (곰처럼 얼굴 가운데가 아니라).
  // 5단계부터 느긋한 반달눈
  if (t >= 5) {
    body.push('<path d="M20 38 q7 -5 14 0" stroke="#33220f" stroke-width="3.4" fill="none" stroke-linecap="round"/>')
    body.push('<path d="M66 38 q7 -5 14 0" stroke="#33220f" stroke-width="3.4" fill="none" stroke-linecap="round"/>')
  } else {
    body.push('<circle cx="27" cy="38" r="3.5" fill="#33220f"/><circle cx="73" cy="38" r="3.5" fill="#33220f"/>')
  }

  // 코 — 작은 타원이 아니라 주둥이 위쪽을 가로지르는 넓은 띠
  body.push('<rect x="39" y="50" width="22" height="6" rx="3" fill="#4a3421"/>')
  body.push('<path d="M50 57 v3 M50 60 q-5 4 -9 1 M50 60 q5 4 9 1" stroke="#4a3421" stroke-width="2" fill="none" stroke-linecap="round"/>')

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
