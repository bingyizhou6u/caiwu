/**
 * CSV 解析工具函数
 */

/**
 * 简单的CSV解析器（不支持复杂的引号处理，适用于MVP）
 */
export function parseCsv(text: string): string[][] {
  const lines = text.replace(/\r/g, '').split('\n').filter(Boolean)
  return lines.map(l => {
    // very naive CSV split (no complex quotes support for MVP)
    return l.split(',').map(s => s.trim())
  })
}
