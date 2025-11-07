import { EmailMessage } from "cloudflare:email"
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
    console.warn(`[Email] ${errorMsg}`)
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
    const emailMessage = new EmailMessage(fromEmail, to, msg.asRaw())

    // 发送邮件
    await env.EMAIL.send(emailMessage)

    return { success: true }
  } catch (error: any) {
    const errorMsg = error.message || 'Failed to send email'
    console.error(`[Email] Failed to send email to ${to}:`, error)
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
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
        .info { margin: 10px 0; }
        .info-label { font-weight: bold; color: #555; }
        .footer { text-align: center; margin-top: 20px; color: #888; font-size: 12px; }
        .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>登录提醒</h1>
        </div>
        <div class="content">
          <p>您好，${userName}：</p>
          <p>您的账户刚刚成功登录了财务系统。</p>
          <div class="info">
            <span class="info-label">登录邮箱：</span>${userEmail}<br>
            <span class="info-label">登录时间：</span>${loginTime}<br>
            ${ipAddress ? `<span class="info-label">登录IP：</span>${ipAddress}<br>` : ''}
          </div>
          <div class="warning">
            <strong>⚠️ 安全提示：</strong><br>
            如果这不是您的操作，请立即修改密码并联系系统管理员。
          </div>
          <p>感谢您使用财务系统！</p>
        </div>
        <div class="footer">
          <p>此邮件由系统自动发送，请勿回复。</p>
        </div>
      </div>
    </body>
    </html>
  `

  const textBody = `
登录提醒 - 财务系统

您好，${userName}：

您的账户刚刚成功登录了财务系统。

登录信息：
- 登录邮箱：${userEmail}
- 登录时间：${loginTime}
${ipAddress ? `- 登录IP：${ipAddress}\n` : ''}

⚠️ 安全提示：
如果这不是您的操作，请立即修改密码并联系系统管理员。

感谢您使用财务系统！

此邮件由系统自动发送，请勿回复。
  `.trim()

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
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1890ff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
        .info-box { background-color: #fff; border: 2px solid #1890ff; padding: 15px; margin: 15px 0; border-radius: 4px; }
        .info-label { font-weight: bold; color: #555; margin-right: 8px; }
        .password { font-size: 18px; color: #ff4d4f; font-weight: bold; font-family: monospace; letter-spacing: 2px; }
        .login-button { display: inline-block; background-color: #1890ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 15px 0; }
        .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 20px; color: #888; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>欢迎加入AR公司管理系统</h1>
        </div>
        <div class="content">
          <p>您好，${employeeName}：</p>
          <p>恭喜您已成功加入我们的团队！系统已为您创建了登录账号，请妥善保管以下登录信息：</p>
          
          <div class="info-box">
            <p style="margin: 8px 0;"><span class="info-label">登录地址：</span><a href="${loginUrl}" style="color: #1890ff;">${loginUrl}</a></p>
            <p style="margin: 8px 0;"><span class="info-label">登录邮箱：</span>${employeeEmail}</p>
            <p style="margin: 8px 0;"><span class="info-label">登录密码：</span><span class="password">${password}</span></p>
          </div>
          
          <div style="text-align: center;">
            <a href="${loginUrl}" class="login-button">立即登录</a>
          </div>
          
          <div class="warning">
            <strong>⚠️ 重要提示：</strong><br>
            1. 首次登录后，系统会要求您修改密码，请务必设置一个安全的密码<br>
            2. 请妥善保管您的登录信息，不要泄露给他人<br>
            3. 建议使用Google Authenticator进行二次验证，提高账号安全性
          </div>
          
          <p>如有任何问题，请联系系统管理员。</p>
          <p>祝您工作顺利！</p>
        </div>
        <div class="footer">
          <p>此邮件由系统自动发送，请勿回复。</p>
          <p>AR公司管理系统</p>
        </div>
      </div>
    </body>
    </html>
  `
  
  const textBody = `
欢迎加入AR公司管理系统

您好，${employeeName}：

恭喜您已成功加入我们的团队！系统已为您创建了登录账号，请妥善保管以下登录信息：

登录地址：${loginUrl}
登录邮箱：${employeeEmail}
登录密码：${password}

⚠️ 重要提示：
1. 首次登录后，系统会要求您修改密码，请务必设置一个安全的密码
2. 请妥善保管您的登录信息，不要泄露给他人
3. 建议使用Google Authenticator进行二次验证，提高账号安全性

如有任何问题，请联系系统管理员。

祝您工作顺利！

此邮件由系统自动发送，请勿回复。
AR公司管理系统
  `.trim()
  
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
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #ff4d4f; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
        .info-box { background-color: #fff; border: 2px solid #ff4d4f; padding: 15px; margin: 15px 0; border-radius: 4px; }
        .info-label { font-weight: bold; color: #555; margin-right: 8px; }
        .password { font-size: 18px; color: #ff4d4f; font-weight: bold; font-family: monospace; letter-spacing: 2px; }
        .login-button { display: inline-block; background-color: #ff4d4f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 15px 0; }
        .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 20px; color: #888; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>密码重置通知</h1>
        </div>
        <div class="content">
          <p>您好，${userName}：</p>
          <p>您的账号密码已成功重置，请使用以下新密码登录：</p>
          
          <div class="info-box">
            <p style="margin: 8px 0;"><span class="info-label">登录地址：</span><a href="${loginUrl}" style="color: #ff4d4f;">${loginUrl}</a></p>
            <p style="margin: 8px 0;"><span class="info-label">登录邮箱：</span>${userEmail}</p>
            <p style="margin: 8px 0;"><span class="info-label">新密码：</span><span class="password">${newPassword}</span></p>
          </div>
          
          <div style="text-align: center;">
            <a href="${loginUrl}" class="login-button">立即登录</a>
          </div>
          
          <div class="warning">
            <strong>⚠️ 重要提示：</strong><br>
            1. 首次登录后，系统会要求您修改密码，请务必设置一个安全的密码<br>
            2. 请妥善保管您的登录信息，不要泄露给他人<br>
            3. 建议使用Google Authenticator进行二次验证，提高账号安全性
          </div>
          
          <p>如有任何问题，请联系系统管理员。</p>
        </div>
        <div class="footer">
          <p>此邮件由系统自动发送，请勿回复。</p>
          <p>AR公司管理系统</p>
        </div>
      </div>
    </body>
    </html>
  `
  
  const textBody = `
密码重置通知 - AR公司管理系统

您好，${userName}：

您的账号密码已成功重置，请使用以下新密码登录：

登录地址：${loginUrl}
登录邮箱：${userEmail}
新密码：${newPassword}

⚠️ 重要提示：
1. 首次登录后，系统会要求您修改密码，请务必设置一个安全的密码
2. 请妥善保管您的登录信息，不要泄露给他人
3. 建议使用Google Authenticator进行二次验证，提高账号安全性

如有任何问题，请联系系统管理员。

此邮件由系统自动发送，请勿回复。
AR公司管理系统
  `.trim()
  
  return await sendEmail(env, userEmail, subject, htmlBody, textBody)
}

