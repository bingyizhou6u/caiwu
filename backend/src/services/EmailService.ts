import { Fetcher } from '@cloudflare/workers-types'

// 邮件样式模板
const emailTemplate = (content: string) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f7fa;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px 24px; border-bottom: 1px solid #e5e7eb;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td>
                    <div style="font-size: 24px; font-weight: 700; color: #1e40af;">⚡ AR公司</div>
                    <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">管理系统通知</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                此邮件由系统自动发送，请勿直接回复
              </p>
              <p style="margin: 8px 0 0; font-size: 12px; color: #9ca3af; text-align: center;">
                © ${new Date().getFullYear()} AR公司管理系统
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

// 信息卡片样式
const infoCard = (items: { label: string; value: string }[]) => `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; border-radius: 8px; margin: 20px 0;">
  ${items
    .map(
      item => `
  <tr>
    <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
      <span style="color: #6b7280; font-size: 13px;">${item.label}</span>
      <div style="color: #1f2937; font-size: 15px; font-weight: 500; margin-top: 4px;">${item.value}</div>
    </td>
  </tr>
  `
    )
    .join('')}
</table>`

// 警告卡片样式
const warningCard = (message: string) => `
<div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <div style="display: flex; align-items: flex-start;">
    <span style="font-size: 18px; margin-right: 12px;">⚠️</span>
    <div>
      <div style="font-weight: 600; color: #92400e; margin-bottom: 4px;">安全提示</div>
      <div style="color: #a16207; font-size: 14px;">${message}</div>
    </div>
  </div>
</div>`

// 成功卡片样式
const successCard = (title: string, message: string) => `
<div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border: 1px solid #10b981; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <div style="display: flex; align-items: flex-start;">
    <span style="font-size: 18px; margin-right: 12px;">✅</span>
    <div>
      <div style="font-weight: 600; color: #065f46; margin-bottom: 4px;">${title}</div>
      <div style="color: #047857; font-size: 14px;">${message}</div>
    </div>
  </div>
</div>`

// 按钮样式
const primaryButton = (text: string, url: string) => `
<a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 20px 0;">
  ${text}
</a>`

export class EmailService {
  constructor(private env: { EMAIL_SERVICE?: Fetcher; EMAIL_TOKEN?: string }) {}

  /**
   * 发送邮件通知（仅通过 EMAIL_SERVICE）
   */
  async sendEmail(
    to: string,
    subject: string,
    htmlBody: string,
    textBody?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.env.EMAIL_SERVICE) {
      const errorMsg = 'EMAIL_SERVICE not configured'
      console.error('[EmailService] ' + errorMsg)
      return { success: false, error: errorMsg }
    }

