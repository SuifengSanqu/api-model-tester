import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

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

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`)
})
