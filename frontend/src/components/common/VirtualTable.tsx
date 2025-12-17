import React, { useState, useEffect, useRef } from 'react';
import { Table, theme } from 'antd';
import type { TableProps } from 'antd';
import type { ColumnType } from 'antd/es/table';
import List, { ListRef } from 'rc-virtual-list';
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

    const gridRef = useRef<ListRef>(null);
    const [connectObject] = useState<{ scrollLeft?: number }>(() => {
        const obj: { scrollLeft?: number } = {};
        Object.defineProperty(obj, 'scrollLeft', {
            get: () => {
                return gridRef.current?.getScrollInfo?.()?.x ?? null;
            },
            set: (scrollLeft: number) => {
                gridRef.current?.scrollTo?.({ left: scrollLeft });
            },
        });
        return obj;
    });

    const resetVirtualGrid = () => {
        // rc-virtual-list doesn't have resetAfterIndex, skip this
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
                                const col = column as ColumnType<RecordType>;
                                const dataIndex = col.dataIndex as string | undefined;
                                const render = col.render;
                                const align = col.align || 'left';
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
                                        {text as React.ReactNode}
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
                    body: renderVirtualList as unknown as TableProps<RecordType>['components'],
                } as TableProps<RecordType>['components']}
            />
        </ResizeObserver>
    );
}
