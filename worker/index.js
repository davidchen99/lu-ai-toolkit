const DEFAULT_TABLES = {
  tools: 'tblfxy4bf1GZjkOj',
  workflows: 'tblTQTdBYZi6oknL',
  prompts: 'tblAcyG2FFqtPPgj'
};

const CACHE_KEY = 'latest_resources';
const FEISHU_BASE = 'https://open.feishu.cn/open-apis';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return corsResponse(null, 204);
    if (url.pathname === '/api/health') return jsonResponse({ ok: true, service: 'lu-ai-toolkit-sync' });

    if (url.pathname === '/api/resources') {
      const force = url.searchParams.get('force') === '1';
      return getResources(env, force);
    }

    if (url.pathname === '/api/sync' && request.method === 'POST') {
      return getResources(env, true);
    }

    return jsonResponse({ ok: false, error: 'not_found' }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(refreshCache(env));
  }
};

async function refreshCache(env) {
  const data = await fetchFeishuResources(env);
  await writeCache(env, data);
  return data;
}

async function getResources(env, force) {
  const cached = await readCache(env);
  if (!force && cached) return jsonResponse({ ok: true, source: 'cache', data: cached });

  try {
    const data = await refreshCache(env);
    return jsonResponse({ ok: true, source: 'feishu', data });
  } catch (error) {
    if (cached) {
      return jsonResponse({
        ok: true,
        source: 'cache_fallback',
        warning: safeError(error),
        data: cached
      });
    }
    return jsonResponse({ ok: false, error: safeError(error) }, 502);
  }
}

async function fetchFeishuResources(env) {
  const token = await getTenantAccessToken(env);
  const baseToken = await resolveBaseToken(env, token);
  const tableIds = {
    tools: env.TOOL_TABLE_ID || DEFAULT_TABLES.tools,
    workflows: env.WORKFLOW_TABLE_ID || DEFAULT_TABLES.workflows,
    prompts: env.PROMPT_TABLE_ID || DEFAULT_TABLES.prompts
  };

  const [tools, workflows, prompts] = await Promise.all([
    listRecords(token, baseToken, tableIds.tools).then(records => records.map(mapToolRecord).filter(Boolean)),
    listRecords(token, baseToken, tableIds.workflows).then(records => records.map(mapWorkflowRecord).filter(Boolean)),
    listRecords(token, baseToken, tableIds.prompts).then(records => records.map(mapPromptRecord).filter(Boolean))
  ]);

  return {
    syncedAt: new Date().toISOString(),
    source: {
      baseToken,
      tableIds
    },
    tools,
    workflows,
    prompts
  };
}

