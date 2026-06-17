# AGENTS.md

本文件给接手本项目的 AI 编码代理使用，只记录会影响开发决策的项目规则。

## 项目事实

- 项目名：陆同学AI工具集。
- 主前端是单文件 `index.html`，不要引入构建链，除非用户明确要求重构。
- 数据展示默认应能在无飞书密钥时运行，不能让页面因为 `/api/resources` 失败而空白。
- 视觉风格必须保持莫兰迪配色、暖色背景、白色卡片、瀑布流和轻量筛选控件。
- Cloudflare Worker 入口是 `worker/index.js`，配置文件是 `wrangler.toml`。

## 开发边界

- 不把 `FEISHU_APP_ID`、`FEISHU_APP_SECRET`、tenant access token 或其他密钥写入前端、Markdown 或 Git。
- 不把 `_site/`、`.wrangler/`、日志文件提交进 Git。
- 前端 `/api/resources` 必须保持失败回退到内置静态数据。
- Worker API 的 JSON 响应必须带 CORS，前端和 Worker 不同域时仍能读。
- 修改飞书字段映射时，同步更新 `docs/integration-guide.md` 和 `docs/runbook.md`。

## 常用命令

```powershell
# 前端 JS 语法检查，避免把整段脚本塞进命令行参数
node -e "const fs=require('fs'); const html=fs.readFileSync('index.html','utf8'); const start=html.indexOf('<script>')+8; const end=html.lastIndexOf('</script>'); new Function(html.slice(start,end)); console.log('frontend JS syntax ok')"

# Worker 语法检查
node --check worker/index.js

# 本地 Worker
npx wrangler dev --local --port 8790 --inspector-port 0

# 部署 Worker
npx wrangler@4.101.0 deploy --keep-vars --assets _site
```

## 线上地址

- Pages: https://lu-ai-toolkit.pages.dev
- Worker: https://lu-ai-toolkit-sync.army-815.workers.dev
- GitHub: https://github.com/davidchen99/lu-ai-toolkit

## 深入文档

| 任务 | 文档 |
| --- | --- |
| 了解系统结构 | `docs/architecture.md` |
| 对接 API 或字段 | `docs/integration-guide.md` |
| 部署、配置密钥、排障 | `docs/runbook.md` |
| 查看已完成和遗留事项 | `docs/handoff.md` |
