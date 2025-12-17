import { render, screen } from '@testing-library/react'
import { VirtualTable } from '../common/VirtualTable'
import { describe, it, expect, vi } from 'vitest'

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
}

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
})

describe('VirtualTable', () => {
    it('renders without crashing', () => {
        const columns = [
            { title: 'Name', dataIndex: 'name', width: 100 },
            { title: 'Age', dataIndex: 'age', width: 100 },
        ]
        const data = Array.from({ length: 100 }, (_, i) => ({
            id: i,
            name: `User ${i}`,
            age: 20 + (i % 30),
        }))

        render(
            <VirtualTable
                columns={columns}
                dataSource={data}
                rowKey="id"
                scroll={{ y: 500 }}
            />
        )

        // Since it's virtualized, we might not see all rows, but we should see some.
        // rc-virtual-list renders items in a specific way.
        // We can check if the table structure exists.
        expect(screen.getByRole('table')).toBeInTheDocument()
    })
})
