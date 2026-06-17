# 接入指南

日期：2026-06-17

## 适用对象

本文档面向需要对接陆同学AI工具集数据接口、替换飞书数据源或维护字段映射的开发者。

## API 基础地址

生产 Worker：

```text
https://lu-ai-toolkit-sync.army-815.workers.dev
```

## 健康检查

```powershell
Invoke-WebRequest -UseBasicParsing https://lu-ai-toolkit-sync.army-815.workers.dev/api/health
```

成功响应：

```json
{
  "ok": true,
  "service": "lu-ai-toolkit-sync"
}
```

## 获取资源

```powershell
Invoke-WebRequest -UseBasicParsing https://lu-ai-toolkit-sync.army-815.workers.dev/api/resources
```

成功响应结构：

```json
{
  "ok": true,
  "source": "feishu",
  "data": {
    "syncedAt": "2026-06-17T00:00:00.000Z",
    "source": {
      "baseToken": "...",
      "tableIds": {
        "tools": "...",
        "workflows": "...",
        "prompts": "..."
      }
    },
    "tools": [],
    "workflows": [],
    "prompts": []
  }
}
```

未配置飞书密钥时：

```json
{
  "ok": false,
  "error": "missing FEISHU_APP_ID or FEISHU_APP_SECRET"
}
```

## 强制刷新

```powershell
Invoke-WebRequest -UseBasicParsing https://lu-ai-toolkit-sync.army-815.workers.dev/api/resources?force=1
```

或：

```powershell
Invoke-WebRequest -UseBasicParsing -Method POST https://lu-ai-toolkit-sync.army-815.workers.dev/api/sync
```

## 前端接入约定

`index.html` 会请求相对路径 `/api/resources`。因此：

- 使用 Worker + Assets 同域部署时，前端能直接读取 API。
- 使用 Pages 单独部署时，Pages 域名没有内置 `/api/resources`，前端会回退到内置静态数据。
- 后续如需 Pages 也实时同步，应配置 Pages Functions、反向代理或把 API 地址改为完整 Worker URL。

## 数据模型

### Tool

```json
{
  "id": "record_id",
  "name": "工具名称",
  "type": "类型",
  "category": "使用场景",
  "description": "内容",
  "url": "网页链接",
  "tutorialLinks": [],
  "rating": 4,
  "updateTime": "2026-06-17",
  "usageStatus": "熟悉"
}
```

### Workflow

```json
{
  "id": "record_id",
  "title": "标题内容",
  "date": "2026-06-17",
  "content": "内容",
  "links": [],
  "software": [],
  "scenarios": []
}
```

### Prompt

```json
{
  "id": "record_id",
  "author": "作者",
  "date": "2026-06-17",
  "title": "文本",
  "prompt": "提示词",
  "types": [],
  "rating": 4,
  "status": "非常好用"
}
```

## 字段变更规则

飞书字段名变化时，必须同步修改：

- `worker/index.js` 的 `mapToolRecord`
- `worker/index.js` 的 `mapWorkflowRecord`
- `worker/index.js` 的 `mapPromptRecord`
- 本文档的数据模型说明
- `docs/runbook.md` 的排障说明