    try {
      const res = await this.env.EMAIL_SERVICE.fetch('https://email-worker/send', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.env.EMAIL_TOKEN ? { 'x-email-token': this.env.EMAIL_TOKEN } : {}),
        },
        body: JSON.stringify({
          to,
          subject,
          html: htmlBody,
          text: textBody,
        }),
      })

      const data: any = await res.json().catch(() => ({}))
      if (res.ok && data?.success) {return { success: true }}

      const errorMsg = data?.error || `Email worker failed with status ${res.status}`
      console.error('[EmailService] Service send failed:', errorMsg)
      return { success: false, error: errorMsg }
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to send via email worker'
      console.error('[EmailService] Service send error:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * 发送登录提醒邮件
   */
  async sendLoginNotificationEmail(
    userEmail: string,
    userName: string,
    loginTime: string,
    ipAddress?: string
  ): Promise<{ success: boolean; error?: string }> {
    const subject = '🔐 登录提醒 - AR公司管理系统'

    const content = `
    <h2 style="margin: 0 0 16px; font-size: 20px; color: #1f2937;">登录提醒</h2>
    <p style="margin: 0 0 16px; color: #4b5563; font-size: 15px; line-height: 1.6;">
      您好，<strong>${userName}</strong>：
    </p>
    <p style="margin: 0 0 16px; color: #4b5563; font-size: 15px; line-height: 1.6;">
      您的账号刚刚成功登录了管理系统。
    </p>
    ${infoCard([
      { label: '登录邮箱', value: userEmail },
      { label: '登录时间', value: loginTime },
      ...(ipAddress ? [{ label: '登录IP', value: ipAddress }] : []),
    ])}
    ${warningCard('如果这不是您的操作，请立即修改密码并联系系统管理员。')}
  `

    const textBody = `登录提醒
    
    您好，${userName}：
    
    您的账号刚刚成功登录了管理系统。
    
    登录信息：
    - 登录邮箱：${userEmail}
    - 登录时间：${loginTime}
    ${ipAddress ? `- 登录IP：${ipAddress}` : ''}
    
    ⚠️ 安全提示：
    如果这不是您的操作，请立即修改密码并联系系统管理员。
    
    此邮件由系统自动发送，请勿回复。
    AR公司管理系统`

    return await this.sendEmail(userEmail, subject, emailTemplate(content), textBody)
  }

  /**
   * 发送账号激活邮件
   */
  async sendActivationEmail(
    email: string,
    name: string,
    activationToken: string,
    frontendUrl: string = 'https://caiwu.cloudflarets.com'
  ): Promise<{ success: boolean; error?: string }> {
    const subject = '🚀 激活您的账号 - AR公司管理系统'
    const activationUrl = `${frontendUrl}/auth/activate?token=${activationToken}`

    const content = `
    <h2 style="margin: 0 0 16px; font-size: 20px; color: #1f2937;">欢迎加入团队！</h2>
    <p style="margin: 0 0 16px; color: #4b5563; font-size: 15px; line-height: 1.6;">
      您好，<strong>${name}</strong>：
    </p>
    <p style="margin: 0 0 16px; color: #4b5563; font-size: 15px; line-height: 1.6;">
      恭喜您加入AR公司！请点击下方按钮激活您的账号并设置密码。
    </p>
    
    ${infoCard([
      { label: '登录账号', value: email },
      { label: '说明', value: '请使用接收此邮件的【个人邮箱】作为登录账号' },
    ])}

    <p style="margin: 0 0 16px; color: #4b5563; font-size: 14px; line-height: 1.6;">
      激活链接在 24 小时内有效。
    </p>
    <div style="text-align: center; margin-bottom: 24px;">
      ${primaryButton('立即激活账号', activationUrl)}
    </div>
    <div style="text-align: center; margin-top: 16px;">
      <a href="${activationUrl}" style="color: #6b7280; font-size: 12px;">如果按钮无法点击，请复制链接到浏览器打开：${activationUrl}</a>
    </div>
  `

    const textBody = `欢迎加入AR公司！
    
    您好，${name}：
    
    您的登录账号为：${email}
    (请使用此个人邮箱登录)
    
    请点击下方链接激活您的账号并设置密码：
    ${activationUrl}
    
    (链接24小时内有效)
    
    此邮件由系统自动发送，请勿回复。
    AR公司管理系统`

    return await this.sendEmail(email, subject, emailTemplate(content), textBody)
  }

  /**
   * 发送密码重置链接邮件
   */
  async sendPasswordResetLinkEmail(
    email: string,
    name: string,
    resetToken: string,
    frontendUrl: string = 'https://caiwu.cloudflarets.com'
  ): Promise<{ success: boolean; error?: string }> {
    const subject = '🔒 重置您的密码 - AR公司管理系统'
    const resetUrl = `${frontendUrl}/auth/reset-password?token=${resetToken}`

    const content = `
      <h2 style="margin: 0 0 16px; font-size: 20px; color: #1f2937;">重置密码请求</h2>
      <p style="margin: 0 0 16px; color: #4b5563; font-size: 15px; line-height: 1.6;">
        您好，<strong>${name}</strong>：
      </p>
      <p style="margin: 0 0 16px; color: #4b5563; font-size: 15px; line-height: 1.6;">
        我们收到了您账号的密码重置请求。请点击下方按钮设置新密码：
      </p>
      <div style="text-align: center;">
        ${primaryButton('重置密码', resetUrl)}
      </div>
      <p style="margin: 20px 0 16px; color: #4b5563; font-size: 14px; line-height: 1.6;">
        链接在 1 小时内有效。如果这不是您的操作，请忽略此邮件。
      </p>
      <div style="text-align: center; margin-top: 16px;">
        <a href="${resetUrl}" style="color: #6b7280; font-size: 12px;">如果按钮无法点击，请复制链接到浏览器打开：${resetUrl}</a>
      </div>
    `

    const textBody = `重置密码请求
    
    您好，${name}：
    
    请点击下方链接重置您的密码：
    ${resetUrl}
    
    (链接1小时内有效)
    
    此邮件由系统自动发送，请勿回复。
    AR公司管理系统`

    return await this.sendEmail(email, subject, emailTemplate(content), textBody)
  }

  /**
   * 发送密码修改成功通知邮件
   */
  async sendPasswordChangedNotificationEmail(
    userEmail: string,
    userName: string,
    changeTime: string,
    ipAddress?: string
  ): Promise<{ success: boolean; error?: string }> {
    const subject = '✅ 密码修改成功 - AR公司管理系统'

    const content = `
    <h2 style="margin: 0 0 16px; font-size: 20px; color: #1f2937;">密码修改成功</h2>
    <p style="margin: 0 0 16px; color: #4b5563; font-size: 15px; line-height: 1.6;">
      您好，<strong>${userName}</strong>：
    </p>
    ${successCard('操作成功', '您的账号密码已成功修改。')}
    ${infoCard([
      { label: '修改时间', value: changeTime },
      ...(ipAddress ? [{ label: '操作IP', value: ipAddress }] : []),
    ])}
    ${warningCard('如果这不是您本人的操作，请立即联系系统管理员！')}
  `

    const textBody = `密码修改成功
    
    您好，${userName}：
    
    您的账号密码已于 ${changeTime} 成功修改。
    ${ipAddress ? `操作IP：${ipAddress}` : ''}
    
    ⚠️ 安全提示：
    如果这不是您本人的操作，请立即联系系统管理员！
    
    此邮件由系统自动发送，请勿回复。
    AR公司管理系统`

    return await this.sendEmail(userEmail, subject, emailTemplate(content), textBody)
  }

  /**
   * Send TOTP Reset Email
   */
  async sendTotpResetEmail(
    email: string,
    name: string,
    token: string,
    frontendUrl: string = 'https://caiwu.cloudflarets.com'
  ): Promise<{ success: boolean; error?: string }> {
    const subject = '🔐 重置 2FA 验证 - AR公司管理系统'
    const resetUrl = `${frontendUrl}/auth/reset-totp?token=${token}`

    const content = `
      <h2 style="margin: 0 0 16px; font-size: 20px; color: #1f2937;">2FA 重置请求</h2>
      <p style="margin: 0 0 16px; color: #4b5563; font-size: 15px; line-height: 1.6;">
        您好，<strong>${name}</strong>：
      </p>
      <p style="margin: 0 0 16px; color: #4b5563; font-size: 15px; line-height: 1.6;">
        我们收到了您账号的 2FA (Google验证码) 重置请求。
      </p>
      <p style="margin: 0 0 16px; color: #4b5563; font-size: 15px; line-height: 1.6;">
        这是非常敏感的操作。如果您确认重置，您的两步验证将被停用，您将只能使用密码登录（直到重新绑定）。
      </p>
      <div style="text-align: center;">
        ${primaryButton('确认重置 2FA', resetUrl)}
      </div>
      <p style="margin: 20px 0 16px; color: #4b5563; font-size: 14px; line-height: 1.6;">
        链接在 30 分钟内有效。如果这不是您的操作，请忽略此邮件。
      </p>
      <div style="text-align: center; margin-top: 16px;">
        <a href="${resetUrl}" style="color: #6b7280; font-size: 12px;">如果按钮无法点击，请复制链接到浏览器打开：${resetUrl}</a>
      </div>
    `

    const textBody = `2FA 重置请求
    
    您好，${name}：
    
    请点击下方链接重置您的 2FA：
    ${resetUrl}
    
    (链接30分钟内有效)
    
    此邮件由系统自动发送，请勿回复。
    AR公司管理系统`

    return await this.sendEmail(email, subject, emailTemplate(content), textBody)
  }

  /**
   * 发送审批通知邮件
   */
  async sendApprovalNotificationEmail(data: {
    to: string
    applicantName: string
    type: 'leave' | 'reimbursement' | 'borrowing'
    typeLabel: string
    status: 'approved' | 'rejected'
    approverName: string
    details: {
      id: string
      amountCents?: number
      currency?: string
      startDate?: string
      endDate?: string
      days?: number
      memo?: string
    }
  }): Promise<void> {
    const { to, applicantName, type, typeLabel, status, approverName, details } = data

    const statusText = status === 'approved' ? '已批准' : '已拒绝'
    const statusEmoji = status === 'approved' ? '✅' : '❌'
    const statusColor = status === 'approved' ? '#10b981' : '#ef4444'

    const subject = `${typeLabel}审批${statusText}通知`

    let detailItems: { label: string; value: string }[] = []

    if (type === 'leave') {
      detailItems = [
        { label: '申请类型', value: typeLabel },
        { label: '开始日期', value: details.startDate || '-' },
        { label: '结束日期', value: details.endDate || '-' },
        { label: '天数', value: details.days ? `${details.days}天` : '-' },
      ]
    } else if (type === 'reimbursement' || type === 'borrowing') {
      const amount = details.amountCents
        ? `${(details.amountCents / 100).toFixed(2)} ${details.currency || 'CNY'}`
        : '-'
      detailItems = [
        { label: '申请类型', value: typeLabel },
        { label: '金额', value: amount },
      ]
    }

    if (details.memo) {
      detailItems.push({ label: '备注', value: details.memo })
    }

    const content = `
      <div style="color: #1f2937;">
        <h2 style="margin: 0 0 24px; font-size: 20px; font-weight: 700; color: #111827;">
          ${statusEmoji} 您的${typeLabel}申请${statusText}
        </h2>
        
        <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #374151;">
          尊敬的 <strong>${applicantName}</strong>，您好！
        </p>
        
        <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #374151;">
          您的${typeLabel}申请已由 <strong>${approverName}</strong> ${statusText}。
        </p>
        
        ${infoCard(detailItems)}
        
        <div style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid ${statusColor};">
          <div style="font-weight: 600; color: #111827; margin-bottom: 8px;">审批结果</div>
          <div style="color: #374151; font-size: 14px;">
            状态：<span style="color: ${statusColor}; font-weight: 600;">${statusText}</span>
          </div>
        </div>
        
        <p style="margin: 24px 0 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
          如有疑问，请联系审批人或系统管理员。
        </p>
      </div>
    `

    const textBody = `${applicantName}，您的${typeLabel}申请已${statusText}。审批人：${approverName}`

    return await this.sendEmail(to, subject, emailTemplate(content), textBody)
  }
}
