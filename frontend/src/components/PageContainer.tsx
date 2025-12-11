import React from 'react'
import { Breadcrumb } from 'antd'
import { Link } from 'react-router-dom'
import './PageContainer.css'

interface BreadcrumbItem {
    title: React.ReactNode
    path?: string
    onClick?: () => void
}

interface PageContainerProps {
    title?: React.ReactNode
    breadcrumb?: BreadcrumbItem[]
    extra?: React.ReactNode
    children: React.ReactNode
    className?: string
}

export function PageContainer({
    title,
    breadcrumb,
    extra,
    children,
    className = ''
}: PageContainerProps) {
    return (
        <div className={`page-container animate-fade-in ${className}`}>
            {(title || breadcrumb || extra) && (
                <div className="page-header">
                    <div className="page-header-left">
                        {breadcrumb && (
                            <Breadcrumb
                                items={breadcrumb.map(item => ({
                                    title: item.path ? (
                                        <Link to={item.path}>{item.title}</Link>
                                    ) : item.onClick ? (
                                        <span style={{ cursor: 'pointer' }} onClick={item.onClick}>
                                            {item.title}
                                        </span>
                                    ) : (
                                        item.title
                                    )
                                }))}
                                style={{ marginBottom: title ? 8 : 0 }}
                            />
                        )}
                        {title && <h1 className="page-title">{title}</h1>}
                    </div>
                    {extra && <div className="page-extra">{extra}</div>}
                </div>
            )}
            <div className="page-content">
                {children}
            </div>
        </div>
    )
}
