export const parsePhone = (phone: string | undefined): { countryCode: string, phoneNumber: string } => {
    if (!phone) return { countryCode: '+971', phoneNumber: '' }

    // 如果包含+号，尝试解析
    const match = phone.match(/^(\+\d{1,4})(.*)$/)
    if (match) {
        return { countryCode: match[1], phoneNumber: match[2].replace(/[^\d]/g, '') }
    }

    // 如果没有+号，默认阿联酋区号
    return { countryCode: '+971', phoneNumber: phone.replace(/[^\d]/g, '') }
}

export const combinePhone = (countryCode: string, phoneNumber: string): string => {
    if (!phoneNumber) return ''
    return `${countryCode}${phoneNumber}`
}
