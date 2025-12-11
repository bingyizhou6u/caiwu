# AR公司财务系统 - 云端 RAG 实现方案

> **目标**: 为项目文档建立智能检索系统，提升 AI 辅助开发效率
> **技术栈**: Cloudflare Workers AI + Vectorize + D1

---

## 📊 项目概述

| 指标 | 数值 |
|------|------|
| 文档数量 | 172 个 Markdown 文件 |
| 预估文本块 | ~1000-2000 chunks |
| 向量维度 | 768 (bge-base-en-v1.5) |
| 预估存储 | < 10 MB |

---

## 🏗️ 系统架构

```
┌──────────────────────────────────────────────────────────┐
│                    RAG Worker                            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────┐    ┌────────────┐    ┌─────────────────┐   │
│  │  文档   │───▶│  分块器   │───▶│  Workers AI     │   │
│  │ 加载器  │    │ Chunker   │    │  Embeddings     │   │
│  └─────────┘    └────────────┘    └────────┬────────┘   │
│                                              │           │
│                                              ▼           │
│  ┌─────────┐    ┌────────────┐    ┌─────────────────┐   │
│  │   D1    │◀───│  元数据   │◀───│   Vectorize     │   │
│  │ 原文存储│    │   管理    │    │   向量存储      │   │
│  └─────────┘    └────────────┘    └─────────────────┘   │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                    查询流程                              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────┐    ┌────────────┐    ┌─────────────────┐   │
│  │  用户   │───▶│  查询     │───▶│   Vectorize     │   │
│  │  问题   │    │  嵌入     │    │   相似度搜索    │   │
│  └─────────┘    └────────────┘    └────────┬────────┘   │
│                                              │           │
│                                              ▼           │
│  ┌─────────┐    ┌────────────┐    ┌─────────────────┐   │
│  │   LLM   │◀───│  上下文   │◀───│   D1 获取       │   │
│  │  回答   │    │   组装    │    │   原文内容      │   │
│  └─────────┘    └────────────┘    └─────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 📁 项目结构

```
rag-worker/
├── wrangler.toml          # Cloudflare 配置
├── package.json
├── src/
│   ├── index.ts           # 主入口
│   ├── ingest.ts          # 文档摄入逻辑
│   ├── query.ts           # 查询逻辑
│   ├── chunker.ts         # 文本分块
│   └── types.ts           # 类型定义
├── scripts/
│   └── seed-documents.ts  # 文档导入脚本
└── README.md
```

---

## 🔧 核心配置 (wrangler.toml)

```toml
name = "caiwu-rag-worker"
main = "src/index.ts"
compatibility_date = "2024-12-01"

# Workers AI 绑定
[ai]
binding = "AI"

# Vectorize 向量数据库
[[vectorize]]
binding = "VECTORIZE_INDEX"
index_name = "caiwu-docs-index"

# D1 数据库 (存储原文)
[[d1_databases]]
binding = "RAG_DB"
database_name = "caiwu-rag-db"
database_id = "your-database-id"
```

---

## 💻 核心代码实现

### 1. 文本分块器 (chunker.ts)

```typescript
interface Chunk {
  id: string;
  content: string;
  metadata: {
    source: string;      // 文件路径
    title: string;       // 文档标题
    section: string;     // 章节名
    startLine: number;
    endLine: number;
  };
}

export function chunkDocument(
  content: string, 
  source: string,
  chunkSize: number = 500,
  overlap: number = 100
): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = content.split('\n');
  
  let currentChunk = '';
  let currentSection = '';
  let startLine = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 检测章节标题
    if (line.startsWith('## ')) {
      currentSection = line.replace('## ', '');
    }
    
    currentChunk += line + '\n';
    
    // 达到块大小时分割
    if (currentChunk.length >= chunkSize) {
      chunks.push({
        id: `${source}-${chunks.length}`,
        content: currentChunk,
        metadata: {
          source,
          title: extractTitle(content),
          section: currentSection,
          startLine,
          endLine: i,
        },
      });
      
      // 重叠处理
      const overlapLines = lines.slice(Math.max(0, i - 5), i + 1);
      currentChunk = overlapLines.join('\n');
      startLine = Math.max(0, i - 5);
    }
  }
  
  // 处理最后一块
  if (currentChunk.trim()) {
    chunks.push({
      id: `${source}-${chunks.length}`,
      content: currentChunk,
      metadata: {
        source,
        title: extractTitle(content),
        section: currentSection,
        startLine,
        endLine: lines.length,
      },
    });
  }
  
  return chunks;
}

