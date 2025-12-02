import { api as apiClient } from '../api/http'

/**
 * 图片工具函数
 */

/**
 * 将图片文件转换为WebP格式
 * @param file 原始图片文件
 * @param quality WebP质量，范围0-1，默认0.85
 * @returns Promise<File> 转换后的WebP文件
 */
export const convertToWebP = async (file: File, quality: number = 0.85): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('无法创建canvas上下文'))
          return
        }
        ctx.drawImage(img, 0, 0)
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('图片转换失败'))
              return
            }
            const webpFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.webp'), { type: 'image/webp' })
            resolve(webpFile)
          },
          'image/webp',
          quality
        )
      }
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

/**
 * 使用URL.createObjectURL方式将图片转换为WebP格式（适用于大文件）
 * @param file 原始图片文件
 * @param quality WebP质量，范围0-1，默认0.85
 * @returns Promise<File> 转换后的WebP文件
 */
export const convertToWebPWithURL = async (file: File, quality: number = 0.85): Promise<File> => {
  const img = new Image()
  const imageUrl = URL.createObjectURL(file)

  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = imageUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      URL.revokeObjectURL(imageUrl)
      throw new Error('无法创建Canvas上下文')
    }

    ctx.drawImage(img, 0, 0)

    const webpBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('转换失败'))
        }
      }, 'image/webp', quality)
    })

    URL.revokeObjectURL(imageUrl)
    return new File([webpBlob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' })
  } catch (error) {
    URL.revokeObjectURL(imageUrl)
    throw error
  }
}

/**
 * 检查文件是否为支持的图片格式
 * @param file 文件对象
 * @returns boolean 是否为支持的图片格式
 */
export const isSupportedImageType = (file: File): boolean => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  return allowedTypes.includes(file.type)
}

/**
 * 上传图片并转换为WebP格式
 * @param file 原始图片文件
 * @param uploadUrl 上传接口URL
 * @param quality WebP质量，范围0-1，默认0.85
 * @returns Promise<string> 上传后的图片URL
 */
export const uploadImageAsWebP = async (
  file: File,
  uploadUrl: string,
  quality: number = 0.85
): Promise<string> => {
  // 检查文件类型
  if (!isSupportedImageType(file)) {
    throw new Error('只允许上传图片格式（JPEG、PNG、GIF、WebP）')
  }

  // 如果已经是WebP格式，直接上传
  let fileToUpload: File = file
  if (file.type !== 'image/webp') {
    fileToUpload = await convertToWebP(file, quality)
  }

  const formData = new FormData()
  formData.append('file', fileToUpload)

  const result = await apiClient.post<any>(uploadUrl, formData)
  return result.url
}

