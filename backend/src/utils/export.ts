/**
 * 数据导出工具
 * 支持 CSV 格式导出（兼容 Cloudflare Workers 环境）
 */

/**
 * 导出数据为 CSV 格式
 * 
 * @param data 数据数组
 * @param columns 列定义
 * @param filename 文件名（不含扩展名）
 * @returns CSV 格式的字符串
 */
export function exportToCSV(
  data: any[],
  columns: Array<{ header: string; key: string; formatter?: (value: any) => string }>,
  filename: string
): string {
  // CSV 头部
  const headers = columns.map(col => escapeCSVValue(col.header)).join(',')
  
  // CSV 数据行
  const rows = data.map(row => {
    return columns
      .map(col => {
        const value = row[col.key]
        const formattedValue = col.formatter ? col.formatter(value) : value
        return escapeCSVValue(formattedValue)
      })
      .join(',')
  })
  
  const csvContent = [headers, ...rows].join('\n')
  
  // 添加 BOM 以支持中文 Excel 正确显示
  const BOM = '\uFEFF'
  return BOM + csvContent
}

/**
 * 转义 CSV 值（处理逗号、引号、换行符）
 */
function escapeCSVValue(value: any): string {
  if (value === null || value === undefined) {
    return ''
  }
  
  const str = String(value)
  
  // 如果包含逗号、引号或换行符，需要用引号包裹并转义引号
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  
  return str
}

/**
 * 创建 CSV 下载响应
 */
export function createCSVResponse(csvContent: string, filename: string): Response {
  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}.csv"`,
    },
  })
}

/**
 * 格式化金额（分转元）
 */
export function formatAmountCents(cents: number): string {
  return (cents / 100).toFixed(2)
}

/**
 * 格式化日期
 */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '-'
  return date
}

