/**
 * 文件验证工具
 * 提供文件内容验证（Magic Number）和类型检查
 */

/**
 * 图片文件 Magic Number 定义
 */
const IMAGE_MAGIC_NUMBERS: Record<string, number[][]> = {
  'image/jpeg': [
    [0xff, 0xd8, 0xff, 0xe0], // JPEG JFIF
    [0xff, 0xd8, 0xff, 0xe1], // JPEG EXIF
    [0xff, 0xd8, 0xff, 0xe2], // JPEG Canon
    [0xff, 0xd8, 0xff, 0xe3], // JPEG Samsung
    [0xff, 0xd8, 0xff, 0xdb], // JPEG raw
  ],
  'image/png': [[0x89, 0x50, 0x4e, 0x47]], // PNG
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  ],
  'image/webp': [
    // WebP: RIFF...WEBP
    [0x52, 0x49, 0x46, 0x46], // RIFF (前4字节)
  ],
}

/**
 * PDF 文件 Magic Number
 */
const PDF_MAGIC_NUMBER = [0x25, 0x50, 0x44, 0x46] // %PDF

/**
 * 验证文件 Magic Number
 * @param fileBuffer 文件内容 ArrayBuffer
 * @param expectedMimeType 期望的 MIME 类型
 * @returns 是否为有效的文件类型
 */
export async function validateFileMagicNumber(
  fileBuffer: ArrayBuffer,
  expectedMimeType: string
): Promise<boolean> {
  const bytes = new Uint8Array(fileBuffer)
  const magicNumbers = IMAGE_MAGIC_NUMBERS[expectedMimeType]

  if (!magicNumbers) {
    // 如果不支持的类型，返回 false
    return false
  }

  // 检查每个可能的 Magic Number
  for (const magic of magicNumbers) {
    if (bytes.length < magic.length) {
      continue
    }

    let match = true
    for (let i = 0; i < magic.length; i++) {
      if (bytes[i] !== magic[i]) {
        match = false
        break
      }
    }

    if (match) {
      // WebP 需要额外检查：前4字节是 RIFF，第8-11字节应该是 "WEBP"
      if (expectedMimeType === 'image/webp') {
        if (bytes.length >= 12) {
          const webpSignature = String.fromCharCode(...bytes.slice(8, 12))
          return webpSignature === 'WEBP'
        }
        return false
      }
      return true
    }
  }

  return false
}

/**
 * 验证 PDF 文件
 */
export async function validatePdfMagicNumber(fileBuffer: ArrayBuffer): Promise<boolean> {
  const bytes = new Uint8Array(fileBuffer)
  if (bytes.length < PDF_MAGIC_NUMBER.length) {
    return false
  }

  for (let i = 0; i < PDF_MAGIC_NUMBER.length; i++) {
    if (bytes[i] !== PDF_MAGIC_NUMBER[i]) {
      return false
    }
  }

  return true
}

/**
 * 验证图片文件（包含 Magic Number 检查）
 * @param file 文件对象
 * @param allowedTypes 允许的 MIME 类型数组
 * @returns 验证结果和错误消息
 */
export async function validateImageFile(
  file: File,
  allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
): Promise<{ valid: boolean; error?: string }> {
  // 1. 检查文件大小
  const maxSize = 10 * 1024 * 1024 // 10MB
  if (file.size > maxSize) {
    return { valid: false, error: '文件过大（最大10MB）' }
  }

  // 2. 检查 MIME 类型
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: `只允许上传图片格式（${allowedTypes.join('、')}）` }
  }

  // 3. 验证文件内容（Magic Number）
  try {
    const fileBuffer = await file.arrayBuffer()
    const isValid = await validateFileMagicNumber(fileBuffer, file.type)

    if (!isValid) {
      return {
        valid: false,
        error: `文件内容与类型不匹配，疑似伪造文件类型。期望类型：${file.type}`,
      }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, error: '文件读取失败，请重试' }
  }
}

/**
 * 验证 PDF 文件
 * @param file 文件对象
 * @param maxSize 最大文件大小（字节），默认 20MB
 * @returns 验证结果和错误消息
 */
export async function validatePdfFile(
  file: File,
  maxSize: number = 20 * 1024 * 1024
): Promise<{ valid: boolean; error?: string }> {
  // 1. 检查文件大小
  if (file.size > maxSize) {
    return { valid: false, error: `文件过大（最大${maxSize / 1024 / 1024}MB）` }
  }

  // 2. 检查 MIME 类型
  if (file.type !== 'application/pdf') {
    return { valid: false, error: '只允许上传PDF格式文件' }
  }

  // 3. 验证文件内容（Magic Number）
  try {
    const fileBuffer = await file.arrayBuffer()
    const isValid = await validatePdfMagicNumber(fileBuffer)

    if (!isValid) {
      return { valid: false, error: '文件内容与类型不匹配，疑似伪造文件类型' }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, error: '文件读取失败，请重试' }
  }
}

/**
 * 验证文件名（防止路径遍历攻击）
 * @param fileName 文件名
 * @returns 是否为安全的文件名
 */
export function validateFileName(fileName: string): boolean {
  // 禁止路径遍历字符
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return false
  }

  // 禁止控制字符
  if (/[\x00-\x1f\x7f]/.test(fileName)) {
    return false
  }

  return true
}

/**
 * 生成安全的文件名
 * @param originalName 原始文件名
 * @param extension 文件扩展名（如 '.webp'）
 * @returns 安全的文件名
 */
export function generateSafeFileName(originalName: string, extension: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  
  // 提取原始文件名的安全部分（仅字母、数字、连字符、下划线）
  const safeName = originalName
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 50) // 限制长度
  
  return `${timestamp}-${random}-${safeName}${extension}`
}

