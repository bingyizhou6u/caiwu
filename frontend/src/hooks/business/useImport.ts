import { useMutation } from '@tanstack/react-query'
import { api as apiClient } from '../../api/http'
import { api } from '../../config/api'

export function useImportData() {
    return useMutation({
        mutationFn: async ({ kind, text }: { kind: string, text: string }) => {
            const response = await apiClient.post<any>(`${api.import}?kind=${kind}`, text, {
                headers: { 'Content-Type': 'text/csv' }
            })
            return response
        }
    })
}
