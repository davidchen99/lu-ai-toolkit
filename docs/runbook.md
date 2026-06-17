# 运维手册

日期：2026-06-18

## 环境要求

- Node.js 可运行 `npx`
- Wrangler 登录 Cloudflare
- GitHub CLI 已登录时可推送归档

## Cloudflare 配置

`wrangler.toml` 当前配置：

```toml
name = "lu-ai-toolkit-sync"
account_id = "8150f75031ca45ef5ae7f1072741ac88"
main = "worker/index.js"
compatibility_date = "2026-05-01"
workers_dev = true
```

生产 Worker：

```text
https://lu-ai-toolkit-sync.army-815.workers.dev
```

生产 Pages：

```text
https://lu-ai-toolkit.pages.dev
```

## 必需密钥

生产飞书同步启用前，必须配置：

```powershell
npx wrangler secret put FEISHU_APP_ID
npx wrangler secret put FEISHU_APP_SECRET
```

再配置以下任一项：

```powershell
npx wrangler secret put FEISHU_WIKI_URL
```

或：

```powershell
npx wrangler secret put FEISHU_BASE_TOKEN
```

可选覆盖表 ID：

- `TOOL_TABLE_ID`
- `WORKFLOW_TABLE_ID`
- `PROMPT_TABLE_ID`

## 部署前检查

```powershell
git status --short --branch
node --check worker/index.js
```

前端是单文件 HTML。检查脚本语法时不要把整段脚本作为命令行参数传给 Node，Windows 会触发路径或参数过长问题。

```powershell
node -e "const fs=require('fs'); const html=fs.readFileSync('index.html','utf8'); const start=html.indexOf('<script>')+8; const end=html.lastIndexOf('</script>'); new Function(html.slice(start,end)); console.log('frontend JS syntax ok')"
```

## 生成发布目录

```powershell
if (Test-Path _site) { Remove-Item -LiteralPath _site -Recurse -Force }
New-Item -ItemType Directory -Path _site | Out-Null
Copy-Item -LiteralPath index.html -Destination _site
Copy-Item -LiteralPath feishu_data.json -Destination _site
if (Test-Path images) { Copy-Item -LiteralPath images -Destination _site -Recurse }
```

发布前确认 `_site` 里没有 `.wrangler/`：

```powershell
Get-ChildItem -Force _site
```

## 部署 Pages

```powershell
npx wrangler@4.101.0 pages deploy _site --project-name lu-ai-toolkit --branch master --commit-dirty=true
```

验证：

```powershell
Invoke-WebRequest -UseBasicParsing https://lu-ai-toolkit.pages.dev
```

## 部署 Worker

```powershell
npx wrangler@4.101.0 deploy --keep-vars --assets _site
```

验证：

```powershell
Invoke-WebRequest -UseBasicParsing https://lu-ai-toolkit-sync.army-815.workers.dev/api/health
Invoke-WebRequest -UseBasicParsing https://lu-ai-toolkit-sync.army-815.workers.dev
```

## 常见问题

### `/api/resources` 返回 502

检查响应内容。如果是：

```json
{"ok":false,"error":"missing FEISHU_APP_ID or FEISHU_APP_SECRET"}
```

说明生产环境没有配置飞书密钥。配置密钥后重新部署或等待 Worker 读取新环境变量。

### Pages 正常但实时同步无效

Pages 域名是静态站点，默认没有同域 `/api/resources`。前端会自动兜底请求生产 Worker API。若维护状态仍显示远程同步不可用，优先检查 Worker `/api/health` 和飞书密钥配置。

### Wrangler 返回非零但显示 Deployment complete

Wrangler 4.85.0 曾出现部署完成但命令非零退出的情况。优先使用：

```powershell
npx wrangler@4.101.0 ...
```

并用线上 URL 验证最终结果。

### `_site/.wrangler` 被上传

删除 `_site/.wrangler` 后重新执行 Worker Assets 部署。线上验证该路径应返回 404：

```powershell
Invoke-WebRequest -UseBasicParsing -SkipHttpErrorCheck https://lu-ai-toolkit-sync.army-815.workers.dev/.wrangler/cache/pages.json
```
