const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** 사용자가 입력한 글자(이메일 등)를 innerHTML 에 넣기 전에 꼭 거친다 */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ENTITIES[ch])
}
