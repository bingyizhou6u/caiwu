/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import viteCompression from 'vite-plugin-compression'
import { visualizer } from 'rollup-plugin-visualizer'

import istanbul from 'vite-plugin-istanbul';

// Istanbul 只在 E2E 测试覆盖率模式下启用
const enableCoverage = process.env.VITE_COVERAGE === 'true'

export default defineConfig({
  plugins: [
    react(),
    // 只在需要覆盖率时启用 Istanbul（VITE_COVERAGE=true npm run build）
    ...(enableCoverage ? [istanbul({
      include: 'src/**/*',
      exclude: ['node_modules', 'test/'],
      extension: ['.js', '.ts', '.tsx'],
      requireEnv: false,
    })] : []),
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
    }),
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
    }),
    // visualizer 只在分析时使用，避免每次构建都打开
    ...(process.env.ANALYZE === 'true' ? [visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
    })] : []),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'https://caiwu-backend.bingyizhou6u.workers.dev',
        changeOrigin: true
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: ['tests/**', 'node_modules/**'],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'antd': ['antd'],
          'antd-icons': ['@ant-design/icons'],
          'libs': ['@tanstack/react-query', 'dayjs', 'zustand', 'qrcode.react'],
        },
      },
    },
  }
})


