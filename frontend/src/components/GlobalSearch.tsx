import { useState, useMemo } from 'react'
import { Select, Tag } from 'antd'
import { SearchOutlined, UserOutlined, BankOutlined, ShopOutlined, LaptopOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useEmployees } from '../hooks/business/useEmployees'
import { useFixedAssets } from '../hooks/business/useFixedAssets'
import { useVendors } from '../hooks/business/useVendors'
import { useAccounts } from '../hooks/business/useAccounts'
import { useDebounce } from '../hooks/useDebounce'

const { Option, OptGroup } = Select

export function GlobalSearch() {
    const navigate = useNavigate()
    const [searchValue, setSearchValue] = useState('')
    const debouncedSearch = useDebounce(searchValue, 500)

    // Queries
    const { data: employees = [], isFetching: loadingEmployees } = useEmployees({ search: debouncedSearch })
    const { data: assets = [], isFetching: loadingAssets } = useFixedAssets({ search: debouncedSearch })
    const { data: vendors = [], isFetching: loadingVendors } = useVendors({ search: debouncedSearch })
    const { data: accounts = [], isFetching: loadingAccounts } = useAccounts({ search: debouncedSearch })

    const loading = loadingEmployees || loadingAssets || loadingVendors || loadingAccounts

    const options = useMemo(() => {
        if (!debouncedSearch) {
            return []
        }

        const newOptions = []

        if (employees?.length > 0) {
            newOptions.push({
                label: <span><UserOutlined /> 员工</span>,
                options: employees.slice(0, 5).map((emp: any) => ({
                    value: `employee:${emp.id}`,
                    label: (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{emp.name}</span>
                            <span style={{ color: '#999', fontSize: 12 }}>{emp.department_name}</span>
                        </div>
                    ),
                    type: 'employee',
                    data: emp
                }))
            })
        }

        if (assets?.length > 0) {
            newOptions.push({
                label: <span><LaptopOutlined /> 固定资产</span>,
                options: assets.slice(0, 5).map((asset: any) => ({
                    value: `asset:${asset.id}`,
                    label: (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{asset.name}</span>
                            <span style={{ color: '#999', fontSize: 12 }}>{asset.asset_code}</span>
                        </div>
                    ),
                    type: 'asset',
                    data: asset
                }))
            })
        }

        if (vendors?.length > 0) {
            newOptions.push({
                label: <span><ShopOutlined /> 供应商</span>,
                options: vendors.slice(0, 5).map((vendor: any) => ({
                    value: `vendor:${vendor.id}`,
                    label: vendor.name,
                    type: 'vendor',
                    data: vendor
                }))
            })
        }

        if (accounts?.length > 0) {
            newOptions.push({
                label: <span><BankOutlined /> 账户</span>,
                options: accounts.slice(0, 5).map((acc: any) => ({
                    value: `account:${acc.id}`,
                    label: (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{acc.name}</span>
                            <Tag>{acc.currency}</Tag>
                        </div>
                    ),
                    type: 'account',
                    data: acc
                }))
            })
        }

        return newOptions
    }, [debouncedSearch, employees, assets, vendors, accounts])

    const handleSelect = (value: string, option: any) => {
        const { type, data } = option
        switch (type) {
            case 'employee':
                // Navigate to employee management and maybe open modal?
                // For now just navigate to list
                navigate('/employees')
                break
            case 'asset':
                navigate('/fixed-assets/list')
                break
            case 'vendor':
                navigate('/system/vendors')
                break
            case 'account':
                navigate('/system/accounts')
                break
        }
        setSearchValue('')
    }

    return (
        <Select
            className="global-search-input"
            showSearch
            value={searchValue}
            placeholder="搜索 (Ctrl+K)"
            defaultActiveFirstOption={false}
            showArrow={false}
            filterOption={false}
            onSearch={setSearchValue}
            onChange={handleSelect}
            notFoundContent={loading ? '搜索中...' : null}
            options={options}
            suffixIcon={<SearchOutlined />}
            allowClear
            variant="borderless"
        />
    )
}