function extractTitle(content: string): string {
  const match = content.match(/^# (.+)$/m);
  return match ? match[1] : 'Untitled';
}
```

### 2. 文档摄入 (ingest.ts)

```typescript
import { Chunk, chunkDocument } from './chunker';

interface Env {
  AI: Ai;
  VECTORIZE_INDEX: VectorizeIndex;
  RAG_DB: D1Database;
}

export async function ingestDocument(
  env: Env,
  filePath: string,
  content: string
): Promise<number> {
  // 1. 分块
  const chunks = chunkDocument(content, filePath);
  
  // 2. 生成嵌入向量
  const embeddings = await env.AI.run(
    '@cf/baai/bge-base-en-v1.5',
    { text: chunks.map(c => c.content) }
  );
  
  // 3. 存储到 Vectorize
  const vectors = chunks.map((chunk, i) => ({
    id: chunk.id,
    values: embeddings.data[i],
    metadata: chunk.metadata,
  }));
  
  await env.VECTORIZE_INDEX.upsert(vectors);
  
  // 4. 存储原文到 D1
  const stmt = env.RAG_DB.prepare(`
    INSERT OR REPLACE INTO chunks (id, content, source, title, section)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  for (const chunk of chunks) {
    await stmt.bind(
      chunk.id,
      chunk.content,
      chunk.metadata.source,
      chunk.metadata.title,
      chunk.metadata.section
    ).run();
  }
  
  return chunks.length;
}
```

### 3. 查询接口 (query.ts)

```typescript
interface QueryResult {
  answer: string;
  sources: Array<{
    source: string;
    title: string;
    section: string;
    relevance: number;
  }>;
}

export async function queryRAG(
  env: Env,
  question: string,
  topK: number = 5
): Promise<QueryResult> {
  // 1. 生成问题的嵌入向量
  const queryEmbedding = await env.AI.run(
    '@cf/baai/bge-base-en-v1.5',
    { text: [question] }
  );
  
  // 2. 向量相似度搜索
  const matches = await env.VECTORIZE_INDEX.query(
    queryEmbedding.data[0],
    { topK, returnMetadata: true }
  );
  
  // 3. 从 D1 获取完整内容
  const chunkIds = matches.matches.map(m => m.id);
  const chunks = await env.RAG_DB.prepare(`
    SELECT * FROM chunks WHERE id IN (${chunkIds.map(() => '?').join(',')})
  `).bind(...chunkIds).all();
  
  // 4. 构建上下文
  const context = chunks.results
    .map((c: any) => `## ${c.title} - ${c.section}\n\n${c.content}`)
    .join('\n\n---\n\n');
  
  // 5. 调用 LLM 生成回答
  const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      {
        role: 'system',
        content: `你是 AR公司财务管理系统的 AI 助手。根据以下文档内容回答用户问题。
如果文档中没有相关信息，请明确说明。

## 相关文档内容：
${context}`
      },
      {
        role: 'user',
        content: question
      }
    ],
    max_tokens: 1024,
  });
  
  return {
    answer: response.response,
    sources: matches.matches.map(m => ({
      source: m.metadata?.source as string,
      title: m.metadata?.title as string,
      section: m.metadata?.section as string,
      relevance: m.score,
    })),
  };
}
```

### 4. 主入口 (index.ts)

```typescript
import { Hono } from 'hono';
import { ingestDocument } from './ingest';
import { queryRAG } from './query';

const app = new Hono<{ Bindings: Env }>();

// 查询接口
app.post('/api/rag/query', async (c) => {
  const { question, topK = 5 } = await c.req.json();
  
  if (!question) {
    return c.json({ error: 'Question is required' }, 400);
  }
  
  const result = await queryRAG(c.env, question, topK);
  return c.json(result);
});

// 文档导入接口 (管理用)
app.post('/api/rag/ingest', async (c) => {
  const { filePath, content } = await c.req.json();
  
  const chunksCount = await ingestDocument(c.env, filePath, content);
  return c.json({ success: true, chunksCount });
});

// 健康检查
app.get('/api/rag/health', (c) => {
  return c.json({ status: 'ok', version: '1.0.0' });
});

export default app;
```

---

## 📋 实施步骤

### 阶段 1：环境准备 (30分钟)

```bash
# 1. 创建项目
mkdir rag-worker && cd rag-worker
npm init -y
npm install hono wrangler

# 2. 创建 Vectorize 索引
wrangler vectorize create caiwu-docs-index --dimensions 768 --metric cosine

# 3. 创建 D1 数据库
wrangler d1 create caiwu-rag-db

# 4. 初始化表结构
wrangler d1 execute caiwu-rag-db --command "
  CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    source TEXT NOT NULL,
    title TEXT,
    section TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX idx_source ON chunks(source);
"
```

### 阶段 2：文档导入 (1小时)

```bash
# 运行文档导入脚本
npx tsx scripts/seed-documents.ts
```

### 阶段 3：部署与测试 (30分钟)

```bash
# 本地测试
wrangler dev

# 部署到生产
wrangler deploy
```

---

## 🔌 集成到 Antigravity

### 方案 1：MCP Server 集成

创建一个 MCP Server，让 Antigravity 可以调用 RAG API：

```json
// ~/.gemini/antigravity/mcp_config.json
{
  "servers": {
    "caiwu-rag": {
      "command": "node",
      "args": ["path/to/mcp-rag-server.js"],
      "env": {
        "RAG_API_URL": "https://caiwu-rag-worker.your-domain.workers.dev"
      }
    }
  }
}
```

### 方案 2：直接 HTTP 调用

在对话中，我可以使用 `read_url_content` 工具调用 RAG API。

---

## 💰 成本估算

| 服务 | 免费额度 | 预估用量 | 月成本 |
|------|---------|---------|--------|
| Workers AI (嵌入) | 10,000 次请求/天 | ~100 次/天 | $0 |
| Workers AI (LLM) | 10,000 次请求/天 | ~50 次/天 | $0 |
| Vectorize | 5M 向量查询/月 | ~1500 查询/月 | $0 |
| D1 | 5M 行读取/天 | ~1000 行/天 | $0 |

**总计：在免费额度内，$0/月**

---

## 🚀 下一步行动

1. [ ] 确认是否继续实施
2. [ ] 创建 `rag-worker` 项目目录
3. [ ] 配置 Cloudflare 资源
4. [ ] 导入 172 个文档
5. [ ] 测试查询功能
6. [ ] 集成到 Antigravity

---

## 📚 参考资料

- [Cloudflare Workers AI 文档](https://developers.cloudflare.com/workers-ai/)
- [Cloudflare Vectorize 文档](https://developers.cloudflare.com/vectorize/)
- [RAG 参考架构](https://developers.cloudflare.com/reference-architecture/diagrams/ai/ai-rag/)
