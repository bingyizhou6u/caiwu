import React, { useState, useEffect } from 'react'
import { Layout, Menu, Button, Dropdown, Avatar, Tabs, Spin } from 'antd'
import { UserOutlined, LogoutOutlined, DownOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { useAuth } from '../context/AuthContext'
import { buildMenuItems, pageTitles } from '../config/menu'
import { AppRouter } from '../router/AppRouter'
import { api } from '../config/api'

const { Header, Sider, Content } = Layout

interface TabItem {
    key: string
    label: string
    closable: boolean
}

export const MainLayout: React.FC = () => {
    const { user, logout } = useAuth()
    const [apiOk, setApiOk] = useState(false)

    // Tabs state
    const [tabs, setTabs] = useState<TabItem[]>(() => {
        const saved = localStorage.getItem('tabs')
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                return parsed.length > 0 ? parsed : [{ key: 'dashboard', label: '首页', closable: false }]
            } catch {
                return [{ key: 'dashboard', label: '首页', closable: false }]
            }
        }
        return [{ key: 'dashboard', label: '首页', closable: false }]
    })

    const [selected, setSelected] = useState(() => {
        const saved = localStorage.getItem('selectedPage')
        return saved || 'dashboard'
    })

    const [openKeys, setOpenKeys] = useState<string[]>(() => {
        const saved = localStorage.getItem('openMenuKeys')
        return saved ? JSON.parse(saved) : []
    })

    useEffect(() => {
        fetch(api.health).then(r => r.json()).then(d => setApiOk(!!d.db)).catch(() => setApiOk(false))
    }, [])

    useEffect(() => {
        setTabs(prevTabs => {
            const existingTab = prevTabs.find(tab => tab.key === selected)
            if (existingTab) {
                return prevTabs
            }
            const title = pageTitles[selected] || selected
            const newTabs = [...prevTabs, { key: selected, label: title, closable: selected !== 'dashboard' }]
            localStorage.setItem('tabs', JSON.stringify(newTabs))
            return newTabs
        })
    }, [selected])

    const addOrActivateTab = (key: string) => {
        const title = pageTitles[key] || key
        setTabs(prevTabs => {
            const existingTab = prevTabs.find(tab => tab.key === key)
            if (existingTab) {
                return prevTabs
            }
            const newTabs = [...prevTabs, { key, label: title, closable: key !== 'dashboard' }]
            localStorage.setItem('tabs', JSON.stringify(newTabs))
            return newTabs
        })
        setSelected(key)
        localStorage.setItem('selectedPage', key)
    }

    const removeTab = (targetKey: string, e?: React.MouseEvent) => {
        e?.stopPropagation()
        if (targetKey === 'dashboard') return

        setTabs(prevTabs => {
            const newTabs = prevTabs.filter(tab => tab.key !== targetKey)
            localStorage.setItem('tabs', JSON.stringify(newTabs))

            if (targetKey === selected) {
                const currentIndex = prevTabs.findIndex(tab => tab.key === targetKey)
                let newSelected = 'dashboard'
                if (currentIndex > 0) {
                    newSelected = prevTabs[currentIndex - 1].key
                } else if (newTabs.length > 0) {
                    newSelected = newTabs[0].key
                }
                setSelected(newSelected)
                localStorage.setItem('selectedPage', newSelected)
            }
            return newTabs
        })
    }

    const closeOtherTabs = (targetKey: string) => {
        if (targetKey === 'dashboard') {
            setTabs([{ key: 'dashboard', label: '首页', closable: false }])
            localStorage.setItem('tabs', JSON.stringify([{ key: 'dashboard', label: '首页', closable: false }]))
            setSelected('dashboard')
            localStorage.setItem('selectedPage', 'dashboard')
        } else {
            const newTabs = tabs.filter(tab => tab.key === targetKey || tab.key === 'dashboard')
            setTabs(newTabs)
            localStorage.setItem('tabs', JSON.stringify(newTabs))
            setSelected(targetKey)
            localStorage.setItem('selectedPage', targetKey)
        }
    }

    const closeLeftTabs = (targetKey: string) => {
        const currentIndex = tabs.findIndex(tab => tab.key === targetKey)
        if (currentIndex <= 0) return
        const newTabs = tabs.filter((tab, index) => index >= currentIndex || tab.key === 'dashboard')
        setTabs(newTabs)
        localStorage.setItem('tabs', JSON.stringify(newTabs))
        setSelected(targetKey)
        localStorage.setItem('selectedPage', targetKey)
    }

    const closeRightTabs = (targetKey: string) => {
        const currentIndex = tabs.findIndex(tab => tab.key === targetKey)
        if (currentIndex < 0 || currentIndex >= tabs.length - 1) return
        const newTabs = tabs.filter((tab, index) => index <= currentIndex)
        setTabs(newTabs)
        localStorage.setItem('tabs', JSON.stringify(newTabs))
        setSelected(targetKey)
        localStorage.setItem('selectedPage', targetKey)
    }

    const closeAllTabs = () => {
        setTabs([{ key: 'dashboard', label: '首页', closable: false }])
        localStorage.setItem('tabs', JSON.stringify([{ key: 'dashboard', label: '首页', closable: false }]))
        setSelected('dashboard')
        localStorage.setItem('selectedPage', 'dashboard')
    }

    const handleLogout = async () => {
        await logout()
        setSelected('dashboard')
        setOpenKeys([])
        setTabs([{ key: 'dashboard', label: '首页', closable: false }])
    }

    const userMenu: MenuProps['items'] = [
        {
            key: 'profile',
            label: (
                <div style={{ padding: '4px 0' }}>
                    <div style={{ fontWeight: 'bold' }}>{user?.name}</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>{user?.email}</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>{user?.role}</div>
                </div>
            ),
        },
        { type: 'divider' },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: '退出登录',
            onClick: handleLogout,
        },
    ]

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider width={220} theme="dark" style={{ overflow: 'auto', height: '100vh', position: 'fixed', left: 0, top: 0, bottom: 0 }}>
                <div style={{ height: 64, margin: 16, background: 'rgba(255, 255, 255, 0.2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                    AR公司管理系统
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[selected]}
                    openKeys={openKeys}
                    onOpenChange={(keys) => {
                        setOpenKeys(keys)
                        localStorage.setItem('openMenuKeys', JSON.stringify(keys))
                    }}
                    items={buildMenuItems(user?.role || '', user)}
                    onClick={({ key }) => addOrActivateTab(key)}
                />
            </Sider>
            <Layout style={{ marginLeft: 220 }}>
                <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,21,41,0.08)', zIndex: 1 }}>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <Tabs
                            hideAdd
                            type="editable-card"
                            activeKey={selected}
                            items={tabs.map(tab => ({
                                key: tab.key,
                                label: (
                                    <Dropdown
                                        menu={{
                                            items: [
                                                { key: 'close', label: '关闭当前', disabled: tab.key === 'dashboard', onClick: (e) => removeTab(tab.key, e as any) },
                                                { key: 'closeOther', label: '关闭其他', onClick: () => closeOtherTabs(tab.key) },
                                                { key: 'closeLeft', label: '关闭左侧', disabled: tabs.findIndex(t => t.key === tab.key) <= 0, onClick: () => closeLeftTabs(tab.key) },
                                                { key: 'closeRight', label: '关闭右侧', disabled: tabs.findIndex(t => t.key === tab.key) >= tabs.length - 1, onClick: () => closeRightTabs(tab.key) },
                                                { key: 'closeAll', label: '关闭全部', onClick: closeAllTabs },
                                            ]
                                        }}
                                        trigger={['contextMenu']}
                                    >
                                        <span>{tab.label}</span>
                                    </Dropdown>
                                ),
                                closable: tab.closable,
                            }))}
                            onChange={(key) => {
                                setSelected(key)
                                localStorage.setItem('selectedPage', key)
                            }}
                            onEdit={(targetKey, action) => {
                                if (action === 'remove') {
                                    removeTab(targetKey as string)
                                }
                            }}
                            tabBarStyle={{ margin: 0, border: 'none' }}
                        />
                    </div>
                    <div style={{ marginLeft: 16 }}>
                        <Dropdown menu={{ items: userMenu }} placement="bottomRight">
                            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff', marginRight: 8 }} />
                                <span style={{ marginRight: 8 }}>{user?.name}</span>
                                <DownOutlined style={{ fontSize: 12 }} />
                            </div>
                        </Dropdown>
                    </div>
                </Header>
                <Content style={{ margin: '24px 16px 0', overflow: 'initial' }}>
                    <div style={{ padding: 24, background: '#fff', minHeight: 360, borderRadius: 4 }}>
                        <AppRouter pageKey={selected} />
                    </div>
                </Content>
            </Layout>
        </Layout>
    )
}
