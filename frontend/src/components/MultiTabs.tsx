import React, { useEffect, useState } from 'react'
import { Tabs } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import { pageTitles, KEY_TO_PATH } from '../config/menu'

interface TabItem {
    key: string
    label: string
    closable: boolean
}

export const MultiTabs: React.FC = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const [items, setItems] = useState<TabItem[]>([
        { key: '/dashboard', label: '仪表盘', closable: false }
    ])
    const [activeKey, setActiveKey] = useState<string>('/dashboard')

    // Sync location with tabs
    useEffect(() => {
        const path = location.pathname
        if (path === '/' || path === '/login') return

        setActiveKey(path)

        // Check if tab exists
        const exists = items.find(item => item.key === path)
        if (!exists) {
            let title = '未命名页面'

            // Find key by path
            const entry = Object.entries(KEY_TO_PATH).find(([_, p]) => p === path)
            if (entry) {
                const key = entry[0]
                title = pageTitles[key] || title
            } else {
                // Fallback: try to match path suffix if exact match fails
                // e.g. /hr/employees/123 -> match /hr/employees?
                // For now, simple exact match is enough for main menu items.
                // For detail pages, we might want to show "Detail".
            }

            setItems(prev => [...prev, { key: path, label: title, closable: true }])
        }
    }, [location.pathname])

    const onChange = (key: string) => {
        navigate(key)
    }

    const onEdit = (targetKey: React.MouseEvent | React.KeyboardEvent | string, action: 'add' | 'remove') => {
        if (action === 'remove') {
            remove(targetKey as string)
        }
    }

    const remove = (targetKey: string) => {
        const targetIndex = items.findIndex((item) => item.key === targetKey)
        const newItems = items.filter((item) => item.key !== targetKey)

        if (newItems.length && targetKey === activeKey) {
            const { key } = newItems[targetIndex === newItems.length ? targetIndex - 1 : targetIndex]
            setActiveKey(key)
            navigate(key)
        }
        setItems(newItems)
    }

    return (
        <Tabs
            type="editable-card"
            hideAdd
            activeKey={activeKey}
            items={items}
            onChange={onChange}
            onEdit={onEdit}
            tabBarStyle={{ margin: 0, background: '#f0f2f5', paddingTop: 6, paddingLeft: 16, paddingRight: 16 }}
        />
    )
}
