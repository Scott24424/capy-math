/** 한글 음절의 받침 유무로 '을/를' 조사를 고른다. */
export function objectParticle(word) {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (code < 0 || code > 11171) return '을'
  return code % 28 === 0 ? '를' : '을'
}
