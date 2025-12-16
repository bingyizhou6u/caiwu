import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AmountDisplay } from '../AmountDisplay'

describe('AmountDisplay', () => {
  it('should display formatted amount', () => {
    render(<AmountDisplay cents={10000} />)
    expect(screen.getByText('100.00')).toBeDefined()
  })

  it('should display amount with currency symbol', () => {
    render(<AmountDisplay cents={10000} currency="CNY" />)
    expect(screen.getByText('¥100.00')).toBeDefined()
  })

  it('should display amount without currency symbol', () => {
    render(<AmountDisplay cents={10000} currency="CNY" showSymbol={false} />)
    expect(screen.getByText('100.00')).toBeDefined()
  })

  it('should display empty text for null value', () => {
    render(<AmountDisplay cents={null} />)
    expect(screen.getByText('-')).toBeDefined()
  })

  it('should display empty text for undefined value', () => {
    render(<AmountDisplay cents={undefined} />)
    expect(screen.getByText('-')).toBeDefined()
  })

  it('should display custom empty text', () => {
    render(<AmountDisplay cents={null} emptyText="N/A" />)
    expect(screen.getByText('N/A')).toBeDefined()
  })

  it('should respect precision option', () => {
    render(<AmountDisplay cents={10050} precision={1} />)
    expect(screen.getByText('100.5')).toBeDefined()
  })

  it('should display zero amount', () => {
    render(<AmountDisplay cents={0} />)
    expect(screen.getByText('0.00')).toBeDefined()
  })

  it('should apply custom className', () => {
    const { container } = render(<AmountDisplay cents={10000} className="custom-class" />)
    expect(container.querySelector('.custom-class')).toBeDefined()
  })

  it('should apply custom style', () => {
    const { container } = render(<AmountDisplay cents={10000} style={{ color: 'red' }} />)
    const span = container.querySelector('span')
    expect(span?.style.color).toBe('red')
  })
})
