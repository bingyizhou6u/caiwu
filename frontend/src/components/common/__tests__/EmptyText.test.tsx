import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyText } from '../EmptyText'

describe('EmptyText', () => {
  it('should display string value', () => {
    render(<EmptyText value="Hello" />)
    expect(screen.getByText('Hello')).toBeDefined()
  })

  it('should display number value', () => {
    render(<EmptyText value={123} />)
    expect(screen.getByText('123')).toBeDefined()
  })

  it('should display empty text for null', () => {
    render(<EmptyText value={null} />)
    expect(screen.getByText('-')).toBeDefined()
  })

  it('should display empty text for undefined', () => {
    render(<EmptyText value={undefined} />)
    expect(screen.getByText('-')).toBeDefined()
  })

  it('should display empty text for empty string', () => {
    render(<EmptyText value="" />)
    expect(screen.getByText('-')).toBeDefined()
  })

  it('should display custom empty text', () => {
    render(<EmptyText value={null} emptyText="N/A" />)
    expect(screen.getByText('N/A')).toBeDefined()
  })

  it('should display zero as value', () => {
    render(<EmptyText value={0} />)
    expect(screen.getByText('0')).toBeDefined()
  })

  it('should apply custom className', () => {
    const { container } = render(<EmptyText value="test" className="custom-class" />)
    expect(container.querySelector('.custom-class')).toBeDefined()
  })

  it('should apply custom style', () => {
    const { container } = render(<EmptyText value="test" style={{ color: 'blue' }} />)
    const span = container.querySelector('span')
    expect(span?.style.color).toBe('blue')
  })
})
