
// import { EmailMessage } from "cloudflare:email"
// class EmailMessage {
//   constructor(from: string, to: string, body: string) { }
// }
import { createMimeMessage } from "mimetext"
import type { SendEmail } from '@cloudflare/workers-types'

/**
 * 发送邮件通知
 * @param env Worker环境变量
 * @param to 收件人邮箱
 * @param subject 邮件主题
 * @param htmlBody HTML邮件内容
 * @param textBody 纯文本邮件内容（可选）
 */
export async function sendEmail(
  env: { EMAIL?: SendEmail },
  to: string,
  subject: string,
  htmlBody: string,
  textBody?: string
): Promise<{ success: boolean; error?: string }> {
  // 检查是否配置了 EMAIL binding
  if (!env.EMAIL) {
    const errorMsg = 'Email binding not configured, skipping email send'
    console.warn('[Email] ' + errorMsg)
    return { success: false, error: errorMsg }
  }

  try {
    // 发件人邮箱必须使用已启用 Email Routing 的域名
    // 例如：noreply@cloudflarets.com
    const fromEmail = 'noreply@cloudflarets.com'

    // 创建 MIME 消息
    const msg = createMimeMessage()
    msg.setSender({ name: '财务系统', addr: fromEmail })
    msg.setRecipient(to)
    msg.setSubject(subject)

    // 添加 HTML 内容
    msg.addMessage({
      contentType: 'text/html',
      data: htmlBody,
    })

    // 添加纯文本内容（如果提供）
    if (textBody) {
      msg.addMessage({
        contentType: 'text/plain',
        data: textBody,
      })
    }

    // 创建 EmailMessage
    const { EmailMessage } = await import("cloudflare:email")
    const emailMessage = new EmailMessage(fromEmail, to, msg.asRaw())

    // 发送邮件
    await env.EMAIL.send(emailMessage)

    return { success: true }
  } catch (error: any) {
    const errorMsg = error.message || 'Failed to send email'
    console.error('[Email] Failed to send email to ' + to + ': ', error)
    return { success: false, error: errorMsg }
  }
}

/**
 * 发送登录提醒邮件
 */
export async function sendLoginNotificationEmail(
  env: { EMAIL?: SendEmail },
  userEmail: string,
  userName: string,
  loginTime: string,
  ipAddress?: string
): Promise<{ success: boolean; error?: string }> {
  const subject = '登录提醒 - 财务系统'

  const htmlBody = '<!DOCTYPE html><html><body><h1>登录提醒</h1><p>您的账户刚刚成功登录了财务系统。</p></body></html>'

  const textBody = '登录提醒 - 财务系统\n\n您好，' + userName + '：\n\n您的账户刚刚成功登录了财务系统。\n\n登录信息：\n- 登录邮箱：' + userEmail + '\n- 登录时间：' + loginTime + '\n' + (ipAddress ? '- 登录IP：' + ipAddress + '\n' : '') + '\n⚠️ 安全提示：\n如果这不是您的操作，请立即修改密码并联系系统管理员。\n\n感谢您使用财务系统！\n\n此邮件由系统自动发送，请勿回复。'

  return await sendEmail(env, userEmail, subject, htmlBody, textBody)
}

/**
 * 生成随机密码
 * @param length 密码长度，默认12位
 * @returns 随机密码字符串
 */
export function generateRandomPassword(length: number = 12): string {
  // 包含大小写字母、数字和特殊字符
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  const special = '!@#$%^&*'
  const allChars = lowercase + uppercase + numbers + special

  let password = ''
  // 确保至少包含一个小写字母、一个大写字母、一个数字和一个特殊字符
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += special[Math.floor(Math.random() * special.length)]

  // 填充剩余长度
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }

  // 打乱字符顺序
  return password.split('').sort(() => Math.random() - 0.5).join('')
}

/**
 * 发送新员工账号信息邮件
 */
export async function sendNewEmployeeAccountEmail(
  env: { EMAIL?: SendEmail },
  employeeEmail: string,
  employeeName: string,
  password: string,
  loginUrl: string = 'https://cloudflarets.com'
): Promise<{ success: boolean; error?: string }> {
  const subject = '欢迎加入 - 您的账号信息'

  const htmlBody = '<!DOCTYPE html><html><body><h1>欢迎加入AR公司管理系统</h1><p>您的账号已创建。</p></body></html>'

  const textBody = '欢迎加入AR公司管理系统\n\n您好，' + employeeName + '：\n\n恭喜您已成功加入我们的团队！系统已为您创建了登录账号，请妥善保管以下登录信息：\n\n登录地址：' + loginUrl + '\n登录邮箱：' + employeeEmail + '\n登录密码：' + password + '\n\n⚠️ 重要提示：\n1. 首次登录后，系统会要求您修改密码，请务必设置一个安全的密码\n2. 请妥善保管您的登录信息，不要泄露给他人\n3. 建议使用Google Authenticator进行二次验证，提高账号安全性\n\n如有任何问题，请联系系统管理员。\n\n祝您工作顺利！\n\n此邮件由系统自动发送，请勿回复。\nAR公司管理系统'

  return await sendEmail(env, employeeEmail, subject, htmlBody, textBody)
}

/**
 * 发送密码重置邮件
 */
export async function sendPasswordResetEmail(
  env: { EMAIL?: SendEmail },
  userEmail: string,
  userName: string,
  newPassword: string,
  loginUrl: string = 'https://cloudflarets.com'
): Promise<{ success: boolean; error?: string }> {
  const subject = '密码重置通知 - AR公司管理系统'

  const htmlBody = '<!DOCTYPE html><html><body><h1>密码重置通知</h1><p>您的密码已重置。</p></body></html>'

  const textBody = '密码重置通知 - AR公司管理系统\n\n您好，' + userName + '：\n\n您的账号密码已成功重置，请使用以下新密码登录：\n\n登录地址：' + loginUrl + '\n登录邮箱：' + userEmail + '\n新密码：' + newPassword + '\n\n⚠️ 重要提示：\n1. 首次登录后，系统会要求您修改密码，请务必设置一个安全的密码\n2. 请妥善保管您的登录信息，不要泄露给他人\n3. 建议使用Google Authenticator进行二次验证，提高账号安全性\n\n如有任何问题，请联系系统管理员。\n\n此邮件由系统自动发送，请勿回复。\nAR公司管理系统'

  return await sendEmail(env, userEmail, subject, htmlBody, textBody)
}

