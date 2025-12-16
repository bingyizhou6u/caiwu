/**
 * 空值文本组件
 * 统一处理空值显示
 */

export interface EmptyTextProps {
  /** 要显示的值 */
  value: string | number | null | undefined
  /** 空值显示文本，默认 '-' */
  emptyText?: string
  /** 自定义样式 */
  style?: React.CSSProperties
  /** 自定义类名 */
  className?: string
}

/**
 * 空值文本组件
 */
export function EmptyText({
  value,
  emptyText = '-',
  style,
  className,
}: EmptyTextProps) {
  const displayValue = value == null || value === '' ? emptyText : String(value)
  
  return (
    <span style={style} className={className}>
      {displayValue}
    </span>
  )
}
