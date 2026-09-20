import { capybaraSvg, clampLevel, seriesOf } from '../capybara.js'
import { xpForLevel, MAX_LEVEL, BADGES } from '../../core/progress.js'
import { objectParticle } from '../../core/korean.js'

const mmss = (ms) => {
  const total = Math.round(Math.max(0, Number(ms) || 0) / 1000)
  return `${Math.floor(total / 60)}분 ${String(total % 60).padStart(2, '0')}초`
}

/** 새 계열로 넘어갈 때 반짝일 4개의 반짝임 — 위치와 지연을 조금씩 흩어 자연스럽게 만든다 */
const SPARKLES = [
  { top: '-6%', left: '4%', delay: '0s' },
  { top: '2%', left: '82%', delay: '.08s' },
  { top: '62%', left: '-4%', delay: '.16s' },
  { top: '70%', left: '86%', delay: '.05s' }
]

/**
 * 결과 화면. "한 판 더"가 가장 눈에 띄어야 한다.
 * summary 는 core/grading.js 의 summarize() 결과에 finishSet 이 best 를 더한 것,
 * xpInfo 는 { gained, fromLevel, leveledUp, newBadges } 다.
 * 둘 다 호출부 사정으로 필드가 비거나 이상할 수 있어 화면이 비어버리지 않도록 방어한다.
 */
export function renderResult(container, summary, xpInfo, state, { onAgain, onReview, onHome }) {
  const level = clampLevel(state.level)
  const xp = Number.isFinite(state.xp) ? Math.max(0, state.xp) : 0
  const need = level >= MAX_LEVEL ? 0 : xpForLevel(level)
  const percent = need === 0 ? 100 : Math.min(100, Math.round((xp / need) * 100))

  const total = Number.isFinite(summary?.total) ? summary.total : 0
  const correct = Number.isFinite(summary?.correct) ? summary.correct : 0
  const wrong = Number.isFinite(summary?.wrong) ? summary.wrong : Math.max(0, total - correct)
  const gained = Number.isFinite(xpInfo?.gained) ? xpInfo.gained : 0
  const fromLevel = Number.isFinite(xpInfo?.fromLevel) ? xpInfo.fromLevel : level
  const leveledUp = Boolean(xpInfo?.leveledUp)
  const newBadges = Array.isArray(xpInfo?.newBadges) ? xpInfo.newBadges : []
  const badgeLabels = newBadges.map(id => BADGES[id]?.label ?? id)

  // 레벨업 순간에만 축하 연출을 붙인다 — leveledUp 이 false 면 평소와 똑같다.
  // 계열이 바뀌면(예: 풀밭 → 온천) 새 카피바라를 만났다는 걸 이름으로 알려준다.
  const newSeries = leveledUp && seriesOf(fromLevel).name !== seriesOf(level).name
  const seriesName = seriesOf(level).name

  // 만렙(50)이면 applyXp 가 경험치를 쌓지 않으므로 "경험치 +N" 은 거짓말이 된다 —
  // 대신 정직하게 최고 레벨이라는 것만 알려준다.
  const xpText = level >= MAX_LEVEL ? '이미 최고 레벨이에요!' : `경험치 +${gained}`

  container.innerHTML = `
    <div class="result"${newSeries ? ` style="background:${seriesOf(level).bg}"` : ''}>
      <div class="result-top">
        <div class="result-capy${leveledUp ? ' is-level-up' : ''}">
          ${capybaraSvg(level, 110)}
          ${leveledUp ? SPARKLES.map(s =>
            `<span class="spark" style="top:${s.top};left:${s.left};animation-delay:${s.delay}">✨</span>`
          ).join('') : ''}
        </div>
        <div class="result-text">
          <div class="result-score">${correct} / ${total} 맞았어요!</div>
          <div class="result-time">${mmss(summary?.elapsedMs)}${summary?.best ? ' · 최고 기록이에요! 🎉' : ''}</div>
          <div class="bar"><i style="width:${percent}%"></i></div>
          <div class="result-xp">
            ${xpText}
            ${leveledUp ? ` · 레벨 ${fromLevel} → ${level}!` : ''}
          </div>
          ${newSeries ? `<div class="result-series">${seriesName}${objectParticle(seriesName)} 만났어요!</div>` : ''}
          ${badgeLabels.length > 0
            ? `<div class="result-badges">새 배지: ${badgeLabels.join(', ')}</div>` : ''}
        </div>
      </div>
      <div class="result-buttons">
        <button class="btn-primary" id="again">한 판 더</button>
        <button class="btn-ghost" id="review" ${wrong === 0 ? 'disabled' : ''}>틀린 문제 다시보기</button>
        <button class="btn-ghost" id="home">집으로</button>
      </div>
    </div>`

  container.querySelector('#again').addEventListener('click', onAgain)
  container.querySelector('#home').addEventListener('click', onHome)
  const review = container.querySelector('#review')
  if (wrong > 0) review.addEventListener('click', onReview)
}
