import express from 'express'
import cors from 'cors'
import { createServer as createViteServer } from 'vite'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const isProduction = process.env.NODE_ENV === 'production'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// 代理 API 请求
app.use('/api', async (req, res) => {
  const apiPath = req.originalUrl.replace(/^\/api/, '')
  
  let targetBase = req.headers['x-target-base'] || 'https://ark.cn-beijing.volces.com'
  targetBase = targetBase.replace(/\/$/, '')
  
  const targetUrl = targetBase + apiPath
  
  const headers = {
    'Content-Type': 'application/json'
  }
  
  if (req.headers['authorization']) {
    headers['Authorization'] = req.headers['authorization']
  }
  if (req.headers['x-api-key']) {
    headers['x-api-key'] = req.headers['x-api-key']
  }
  if (req.headers['anthropic-version']) {
    headers['anthropic-version'] = req.headers['anthropic-version']
  }

  try {
    const fetchOptions = {
      method: req.method,
      headers
    }
    
    if (req.method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
      fetchOptions.body = JSON.stringify(req.body)
    }
    
    const response = await fetch(targetUrl, fetchOptions)
    const data = await response.json()
    
    res.status(response.status).json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

if (isProduction) {
  // 生产环境：服务静态文件
  const distPath = join(__dirname, 'dist')
  
  if (existsSync(distPath)) {
    app.use(express.static(distPath))
    
    app.get('*', (req, res) => {
      res.sendFile(join(distPath, 'index.html'))
    })
    
    app.listen(PORT, () => {
      console.log(`Production server running on port ${PORT}`)
    })
  } else {
    console.error('dist directory not found!')
    process.exit(1)
  }
} else {
  // 开发环境：使用 Vite 中间件
  const createViteServer = (await import('vite')).createServer
  
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  })
  
  app.use(vite.middlewares)
  
  app.listen(PORT, () => {
    console.log(`Development server running on port ${PORT}`)
  })
}
