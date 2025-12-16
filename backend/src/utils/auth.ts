import { authenticator } from 'otplib'

// TOTP辅助函数
export function generateTotpSecret(email: string) {
  const secret = authenticator.generateSecret()
  const otpauthUrl = authenticator.keyuri(email, 'AR公司管理系统', secret)
  return { secret, otpauthUrl }
}

export function verifyTotp(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret })
  } catch {
    return false
  }
}
