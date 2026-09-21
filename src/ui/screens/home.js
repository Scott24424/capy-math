import { CATEGORIES, CATEGORY_LABELS } from '../../core/problem.js'
import { recommendCategory } from '../../core/recommend.js'
import { xpForLevel, MAX_LEVEL } from '../../core/progress.js'
import { capybaraSvg, seriesOf, clampLevel } from '../capybara.js'

// 연속 출석 옆 🔥 는 숫자 옆의 장식일 뿐이라(글자로 이미 뜻이 다 있다),
// 다른 화면처럼 코드로 그린 인라인 SVG로 바꾼다.
const FLAME_ICON =
  '<svg class="icon-flame" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">' +
  '<path fill="#f0912f" stroke="#c96a0d" stroke-width=".6" d="M12 2c1.2 3-2.6 4.4-2.6 8.2A3.6 3.6 0 0 0 13 13.8c1.6 0 2.9-1 3.4-2.4.9 1.1 1.4 2.4 1.4 3.8a5.8 5.8 0 0 1-11.6 0C6.2 10 9.6 8 9.6 5.4 9.6 3.8 10.6 2.6 12 2z"/>' +
  '</svg>'

const SAMPLE = {
  'times-table': '7 × 8',
  'two-by-one': '47 × 3',
  'three-by-one': '246 × 7',
  'two-by-two': '47 × 36'
}

/**
 * 집 화면. 저장된 상태가 일부 깨져 있어도(레벨/경험치/카테고리 값 등이 없거나
 * 이상해도) 화면이 비어버리면 아이가 앱을 다시 시작할 방법이 없으므로,
 * 값마다 안전한 기본값으로 보정해서 그린다.
 */
export function renderHome(container, state, { onStart, onRecords }) {
  const recommended = recommendCategory(state)
  const level = clampLevel(state.level)
  const xp = Number.isFinite(state.xp) ? Math.max(0, state.xp) : 0
  const need = level >= MAX_LEVEL ? 0 : xpForLevel(level)
  const percent = need === 0 ? 100 : Math.min(100, Math.round((xp / need) * 100))
  const remain = Math.max(0, need - xp)
  const series = seriesOf(level)
  const streakDays = Number.isFinite(state.streakDays) ? Math.max(0, state.streakDays) : 0
  const reviewCount = Array.isArray(state.reviewQueue) ? state.reviewQueue.length : 0

  container.innerHTML = `
    <div class="home">
      <div class="home-hero" style="background:${series.bg}">
        ${capybaraSvg(level, 130)}
        <div class="home-hero-text">
          <div class="home-name">${series.name} · Lv.${level}</div>
          <div class="bar"><i style="width:${percent}%"></i></div>
          <div class="home-need">${need === 0 ? '최고 레벨이에요!' : `다음 레벨까지 경험치 ${remain}만큼 남았어요`}</div>
        </div>
      </div>

      <div class="tiles">
        ${CATEGORIES.map(c => `
          <button class="tile ${c === recommended ? 'is-recommended' : ''}" data-category="${c}">
            <b>${CATEGORY_LABELS[c] ?? c}</b>
            <span>${SAMPLE[c] ?? ''}</span>
            ${c === recommended ? '<em>오늘 추천</em>' : ''}
          </button>`).join('')}
      </div>

      <div class="pills">
        <span class="pill">${FLAME_ICON} 연속 ${streakDays}일째</span>
        <span class="pill">복습 ${reviewCount}문제</span>
        <button class="pill pill-button" id="records">기록실 보기</button>
      </div>
    </div>`

  container.querySelectorAll('[data-category]').forEach(button => {
    button.addEventListener('click', () => onStart(button.dataset.category))
  })
  container.querySelector('#records').addEventListener('click', onRecords)
}
