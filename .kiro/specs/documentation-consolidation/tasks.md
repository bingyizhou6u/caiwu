# Implementation Plan: Documentation Consolidation

## Overview

整理和统一系统文档，建立三层文档架构，消除重复内容，确保文档易于维护。

## Tasks

- [x] 1. 优化 Steering 文件
  - [x] 1.1 更新 `.kiro/steering/product.md`
    - 确保内容简洁（<100行）
    - 添加指向 `docs/` 的详细链接
    - _Requirements: 1.2, 2.3, 4.4_
  - [x] 1.2 更新 `.kiro/steering/tech.md`
    - 确保内容简洁（<100行）
    - 添加指向 `docs/guides/` 的链接
    - _Requirements: 1.2, 2.3, 4.4_
  - [x] 1.3 更新 `.kiro/steering/structure.md`
    - 确保内容简洁（<100行）
    - 添加指向 `docs/backend/` 和 `docs/frontend/` 的链接
    - _Requirements: 1.2, 2.3, 4.4_

- [x] 2. 更新文档索引
  - [x] 2.1 更新 `docs/README.md` 索引
    - 确保列出所有 `docs/` 下的文档
    - 添加文档描述和最后更新时间
    - 按类别组织（backend, frontend, guides, etc.）
    - _Requirements: 3.1, 3.3, 3.4_

- [x] 3. 优化项目 README 文件
  - [x] 3.1 更新 `backend/README.md`
    - 保留快速入门内容
    - 将详细内容替换为指向 `docs/` 的链接
    - _Requirements: 1.4, 2.4_
  - [x] 3.2 更新 `frontend/README.md`
    - 保留快速入门内容
    - 将详细内容替换为指向 `docs/` 的链接
    - _Requirements: 1.4, 2.4_
  - [x] 3.3 更新 `GEMINI.md`
    - 简化内容，保留 AI 配置要点
    - 添加指向 `docs/README.md` 的链接
    - _Requirements: 2.2, 2.3_

- [x] 4. 统一文档格式
  - [x] 4.1 统一日期格式
    - 检查所有文档的日期格式
    - 统一为 YYYY-MM-DD 格式
    - _Requirements: 5.3_
  - [x] 4.2 更新文档元数据
    - 为每个文档添加"最后更新"时间
    - 添加相关文档链接
    - _Requirements: 3.4, 5.4_

- [x] 5. Checkpoint - 验证文档结构
  - 确保所有 steering 文件 <100 行
  - 确保索引包含所有文档
  - 确保 README 使用引用模式
  - 询问用户是否有问题

## Notes

- 优先保持文档简洁，避免冗余
- 使用相对路径链接文档
- 保持中文为主的文档风格
- 日期格式统一为 YYYY-MM-DD

