/**
 * PWA 图标生成脚本
 * 
 * 使用方法：
 * 1. 安装依赖: npm install sharp --save-dev
 * 2. 运行: node scripts/generate-icons.js
 * 
 * 或者使用在线工具生成：
 * - https://realfavicongenerator.net/
 * - https://www.pwabuilder.com/imageGenerator
 */

import sharp from 'sharp'
import { readFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const ICONS_DIR = join(__dirname, '../public/icons')
const ICON_SVG = join(ICONS_DIR, 'icon.svg')
const MASKABLE_SVG = join(ICONS_DIR, 'icon-maskable.svg')

// 标准图标尺寸
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
// Maskable 图标尺寸
const MASKABLE_SIZES = [192, 512]
// 快捷方式图标
const SHORTCUT_ICONS = ['shortcut-add', 'shortcut-transfer', 'shortcut-user']

async function generateIcons() {
  console.log('🎨 开始生成 PWA 图标...')

  if (!existsSync(ICONS_DIR)) {
    mkdirSync(ICONS_DIR, { recursive: true })
  }

  const iconSvg = readFileSync(ICON_SVG)
  const maskableSvg = readFileSync(MASKABLE_SVG)

  // 生成标准图标
  for (const size of SIZES) {
    const outputPath = join(ICONS_DIR, `icon-${size}x${size}.png`)
    await sharp(iconSvg)
      .resize(size, size)
      .png()
      .toFile(outputPath)
    console.log(`  ✅ icon-${size}x${size}.png`)
  }

  // 生成 maskable 图标
  for (const size of MASKABLE_SIZES) {
    const outputPath = join(ICONS_DIR, `icon-maskable-${size}x${size}.png`)
    await sharp(maskableSvg)
      .resize(size, size)
      .png()
      .toFile(outputPath)
    console.log(`  ✅ icon-maskable-${size}x${size}.png`)
  }

  // 生成 favicon
  await sharp(iconSvg)
    .resize(32, 32)
    .png()
    .toFile(join(ICONS_DIR, '../favicon.png'))
  console.log('  ✅ favicon.png')

  // 生成 Apple Touch Icon
  await sharp(iconSvg)
    .resize(180, 180)
    .png()
    .toFile(join(ICONS_DIR, 'apple-touch-icon.png'))
  console.log('  ✅ apple-touch-icon.png')

  console.log('\n✨ 图标生成完成!')
  console.log('\n📝 注意: 快捷方式图标需要手动创建或使用在线工具生成')
  console.log('   推荐工具: https://www.pwabuilder.com/imageGenerator')
}

generateIcons().catch(console.error)

