export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    
    // CORS preflight
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
    
    // Handle API requests
    if (url.pathname.startsWith('/api/')) {
      const apiPath = url.pathname.replace(/^\/api/, '')
      let targetBase = request.headers.get('x-target-base') || 'https://ark.cn-beijing.volces.com'
      targetBase = targetBase.replace(/\/$/, '')
      
      const headers = new Headers({ 'Content-Type': 'application/json' })
      if (request.headers.has('authorization')) headers.set('Authorization', request.headers.get('authorization'))
      if (request.headers.has('x-api-key')) headers.set('x-api-key', request.headers.get('x-api-key'))
      if (request.headers.has('anthropic-version')) headers.set('anthropic-version', request.headers.get('anthropic-version'))
      
      let body = null
      if (request.method !== 'GET' && request.method !== 'HEAD') body = await request.text()
      
      try {
        const response = await fetch(targetBase + apiPath, { method: request.method, headers, body })
        const data = await response.json()
        return new Response(JSON.stringify(data), {
          status: response.status,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        })
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        })
      }
    }
    
    // Let Workers Assets handle static files
    return env.ASSETS.fetch(request)
  }
}
