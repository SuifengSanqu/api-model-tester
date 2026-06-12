export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    
    // 处理 CORS 预检请求（OPTIONS）
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, anthropic-version, x-target-base',
          'Access-Control-Max-Age': '86400'
        }
      })
    }
    
    // 只处理 /api/ 开头的请求
    if (!url.pathname.startsWith('/api/')) {
      return new Response('Not Found', { status: 404 })
    }
    
    // 代理 API 请求
    const apiPath = url.pathname.replace(/^\/api/, '')
    
    // 从请求头获取目标 API 地址
    let targetBase = request.headers.get('x-target-base')
    if (!targetBase) {
      targetBase = 'https://ark.cn-beijing.volces.com'
    }
    targetBase = targetBase.replace(/\/$/, '')
    
    const targetUrl = targetBase + apiPath
    
    // 构建转发请求头
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')
    
    if (request.headers.has('authorization')) {
      headers.set('Authorization', request.headers.get('authorization'))
    }
    if (request.headers.has('x-api-key')) {
      headers.set('x-api-key', request.headers.get('x-api-key'))
    }
    if (request.headers.has('anthropic-version')) {
      headers.set('anthropic-version', request.headers.get('anthropic-version'))
    }
    
    // 构建请求体
    let body = null
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request.text()
    }
    
    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body
      })
      
      const data = await response.json()
      
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, anthropic-version, x-target-base'
        }
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
  }
}
