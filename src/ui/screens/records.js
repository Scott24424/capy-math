import { CATEGORIES, CATEGORY_LABELS } from '../../core/problem.js'
import { BADGES } from '../../core/progress.js'
import { capybaraSvg, clampLevel } from '../capybara.js'
import { buildExport, parseImport } from '../../storage.js'

// 연속 출석 옆 🔥 는 숫자 옆의 장식일 뿐이라(글자로 이미 뜻이 다 있다),
// 다른 화면처럼 코드로 그린 인라인 SVG로 바꾼다.
const FLAME_ICON =
  '<svg class="icon-flame" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">' +
  '<path fill="#f0912f" stroke="#c96a0d" stroke-width=".6" d="M12 2c1.2 3-2.6 4.4-2.6 8.2A3.6 3.6 0 0 0 13 13.8c1.6 0 2.9-1 3.4-2.4.9 1.1 1.4 2.4 1.4 3.8a5.8 5.8 0 0 1-11.6 0C6.2 10 9.6 8 9.6 5.4 9.6 3.8 10.6 2.6 12 2z"/>' +
  '</svg>'

const DEFAULT_IMPORT_FAILURE_MESSAGE =
  '이 파일은 곱셈 카피바라의 기록 파일이 아니거나, 읽을 수 없어요. 다른 파일을 골라주세요.'

/**
 * parseImport 가 돌려준 reason 에 맞는 안내문을 고른다. 버전이 안 맞는 두
 * 경우는 서 있는 사람 입장에서 전혀 다르다: 더 새 버전 파일은 "화면이
 * 예전 것"이라는 뜻이라 새로고침하면 바로 풀리고, 더 오래된 버전 파일은
 * 지금 당장 방법이 없다 — 없는 해결책을 있는 것처럼 말하면 안 된다.
 */
export function importFailureMessage(reason) {
  if (reason === 'wrong-version-newer') {
    return '더 새로운 곱셈 카피바라에서 내보낸 파일이에요. 이 화면이 예전 버전이라 그래요.\n' +
      '화면을 새로고침한 다음 다시 불러와 주세요.'
  }
  if (reason === 'wrong-version-older') {
    return '더 예전 버전의 곱셈 카피바라에서 내보낸 파일이라 지금은 불러올 수 없어요.\n' +
      '어른에게 알려주세요.'
  }
  return DEFAULT_IMPORT_FAILURE_MESSAGE
}

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
export function renderRecords(container, state, { onBack, onImport }) {
  const level = clampLevel(state.level)
  const badges = Array.isArray(state.badges) ? state.badges : []
  const streakDays = Number.isFinite(state.streakDays) ? Math.max(0, state.streakDays) : 0

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
      <p class="records-streak">${FLAME_ICON} 연속 출석 ${streakDays}일째</p>
      <div class="capy-grid">${capybaras}</div>
      <div class="records-table-scroll">
        <table class="records-table">
          <thead><tr><th>카테고리</th><th>푼 문제</th><th>정확도</th><th>최고 기록</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <h3>배지</h3>
      <div class="badges">${badgeHtml}</div>
      <button class="btn-ghost" id="back">집으로</button>

      <div class="records-transfer">
        <p class="muted">다른 컴퓨터에서도 이어서 하고 싶으면 눌러보세요.</p>
        <button class="btn-ghost" id="export-progress">진도 내보내기</button>
        <button class="btn-ghost" id="import-progress">진도 불러오기</button>
        <input type="file" accept="application/json" id="import-progress-file" hidden>
      </div>
    </div>`

  container.querySelector('#back').addEventListener('click', onBack)

  container.querySelector('#export-progress').addEventListener('click', () => {
    const envelope = buildExport(state)
    const json = JSON.stringify(envelope, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const dateStr = new Date().toLocaleDateString('sv')

    const a = document.createElement('a')
    a.href = url
    a.download = `곱셈카피바라-진도-${dateStr}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  })

  const fileInput = container.querySelector('#import-progress-file')

  container.querySelector('#import-progress').addEventListener('click', () => {
    const sure = window.confirm(
      '불러오기를 하면 지금까지 모은 기록이 전부 사라지고, 파일 안의 기록으로 바뀌어요.\n' +
      '정말 불러올까요?'
    )
    if (!sure) return
    fileInput.value = ''
    fileInput.click()
  })

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      let parsed
      try {
        parsed = JSON.parse(String(reader.result))
      } catch {
        window.alert('이 파일은 읽을 수 없어요. 곱셈 카피바라에서 내보낸 파일을 골라주세요.')
        return
      }

      const result = parseImport(parsed)
      if (!result.ok) {
        window.alert(importFailureMessage(result.reason))
        return
      }

      window.alert('기록을 잘 불러왔어요!')
      onImport?.(result.state)
    }
    reader.readAsText(file)
  })
}
