import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// 代理 API 请求
app.use('/api', async (req, res) => {
  // req.originalUrl: /api/models or /api/chat/completions
  const apiPath = req.originalUrl.replace(/^\/api/, '') // /models or /chat/completions
  
  // Get target base from header, default to volcano
  let targetBase = req.headers['x-target-base'] || 'https://ark.cn-beijing.volces.com'
  
  // Remove trailing slash from base
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
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 服务静态文件（生产环境）
app.use(express.static(join(__dirname, 'dist')))

// 所有其他请求返回 index.html（SPA 路由）
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
