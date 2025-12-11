export interface Env {
  EMAIL: EmailSender
  EMAIL_TOKEN?: string
  EMAIL_FROM?: string
}

interface EmailSender {
  send(message: EmailMessage): Promise<void>
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ status: 'ok' })
    }

    if (request.method !== 'POST' || url.pathname !== '/send') {
      return new Response('Not found', { status: 404 })
    }

    // 简单鉴权：若配置了 EMAIL_TOKEN 则要求匹配
    if (env.EMAIL_TOKEN) {
      const token = request.headers.get('x-email-token')
      if (token !== env.EMAIL_TOKEN) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return Response.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
    }

    const { to, subject, html, text } = body || {}
    if (!to || !subject || (!html && !text)) {
      return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const from = env.EMAIL_FROM || 'AR系统 <noreply@cloudflarets.com>'

    // 构造最简 MIME，补充必需的 Message-ID
    const messageId = `<${crypto.randomUUID()}@caiwu-email>`
    const mimeLines = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Message-ID: ${messageId}`,
      `MIME-Version: 1.0`,
      html
        ? `Content-Type: text/html; charset=UTF-8`
        : `Content-Type: text/plain; charset=UTF-8`,
      ``,
      html || text,
    ]
    const raw = mimeLines.join('\r\n')

    try {
      const { EmailMessage } = await import('cloudflare:email')
      const message = new EmailMessage(from, to, raw)
      await env.EMAIL.send(message)
      return Response.json({ success: true })
    } catch (err: any) {
      return Response.json({
        success: false,
        error: err?.message || 'Send failed'
      }, { status: 500 })
    }
  },
}

