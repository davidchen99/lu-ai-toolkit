# 架构说明

日期：2026-06-18

## 总览

陆同学AI工具集采用静态优先架构：

- `index.html` 承载前端界面、静态数据、筛选排序、精选、场景聚合和维护面板。
- `worker/index.js` 是 Cloudflare Worker，同步飞书 Base 并提供 API。
- `feishu_data.json` 保留旧数据快照，不是页面唯一数据源。
- `_site/` 是部署临时目录，禁止提交。

前端可以独立运行。Worker 不可用或飞书未配置时，页面继续使用内置静态数据。

## 数据流

```text
飞书 Base
  -> Cloudflare Worker /api/resources
  -> Worker 缓存或 Cache API
  -> index.html loadRemoteResources()
  -> 前端统一数据模型
  -> 搜索 / 筛选 / 场景 / 维护面板
```

未配置飞书密钥时：

```text
/api/resources -> 502
index.html 捕获失败 -> 保留内置静态数据 -> 页面正常展示
```

Pages 静态域名没有同域 API 时，前端会继续请求生产 Worker API：

```text
https://lu-ai-toolkit.pages.dev
  -> /api/resources 不可用
  -> https://lu-ai-toolkit-sync.army-815.workers.dev/api/resources
  -> 成功则使用远程数据，失败则保留内置静态数据
```

## 前端模块

前端在 `index.html` 中实现：

- 工具库：工具名称、类型、场景、评分、链接、更新时间、使用状态。
- 技巧工作流：标题、日期、内容、软件、场景、参考链接。
- 提示词 & Skill：作者、日期、标题、提示词、类型、评分、使用状态。
- 陆同学精选：基于评分、完整度、使用状态和人工精选派生。
- 场景聚合：做图创作、公众号写作、科研学习、AI 编程、办公提效。
- 维护状态：同步状态、记录数、人工精选数、低完整度记录、JSON 导出。
- API 端点：维护状态中显示当前成功使用的同步端点，未连接时显示同步提示。

## Worker API

| 路由 | 方法 | 用途 |
| --- | --- | --- |
| `/api/health` | `GET` | 健康检查 |
| `/api/resources` | `GET` | 返回缓存或实时同步后的三类资源 |
| `/api/resources?force=1` | `GET` | 强制刷新飞书数据 |
| `/api/sync` | `POST` | 手动触发同步 |

Worker 每 6 小时执行一次 scheduled 同步。

## 飞书字段映射

默认表 ID 写在 `worker/index.js`：

- tools: `tblfxy4bf1GZjkOj`
- workflows: `tblTQTdBYZi6oknL`
- prompts: `tblAcyG2FFqtPPgj`

可用环境变量覆盖：

- `TOOL_TABLE_ID`
- `WORKFLOW_TABLE_ID`
- `PROMPT_TABLE_ID`

Base 来源可以用以下任一方式配置：

- `FEISHU_BASE_TOKEN`
- `FEISHU_WIKI_URL`，Worker 会解析 Wiki 节点到 Base token

## 缓存策略

Worker 优先使用 KV binding `AI_TOOLKIT_CACHE`。如果没有绑定 KV，则使用 Worker Cache API 作为兜底缓存。

缓存键为 `latest_resources`。同步失败但缓存存在时，接口返回：

```json
{
  "ok": true,
  "source": "cache_fallback",
  "warning": "...",
  "data": {}
}
```

## 部署形态

项目有两种线上入口：

- Cloudflare Pages: `https://lu-ai-toolkit.pages.dev`
- Worker + Assets: `https://lu-ai-toolkit-sync.army-815.workers.dev`

Worker + Assets 入口可以同时服务静态页面和 `/api` 路由。Pages 入口通过前端兜底请求 Worker API，配置飞书密钥后也能读取远程数据。
