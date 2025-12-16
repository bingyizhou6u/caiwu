/**
 * React Query 乐观更新工具函数
 * 提供通用的乐观更新模式
 */

import { QueryClient } from '@tanstack/react-query'

/**
 * 乐观更新配置
 */
export interface OptimisticUpdateConfig<TData, TVariables> {
  /** 查询键 */
  queryKey: any[]
  /** 更新函数：根据变量计算新的数据 */
  updateFn: (oldData: TData | undefined, variables: TVariables) => TData
  /** 回滚函数（可选）：如果更新失败，用于恢复数据 */
  rollbackFn?: (oldData: TData | undefined) => void
}

/**
 * 创建乐观更新的 mutation 配置
 * 
 * @example
 * ```tsx
 * const { mutateAsync } = useMutation({
 *   mutationFn: updateTodo,
 *   onMutate: createOptimisticUpdater({
 *     queryKey: ['todos'],
 *     updateFn: (oldData, newTodo) => [...oldData, newTodo]
 *   }),
 *   onError: (err, variables, context) => {
 *     // 回滚
 *     queryClient.setQueryData(['todos'], context.previousData)
 *   },
 *   onSettled: () => {
 *     queryClient.invalidateQueries({ queryKey: ['todos'] })
 *   }
 * })
 * ```
 */
export function createOptimisticUpdater<TData, TVariables>(
  config: OptimisticUpdateConfig<TData, TVariables>
) {
  return async (variables: TVariables, queryClient: QueryClient) => {
    // 取消正在进行的查询，避免覆盖乐观更新
    await queryClient.cancelQueries({ queryKey: config.queryKey })

    // 保存当前数据快照
    const previousData = queryClient.getQueryData<TData>(config.queryKey)

    // 乐观更新
    queryClient.setQueryData<TData>(
      config.queryKey,
      (oldData) => config.updateFn(oldData, variables)
    )

    // 返回上下文，用于错误回滚
    return { previousData }
  }
}

/**
 * 创建列表项的乐观更新器（添加）
 */
export function createOptimisticAdd<TItem>(
  queryKey: any[],
  getNewItem: (variables: any) => TItem
) {
  return createOptimisticUpdater<TItem[], any>({
    queryKey,
    updateFn: (oldData = [], variables) => [...oldData, getNewItem(variables)],
  })
}

/**
 * 创建列表项的乐观更新器（更新）
 */
export function createOptimisticUpdate<TItem extends { id: string }>(
  queryKey: any[],
  getId: (variables: any) => string,
  getUpdatedItem: (oldItem: TItem, variables: any) => TItem
) {
  return createOptimisticUpdater<TItem[], any>({
    queryKey,
    updateFn: (oldData = [], variables) =>
      oldData.map((item) =>
        item.id === getId(variables)
          ? getUpdatedItem(item, variables)
          : item
      ),
  })
}

/**
 * 创建列表项的乐观更新器（删除）
 */
export function createOptimisticDelete<TItem extends { id: string }>(
  queryKey: any[],
  getId: (variables: any) => string
) {
  return createOptimisticUpdater<TItem[], any>({
    queryKey,
    updateFn: (oldData = [], variables) =>
      oldData.filter((item) => item.id !== getId(variables)),
  })
}

/**
 * 创建分页列表的乐观更新器（添加）
 */
export function createOptimisticAddToPaginated<TItem>(
  queryKey: any[],
  getNewItem: (variables: any) => TItem
) {
  return createOptimisticUpdater<{ total: number; list: TItem[] }, any>({
    queryKey,
    updateFn: (oldData = { total: 0, list: [] }, variables) => ({
      total: oldData.total + 1,
      list: [...oldData.list, getNewItem(variables)],
    }),
  })
}

/**
 * 创建分页列表的乐观更新器（更新）
 */
export function createOptimisticUpdatePaginated<TItem extends { id: string }>(
  queryKey: any[],
  getId: (variables: any) => string,
  getUpdatedItem: (oldItem: TItem, variables: any) => TItem
) {
  return createOptimisticUpdater<{ total: number; list: TItem[] }, any>({
    queryKey,
    updateFn: (oldData = { total: 0, list: [] }, variables) => ({
      ...oldData,
      list: oldData.list.map((item) =>
        item.id === getId(variables)
          ? getUpdatedItem(item, variables)
          : item
      ),
    }),
  })
}

/**
 * 创建分页列表的乐观更新器（删除）
 */
export function createOptimisticDeleteFromPaginated<TItem extends { id: string }>(
  queryKey: any[],
  getId: (variables: any) => string
) {
  return createOptimisticUpdater<{ total: number; list: TItem[] }, any>({
    queryKey,
    updateFn: (oldData = { total: 0, list: [] }, variables) => ({
      total: Math.max(0, oldData.total - 1),
      list: oldData.list.filter((item) => item.id !== getId(variables)),
    }),
  })
}

