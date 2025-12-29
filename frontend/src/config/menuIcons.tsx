import {
    UserOutlined,
    CalendarOutlined,
    FileTextOutlined,
    DollarOutlined,
    WalletOutlined,
    BankOutlined,
    TeamOutlined,
    ShopOutlined,
    HomeOutlined,
    BarChartOutlined,
    SettingOutlined,
    PlusOutlined,
    SwapOutlined,
    TransactionOutlined,
    ImportOutlined,
    CreditCardOutlined,
    AccountBookOutlined,
    FileProtectOutlined,
    UsergroupAddOutlined,
    MoneyCollectOutlined,
    GiftOutlined,
    AuditOutlined,
    ApartmentOutlined,
    TagsOutlined,
    AccountBookFilled,
    GlobalOutlined,
    SafetyOutlined,
    HistoryOutlined,
    KeyOutlined,
    AppstoreOutlined,
    FileSearchOutlined,
    LineChartOutlined,
    PieChartOutlined,
    TableOutlined,
    BuildOutlined,
    BookOutlined,
    ThunderboltFilled,
    ProjectOutlined,
    ClockCircleOutlined,
    CheckSquareOutlined,
} from '@ant-design/icons'
import React from 'react'

// 菜单图标映射
export const menuIcons: Record<string, React.ReactNode> = {
    // 一级菜单
    'my': <UserOutlined />,
    'finance': <DollarOutlined />,
    'employees': <TeamOutlined />,
    'sites': <ShopOutlined />,
    'fixed-assets-menu': <HomeOutlined />,
    'reports': <BarChartOutlined />,
    'system': <SettingOutlined />,

    // 我的工作台
    'my-center': <UserOutlined />,
    'my-tasks': <CheckSquareOutlined />,
    'my-leaves': <CalendarOutlined />,
    'my-reimbursements': <FileTextOutlined />,
    'my-borrowings': <CreditCardOutlined />,
    'my-assets': <HomeOutlined />,
    'company-policies': <BookOutlined />,
    'my-approvals': <AuditOutlined />,

    // 财务管理
    'flow-create': <PlusOutlined />,
    'flows': <TransactionOutlined />,
    'account-transfer': <SwapOutlined />,
    'account-transactions': <AccountBookOutlined />,
    'import': <ImportOutlined />,
    'borrowings': <CreditCardOutlined />,
    'repayments': <WalletOutlined />,
    'ar': <FileProtectOutlined />,
    'ap': <FileProtectOutlined />,
    'finance-settings': <BuildOutlined />,
    'category': <TagsOutlined />,
    'account': <BankOutlined />,
    'currency': <GlobalOutlined />,
    'vendor': <ShopOutlined />,

    // 人力资源
    'employee': <TeamOutlined />,
    'employee-salary': <MoneyCollectOutlined />,
    'salary-payments': <DollarOutlined />,
    'allowance-payments': <GiftOutlined />,
    'employee-leave': <CalendarOutlined />,
    'expense-reimbursement': <FileTextOutlined />,

    // 站点管理
    'site-management': <ShopOutlined />,
    'site-bills': <AccountBookOutlined />,

    // 资产管理
    'fixed-assets': <HomeOutlined />,
    'rental-management': <HomeOutlined />,

    // 报表中心
    'report-finance': <PieChartOutlined />,
    'report-arap': <TableOutlined />,
    'report-operation': <LineChartOutlined />,
    'report-dept-cash': <BarChartOutlined />,
    'report-site-growth': <LineChartOutlined />,
    'report-ar-summary': <FileSearchOutlined />,
    'report-ar-detail': <FileSearchOutlined />,
    'report-ap-summary': <FileSearchOutlined />,
    'report-ap-detail': <FileSearchOutlined />,
    'report-expense-summary': <BarChartOutlined />,
    'report-expense-detail': <TableOutlined />,
    'report-account-balance': <AccountBookFilled />,
    'report-borrowing': <CreditCardOutlined />,

    // 系统设置
    'department': <ApartmentOutlined />,
    'position-permissions': <SafetyOutlined />,
    'email-notification': <FileTextOutlined />,

    'audit': <HistoryOutlined />,


    // 项目管理 (PM)
    'pm': <ProjectOutlined />,
    'pm-config': <SettingOutlined />,
    'pm-projects': <ProjectOutlined />,
    'pm-kanban': <AppstoreOutlined />,
    'pm-timelogs': <ClockCircleOutlined />,
}

// 获取菜单图标
export const getMenuIcon = (key: string): React.ReactNode => {
    return menuIcons[key] || <AppstoreOutlined />
}
