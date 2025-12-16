import React from 'react'
import { Breadcrumb, Spin } from 'antd'
import { Link } from 'react-router-dom'
import { ErrorBoundary } from './ErrorBoundary'
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
    loading?: boolean
    errorBoundary?: boolean
    errorFallback?: React.ReactNode
}

export function PageContainer({
    title,
    breadcrumb,
    extra,
    children,
    className = '',
    loading = false,
    errorBoundary = true,
    errorFallback,
}: PageContainerProps) {
    const content = (
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
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '50px 0' }}>
                        <Spin size="large" />
                    </div>
                ) : (
                    children
                )}
            </div>
        </div>
    )

    if (errorBoundary) {
        return (
            <ErrorBoundary fallback={errorFallback}>
                {content}
            </ErrorBoundary>
        )
    }

    return content
}
