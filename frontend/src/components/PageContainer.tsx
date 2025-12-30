import React, { useEffect } from 'react'
import { Breadcrumb, Spin } from 'antd'
import { Link } from 'react-router-dom'
import { ErrorBoundary } from './ErrorBoundary'
import styles from './common/common.module.css'
import '../styles/layouts/page-container.css'

interface BreadcrumbItem {
    title: React.ReactNode
    path?: string
    onClick?: () => void
}

interface PageContainerProps {
    title?: React.ReactNode
    /** 用于浏览器标签的纯文本标题 */
    documentTitle?: string
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
    documentTitle,
    breadcrumb,
    extra,
    children,
    className = '',
    loading = false,
    errorBoundary = true,
    errorFallback,
}: PageContainerProps) {
    // 设置浏览器标签标题
    useEffect(() => {
        const pageTitle = documentTitle || (typeof title === 'string' ? title : null)
        if (pageTitle) {
            document.title = `${pageTitle} - AR财务系统`
        }
    }, [title, documentTitle])
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
                                        <span className="cursor-pointer" onClick={item.onClick}>
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
                    <div className={styles.loadingContainerSm}>
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
