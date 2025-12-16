import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Table, theme } from 'antd';
import type { TableProps, ColumnsType } from 'antd';
import List from 'rc-virtual-list';
import ResizeObserver from 'rc-resize-observer';

export interface VirtualTableProps<RecordType> extends TableProps<RecordType> {
    scroll?: {
        x?: number | string | true;
        y?: number | string;
    };
}

export function VirtualTable<RecordType extends object>(props: VirtualTableProps<RecordType>) {
    const { columns, scroll, dataSource, ...tableProps } = props;
    const [tableWidth, setTableWidth] = useState(0);
    const { token } = theme.useToken();

    const widthColumnCount = columns!.filter(({ width }) => !width).length;
    const mergedColumns = columns!.map((column) => {
        if (column.width) {
            return column;
        }
        return {
            ...column,
            width: Math.floor(tableWidth / widthColumnCount),
        };
    });

    const gridRef = useRef<{ scrollLeft?: number; scrollTo?: (options: { left: number }) => void; resetAfterIndex?: (index: number) => void } | null>(null);
    const [connectObject] = useState<{ scrollLeft?: number }>(() => {
        const obj = {};
        Object.defineProperty(obj, 'scrollLeft', {
            get: () => {
                if (gridRef.current) {
                    return gridRef.current?.scrollLeft;
                }
                return null;
            },
            set: (scrollLeft: number) => {
                if (gridRef.current) {
                    gridRef.current.scrollTo({ left: scrollLeft });
                }
            },
        });
        return obj;
    });

    const resetVirtualGrid = () => {
        gridRef.current?.resetAfterIndex(0);
    };

    useEffect(() => resetVirtualGrid, [tableWidth]);

    interface VirtualListParams {
        scrollbarSize?: number
        ref: React.MutableRefObject<unknown>
        onScroll?: (e: { currentTarget: HTMLElement }) => void
    }

    const renderVirtualList = (rawData: readonly RecordType[], { scrollbarSize, ref, onScroll }: VirtualListParams) => {
        ref.current = connectObject;
        const totalHeight = rawData.length * 54;

        return (
            <List
                ref={gridRef}
                data={rawData as RecordType[]}
                height={scroll!.y as number}
                itemHeight={54}
                itemKey={(item: RecordType) => {
                    const rowKey = props.rowKey
                    if (typeof rowKey === 'string') {
                        return (item as Record<string, unknown>)[rowKey] as string || (item as { id?: string }).id || ''
                    }
                    if (typeof rowKey === 'function') {
                        return rowKey(item) || ''
                    }
                    return (item as { id?: string }).id || ''
                }}
                onScroll={onScroll}
            >
                {(item: RecordType, index: number) => {
                    const style: React.CSSProperties = {
                        display: 'flex',
                        boxSizing: 'border-box',
                        width: '100%',
                    };
                    // Handle selection checkbox if rowSelection is present (simplified)
                    // Note: Full rowSelection support in virtual table is complex. 
                    // This implementation focuses on display performance.

                    return (
                        <div
                            style={{
                                ...style,
                                background: index % 2 === 1 ? token.colorFillAlter : 'transparent', // Zebra striping
                            }}
                            className="virtual-table-row"
                        >
                            {mergedColumns.map((column, i) => {
                                const { dataIndex, render, align = 'left' } = column;
                                const value = dataIndex ? (item as Record<string, unknown>)[dataIndex] : item;
                                const text = render ? render(value, item, index) : value;

                                return (
                                    <div
                                        key={dataIndex || i}
                                        style={{
                                            flex: 1,
                                            width: column.width,
                                            maxWidth: column.width,
                                            padding: token.padding,
                                            boxSizing: 'border-box',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            textAlign: align,
                                            borderBottom: `1px solid ${token.colorSplit}`,
                                        }}
                                    >
                                        {text}
                                    </div>
                                );
                            })}
                        </div>
                    );
                }}
            </List>
        );
    };

    return (
        <ResizeObserver
            onResize={({ width }) => {
                setTableWidth(width);
            }}
        >
            <Table
                {...tableProps}
                className="virtual-table"
                columns={mergedColumns}
                pagination={false}
                components={{
                    body: renderVirtualList as TableProps<RecordType>['components']['body'],
                }}
            />
        </ResizeObserver>
    );
}
