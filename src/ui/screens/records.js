import { CATEGORIES, CATEGORY_LABELS } from '../../core/problem.js'
import { BADGES } from '../../core/progress.js'
import { capybaraSvg, clampLevel } from '../capybara.js'

const mmss = (ms) => {
  const total = Math.round(Math.max(0, Number(ms) || 0) / 1000)
  return `${Math.floor(total / 60)}분 ${String(total % 60).padStart(2, '0')}초`
}

/**
 * 기록실. 만난 카피바라 50마리를 전부 보여준다 — 아직 못 만난 자리는 물음표로
 * 남겨서 앞으로 무엇이 있는지 미리 보여준다. state 값이 비었거나 이상해도
 * (카테고리 하나를 전혀 안 해봤거나, bestByCategory 가 null 이거나) 표는 항상
 * 그려져야 한다.
 */
export function renderRecords(container, state, { onBack }) {
  const level = clampLevel(state.level)
  const badges = Array.isArray(state.badges) ? state.badges : []

  const capybaras = Array.from({ length: 50 }, (_, i) => {
    const lv = i + 1
    return lv <= level
      ? `<div class="capy-slot">${capybaraSvg(lv, 46)}<span>${lv}</span></div>`
      : `<div class="capy-slot is-locked"><span>?</span></div>`
  }).join('')

  const rows = CATEGORIES.map(c => {
    const best = state.bestByCategory?.[c]
    const recent = Array.isArray(state.recentByCategory?.[c]) ? state.recentByCategory[c] : []
    const accuracy = recent.length === 0
      ? '–'
      : `${Math.round((recent.filter(Boolean).length / recent.length) * 100)}%`
    const solved = Number.isFinite(state.solvedByCategory?.[c]) ? state.solvedByCategory[c] : 0
    return `<tr>
      <td>${CATEGORY_LABELS[c] ?? c}</td>
      <td>${solved}문제</td>
      <td>${accuracy}</td>
      <td>${best && Number.isFinite(best.correct) ? `${best.correct}/10 · ${mmss(best.elapsedMs)}` : '–'}</td>
    </tr>`
  }).join('')

  const badgeHtml = badges.length === 0
    ? '<p class="muted">아직 배지가 없어요. 한 판 해볼까요?</p>'
    : badges.map(id =>
        `<span class="badge" title="${BADGES[id]?.description ?? ''}">${BADGES[id]?.label ?? id}</span>`
      ).join('')

  container.innerHTML = `
    <div class="records">
      <h2>기록실</h2>
      <div class="capy-grid">${capybaras}</div>
      <table class="records-table">
        <thead><tr><th>카테고리</th><th>푼 문제</th><th>정확도</th><th>최고 기록</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <h3>배지</h3>
      <div class="badges">${badgeHtml}</div>
      <button class="btn-ghost" id="back">집으로</button>
    </div>`

  container.querySelector('#back').addEventListener('click', onBack)
}
