import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusTag } from '../StatusTag'

const mockStatusMap = {
  active: { text: '活跃', color: 'success' as const },
  inactive: { text: '停用', color: 'default' as const },
  pending: { text: '待处理', color: 'warning' as const },
  error: { text: '错误', color: 'error' as const },
}

describe('StatusTag', () => {
  it('should display status tag with correct text', () => {
    render(<StatusTag status="active" statusMap={mockStatusMap} />)
    expect(screen.getByText('活跃')).toBeDefined()
  })

  it('should display status tag for inactive status', () => {
    render(<StatusTag status="inactive" statusMap={mockStatusMap} />)
    expect(screen.getByText('停用')).toBeDefined()
  })

  it('should display status tag for pending status', () => {
    render(<StatusTag status="pending" statusMap={mockStatusMap} />)
    expect(screen.getByText('待处理')).toBeDefined()
  })

  it('should display raw status when not in statusMap', () => {
    render(<StatusTag status="unknown" statusMap={mockStatusMap} />)
    expect(screen.getByText('unknown')).toBeDefined()
  })

  it('should display empty text for null status', () => {
    render(<StatusTag status={null} statusMap={mockStatusMap} />)
    expect(screen.getByText('-')).toBeDefined()
  })

  it('should display empty text for undefined status', () => {
    render(<StatusTag status={undefined} statusMap={mockStatusMap} />)
    expect(screen.getByText('-')).toBeDefined()
  })

  it('should display custom empty text', () => {
    render(<StatusTag status={null} statusMap={mockStatusMap} emptyText="N/A" />)
    expect(screen.getByText('N/A')).toBeDefined()
  })

  it('should render as Tag component for known status', () => {
    const { container } = render(<StatusTag status="active" statusMap={mockStatusMap} />)
    expect(container.querySelector('.ant-tag')).toBeDefined()
  })

  it('should render as span for unknown status', () => {
    const { container } = render(<StatusTag status="unknown" statusMap={mockStatusMap} />)
    const span = container.querySelector('span')
    expect(span).toBeDefined()
    expect(span?.textContent).toBe('unknown')
  })
})
