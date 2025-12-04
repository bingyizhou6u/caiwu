import { z } from 'zod'

// IPv4 Regex
const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/(?:[0-9]|[1-2][0-9]|3[0-2]))?$/

// IPv6 Regex (Simple version, covers most cases)
const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))(?:\/(?:[0-9]|[1-9][0-9]|1[0-1][0-9]|12[0-8]))?$/i

export const ipWhitelistSchema = z.object({
    ip_address: z.string().min(1, '请输入IP地址').refine((val) => {
        return ipv4Regex.test(val) || ipv6Regex.test(val)
    }, '请输入有效的IPv4或IPv6地址'),
    description: z.string().optional(),
})

export const ipBatchSchema = z.object({
    ips_text: z.string().min(1, '请输入IP地址列表').refine((val) => {
        const lines = val.split('\n').map(l => l.trim()).filter(l => l.length > 0)
        if (lines.length === 0) return false

        for (const line of lines) {
            if (!ipv4Regex.test(line) && !ipv6Regex.test(line)) {
                return false
            }
        }
        return true
    }, '存在无效的IP地址格式，请检查'),
    description: z.string().optional(),
})

export type IPWhitelistFormData = z.infer<typeof ipWhitelistSchema>
export type IPBatchFormData = z.infer<typeof ipBatchSchema>