async function getTenantAccessToken(env) {
  if (!env.FEISHU_APP_ID || !env.FEISHU_APP_SECRET) {
    throw new Error('missing FEISHU_APP_ID or FEISHU_APP_SECRET');
  }

  const response = await fetch(`${FEISHU_BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      app_id: env.FEISHU_APP_ID,
      app_secret: env.FEISHU_APP_SECRET
    })
  });
  const json = await response.json();
  if (!response.ok || json.code !== 0) throw new Error(`tenant token failed: ${json.msg || response.status}`);
  return json.tenant_access_token;
}

async function resolveBaseToken(env, token) {
  if (env.FEISHU_BASE_TOKEN) return env.FEISHU_BASE_TOKEN;
  const wikiToken = extractWikiToken(env.FEISHU_WIKI_URL);
  if (!wikiToken) throw new Error('missing FEISHU_BASE_TOKEN or FEISHU_WIKI_URL');

  const response = await feishuFetch(token, `/wiki/v2/spaces/get_node?token=${encodeURIComponent(wikiToken)}`);
  const node = response.data && response.data.node;
  if (!node || node.obj_type !== 'bitable' || !node.obj_token) {
    throw new Error('wiki URL does not resolve to a bitable');
  }
  return node.obj_token;
}

function extractWikiToken(value) {
  const text = String(value || '');
  const match = text.match(/\/wiki\/([^/?#]+)/);
  return match ? match[1] : '';
}

async function listRecords(token, baseToken, tableId) {
  const records = [];
  let pageToken = '';

  do {
    const query = new URLSearchParams({ page_size: '200' });
    if (pageToken) query.set('page_token', pageToken);
    const result = await feishuFetch(
      token,
      `/bitable/v1/apps/${baseToken}/tables/${tableId}/records/search?${query.toString()}`,
      { method: 'POST', body: '{}' }
    );
    const data = result.data || {};
    records.push(...(data.items || []));
    pageToken = data.page_token || '';
    if (!data.has_more) break;
  } while (pageToken);

  return records;
}

async function feishuFetch(token, path, init = {}) {
  const response = await fetch(`${FEISHU_BASE}${path}`, {
    method: init.method || 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers || {})
    },
    body: init.body
  });
  const json = await response.json();
  if (!response.ok || json.code !== 0) {
    throw new Error(`Feishu API failed ${path}: ${json.msg || response.status}`);
  }
  return json;
}

function mapToolRecord(record) {
  const fields = record.fields || {};
  const name = asText(fields['工具名称']);
  const description = asText(fields['内容']);
  if (!name && !description) return null;
  return {
    id: record.record_id,
    name,
    type: firstText(fields['类型']),
    category: joinText(fields['使用场景']),
    description,
    url: firstUrl(fields['网页链接']),
    tutorialLinks: allUrls(fields['教学链接']),
    rating: Number(fields['实用频率'] || 0),
    updateTime: asDate(fields['更新时间（保质期）']),
    usageStatus: firstText(fields['是否使用'])
  };
}

function mapWorkflowRecord(record) {
  const fields = record.fields || {};
  const title = asText(fields['标题内容']);
  const content = asText(fields['内容']);
  if (!title && !content) return null;
  return {
    id: record.record_id,
    title,
    date: asDate(fields['日期']),
    content,
    links: [...allUrls(fields['工具链接']), ...allUrls(fields['参考教程'])],
    software: toTextArray(fields['涉及的软件']),
    scenarios: toTextArray(fields['场景'])
  };
}

function mapPromptRecord(record) {
  const fields = record.fields || {};
  const prompt = asText(fields['提示词']);
  const title = asText(fields['文本']) || prompt.slice(0, 40);
  if (!title && !prompt) return null;
  return {
    id: record.record_id,
    author: asText(fields['作者']),
    date: asDate(fields['日期']),
    title,
    prompt,
    types: toTextArray(fields['类型']),
    rating: Number(fields['有用/趣评分'] || 0),
    status: joinText(fields['是否使用'])
  };
}

function asText(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join('\n');
  if (typeof value === 'object') {
    if (value.text) return asText(value.text);
    if (value.name) return asText(value.name);
    if (value.link) return asText(value.link);
    if (value.url) return asText(value.url);
    return Object.values(value).map(asText).filter(Boolean).join(' ');
  }
  return String(value).trim();
}

function toTextArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(asText).filter(Boolean);
  const text = asText(value);
  return text ? [text] : [];
}

function firstText(value) {
  return toTextArray(value)[0] || '';
}

function joinText(value) {
  return toTextArray(value).join('、');
}

function asDate(value) {
  if (!value) return '';
  if (typeof value === 'number') return new Date(value).toISOString().slice(0, 10);
  const text = asText(value);
  return text ? text.slice(0, 10) : '';
}

function allUrls(value) {
  const text = asText(value);
  if (!text) return [];
  const urls = text.match(/https?:\/\/[^\s)\]]+/g) || [];
  return Array.from(new Set(urls.map(url => url.replace(/[，。);]+$/g, ''))));
}

function firstUrl(value) {
  return allUrls(value)[0] || '';
}

async function readCache(env) {
  if (env.AI_TOOLKIT_CACHE) {
    const raw = await env.AI_TOOLKIT_CACHE.get(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  }
  if (typeof caches === 'undefined') return null;
  const response = await caches.default.match(cacheRequest());
  return response ? response.json() : null;
}

async function writeCache(env, data) {
  if (env.AI_TOOLKIT_CACHE) {
    await env.AI_TOOLKIT_CACHE.put(CACHE_KEY, JSON.stringify(data));
    return;
  }
  if (typeof caches === 'undefined') return;
  await caches.default.put(cacheRequest(), new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=86400'
    }
  }));
}

function cacheRequest() {
  return new Request(`https://lu-ai-toolkit.local/cache/${CACHE_KEY}`);
}

function corsResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type'
    }
  });
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*'
    }
  });
}

function safeError(error) {
  return error && error.message ? error.message : String(error);
}
