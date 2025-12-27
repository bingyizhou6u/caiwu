import React, { useEffect, useState } from 'react'
import { Tabs, Dropdown, MenuProps } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import { ReloadOutlined, CloseOutlined, ArrowRightOutlined, BlockOutlined } from '@ant-design/icons'
import { pageTitles, KEY_TO_PATH } from '../../config/menu'
import '../../styles/layouts/multi-tabs.css'

interface TabItem {
    key: string
    label: string
    closable: boolean
}

export const MultiTabs: React.FC = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const [items, setItems] = useState<TabItem[]>([
        { key: '/my/center', label: '个人中心', closable: false }
    ])
    const [activeKey, setActiveKey] = useState<string>('/my/center')

    // Sync location with tabs
    useEffect(() => {
        const path = location.pathname
        if (path === '/' || path === '/login') return

        setActiveKey(path)

        // Check if tab exists
        setItems(prev => {
            const exists = prev.find(item => item.key === path)
            if (!exists) {
                let title = '未命名页面'

                // 1. 先尝试精确匹配
                const entry = Object.entries(KEY_TO_PATH).find(([_, p]) => p === path)
                if (entry) {
                    const key = entry[0]
                    title = pageTitles[key] || title
                } else {
                    // 2. 尝试从 document.title 获取
                    const docTitle = document.title
                    if (docTitle && !docTitle.includes('未命名') && docTitle !== 'AR财务系统') {
                        title = docTitle.replace(' - AR财务系统', '')
                    } else {
                        // 3. 根据路径模式设置默认标题
                        if (path.startsWith('/pm/projects/') && path !== '/pm/projects') {
                            title = '项目详情'
                        } else if (path.startsWith('/pm/tasks/') && path.includes('/edit')) {
                            title = '编辑任务'
                        } else if (path === '/pm/tasks/new') {
                            title = '新建任务'
                        }
                    }
                }

                return [...prev, { key: path, label: title, closable: true }]
            }
            return prev
        })
    }, [location.pathname])

    // 监听 document.title 变化，更新当前标签名
    useEffect(() => {
        const observer = new MutationObserver(() => {
            const path = location.pathname
            const docTitle = document.title
            if (docTitle && !docTitle.includes('未命名') && docTitle !== 'AR财务系统') {
                const title = docTitle.replace(' - AR财务系统', '')
                setItems(prev => prev.map(item =>
                    item.key === path && item.label === '项目详情'
                        ? { ...item, label: title }
                        : item
                ))
            }
        })

        const titleElement = document.querySelector('title')
        if (titleElement) {
            observer.observe(titleElement, { childList: true, subtree: true, characterData: true })
        }

        return () => observer.disconnect()
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

    // Context Menu Actions
    const handleMenuClick = (key: string, action: string) => {
        switch (action) {
            case 'refresh':
                navigate(0) // Simple reload
                break
            case 'close':
                remove(key)
                break
            case 'closeOthers':
                const newItemsOthers = items.filter(item => item.key === key || item.key === '/my/center')
                setItems(newItemsOthers)
                if (activeKey !== key) {
                    setActiveKey(key)
                    navigate(key)
                }
                break
            case 'closeRight':
                const index = items.findIndex(item => item.key === key)
                const newItemsRight = items.slice(0, index + 1)
                setItems(newItemsRight)
                if (items.findIndex(item => item.key === activeKey) > index) {
                    setActiveKey(key)
                    navigate(key)
                }
                break
            case 'closeAll':
                const newItemsAll = items.filter(item => item.key === '/my/center')
                setItems(newItemsAll)
                setActiveKey('/my/center')
                navigate('/my/center')
                break
        }
    }

    const renderTabLabel = (item: TabItem) => {
        const menuItems: MenuProps['items'] = [
            {
                key: 'refresh',
                label: '刷新',
                icon: <ReloadOutlined />,
                onClick: () => handleMenuClick(item.key, 'refresh')
            },
            {
                key: 'close',
                label: '关闭当前',
                icon: <CloseOutlined />,
                disabled: !item.closable,
                onClick: () => handleMenuClick(item.key, 'close')
            },
            {
                key: 'closeOthers',
                label: '关闭其他',
                icon: <BlockOutlined />,
                onClick: () => handleMenuClick(item.key, 'closeOthers')
            },
            {
                key: 'closeRight',
                label: '关闭右侧',
                icon: <ArrowRightOutlined />,
                onClick: () => handleMenuClick(item.key, 'closeRight')
            },
            {
                key: 'closeAll',
                label: '关闭全部',
                icon: <CloseOutlined />,
                onClick: () => handleMenuClick(item.key, 'closeAll')
            }
        ]

        return (
            <Dropdown menu={{ items: menuItems }} trigger={['contextMenu']}>
                <span className="tab-label-container">
                    {item.label}
                </span>
            </Dropdown>
        )
    }

    return (
        <Tabs
            className="multi-tabs-wrapper"
            type="editable-card"
            hideAdd
            activeKey={activeKey}
            items={items.map(item => ({
                key: item.key,
                label: renderTabLabel(item),
                closable: item.closable
            }))}
            onChange={onChange}
            onEdit={onEdit}
        />
    )
}
