# 陆同学AI工具集

陆同学AI工具集是一个静态优先的 AI 工具资料库，展示工具、技巧工作流、提示词与 Skill。前端保持莫兰迪配色、暖色背景、白色卡片和瀑布流风格；同步层使用 Cloudflare Worker 从飞书 Base 拉取数据。

## 线上地址

- Cloudflare Pages: https://lu-ai-toolkit.pages.dev
- Worker 站点: https://lu-ai-toolkit-sync.army-815.workers.dev
- Worker 健康检查: https://lu-ai-toolkit-sync.army-815.workers.dev/api/health
- GitHub 存档: https://github.com/davidchen99/lu-ai-toolkit

## 项目结构

```text
.
├── index.html                         # 单页前端，内置静态数据和交互逻辑
├── feishu_data.json                   # 旧版静态数据快照
├── worker/index.js                    # Cloudflare Worker API 与飞书同步层
├── wrangler.toml                      # Worker 部署配置
├── 产品需求文档- AI工具集展示.md       # 正式 PRD
├── docs/                              # 架构、接入和运维文档
└── images/                            # 图片资源
```

## 已实现能力

- 三个内容模块：工具库、技巧工作流、提示词 & Skill。
- 搜索、筛选、排序、详情弹窗和提示词复制。
- 陆同学精选、5 个场景导航、场景聚合结果。
- 内容分级：精选、常用、待验证、归档。
- 内容完整度评分、低完整度清单、维护状态面板。
- 导出当前 JSON、本地人工精选。
- 效果图展示：卡片和详情页支持 `imageUrls`，失败自动回退占位。
- Worker API: `/api/health`、`/api/resources`、`/api/sync`。
- Pages 前端会先请求同域 `/api/resources`，不可用时自动兜底到生产 Worker API。
- Worker 定时任务：每 6 小时尝试同步一次飞书数据。

## 本地预览

静态页面可直接打开 `index.html`。如需模拟线上路径和 `/api` 行为，使用 Wrangler：

```powershell
npx wrangler dev --local --port 8790 --inspector-port 0
```

## 部署

前端可部署到 Cloudflare Pages，也可通过 Worker Assets 随 Worker 一起部署。

```powershell
# 生成 Pages/Assets 发布目录
if (Test-Path _site) { Remove-Item -LiteralPath _site -Recurse -Force }
New-Item -ItemType Directory -Path _site | Out-Null
Copy-Item -LiteralPath index.html -Destination _site
Copy-Item -LiteralPath feishu_data.json -Destination _site
if (Test-Path images) { Copy-Item -LiteralPath images -Destination _site -Recurse }

# 部署 Pages
npx wrangler@4.101.0 pages deploy _site --project-name lu-ai-toolkit --branch master --commit-dirty=true

# 部署 Worker + 静态资源
npx wrangler@4.101.0 deploy --keep-vars --assets _site
```

## 飞书同步状态

同步代码已经完成，但生产环境必须配置以下密钥后 `/api/resources` 才会返回飞书数据：

- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_WIKI_URL` 或 `FEISHU_BASE_TOKEN`

未配置密钥时，页面仍可使用内置静态数据展示；`/api/resources` 会返回 `502` 和缺少密钥的错误信息，维护状态面板会显示同步提示。

更多细节见：

- [架构说明](docs/architecture.md)
- [接入指南](docs/integration-guide.md)
- [运维手册](docs/runbook.md)
- [交接记录](docs/handoff.md)
