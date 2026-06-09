<script setup>
import { ref, computed } from 'vue'

const apiType = ref('openai')
const apiBase = ref('')
const apiKey = ref('')
const useLocalProxy = ref(false)
const localProxyUrl = ref('http://localhost:3001')
const fetchingModels = ref(false)
const testing = ref(false)
const results = ref([])
const modelList = ref([])
const step = ref(1)

const selectedPreset = ref('')

const presets = [
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', type: 'openai' },
  { name: 'Anthropic (Claude)', baseUrl: 'https://api.anthropic.com/v1', type: 'claude' },
  { name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', type: 'openai' },
  { name: '火山引擎 (豆包)', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', type: 'openai' },
  { name: '阿里云 (DashScope)', baseUrl: 'https://dashscope.aliyuncs.com/api/v1', type: 'openai' },
  { name: '百度智能云', baseUrl: 'https://qianfan.baidubce.com/v2', type: 'openai' },
  { name: 'Azure OpenAI', baseUrl: '', type: 'openai' },
  { name: '自定义 (兼容 OpenAI)', baseUrl: '', type: 'openai' },
  { name: '自定义 (兼容 Claude)', baseUrl: '', type: 'claude' },
]

const handlePresetChange = () => {
  const preset = presets.find(p => p.name === selectedPreset.value)
  if (preset) {
    apiType.value = preset.type
    if (preset.baseUrl) {
      apiBase.value = preset.baseUrl
    }
  }
}

const isProduction = window.location.hostname !== 'localhost'

const getUrl = (path) => {
  // 生产环境自动使用同源代理，开发环境根据选项决定
  const shouldUseProxy = isProduction || useLocalProxy.value
  if (shouldUseProxy) {
    return `/api/${path}`
  }
  let url = apiBase.value.endsWith('/') ? apiBase.value + path : apiBase.value + '/' + path
  return url
}

const getFetchOptions = (headers, method = 'GET', body = undefined) => {
  const options = {
    method,
    headers
  }
  
  if (body) {
    options.body = body
  }
  
  if (useLocalProxy.value) {
    headers['x-target-base'] = apiBase.value
  }
  
  return options
}

const classifyError = (statusCode, errorMessage) => {
  const msg = (errorMessage || '').toLowerCase()
  
  if (statusCode === 403 || msg.includes('permission') || msg.includes('not enabled') || 
      msg.includes('model not found') || msg.includes('not enabled') || msg.includes('无权限')) {
    return 'permission'
  }
  
  if (statusCode === 429 || msg.includes('rate limit') || msg.includes('quota') || 
      msg.includes('limit exceeded') || msg.includes('too many') || msg.includes('限额') || 
      msg.includes('超过限制') || msg.includes('frequency')) {
    return 'quota'
  }
  
  if (statusCode === 402 || msg.includes('insufficient') || msg.includes('balance') || 
      msg.includes('余额') || msg.includes('credit') || msg.includes('欠费')) {
    return 'balance'
  }
  
  if (statusCode === 401 || msg.includes('unauthorized') || msg.includes('invalid api') || 
      msg.includes('authentication')) {
    return 'auth'
  }
  
  if (msg.includes('empty') || msg.includes('空响应') || msg.includes('model')) {
    return 'model_error'
  }
  
  return 'other'
}

const fetchModelList = async () => {
  if (!apiBase.value || !apiKey.value) {
    alert('请填写 API 端点和 Key')
    return
  }

  fetchingModels.value = true
  modelList.value = []

  try {
    const headers = {}

    if (apiType.value === 'openai') {
      headers['Authorization'] = `Bearer ${apiKey.value}`
    } else if (apiType.value === 'claude') {
      headers['x-api-key'] = apiKey.value
      headers['anthropic-version'] = '2023-06-01'
    }

    let url = apiBase.value
    if (apiType.value === 'openai' && !url.includes('/models')) {
      url = url.endsWith('/') ? url + 'models' : url + '/models'
    }
    if (apiType.value === 'claude' && !url.includes('/models')) {
      url = url.endsWith('/') ? url + 'models' : url + '/models'
    }

    const fetchOptions = getFetchOptions(headers, 'GET')
    
    if (useLocalProxy.value) {
      url = getUrl('models')
    }

    const response = await fetch(url, fetchOptions.headers ? { headers: fetchOptions.headers } : undefined)

    if (response.ok) {
      const data = await response.json()
      if (apiType.value === 'openai') {
        modelList.value = data.data?.map(m => m.id) || []
      } else if (apiType.value === 'claude') {
        modelList.value = data.data?.map(m => m.id) || []
      }
      if (modelList.value.length > 0) {
        step.value = 2
      } else {
        alert('未获取到模型列表')
      }
    } else {
      const errorData = await response.json().catch(() => ({}))
      alert(`获取模型列表失败: ${errorData.error?.message || `HTTP ${response.status}`}`)
    }
  } catch (e) {
    alert(`获取模型列表失败: ${e.message}`)
  }

  fetchingModels.value = false
}

const testModels = async () => {
  if (modelList.value.length === 0) {
    alert('请先获取模型列表')
    return
  }

  testing.value = true
  results.value = []

  for (const model of modelList.value) {
    const result = {
      model,
      available: false,
      latency: null,
      error: '',
      errorType: '',
      usage: null,
      startTime: Date.now()
    }

    try {
      let response
      const headers = { 'Content-Type': 'application/json' }

      if (apiType.value === 'openai') {
        headers['Authorization'] = `Bearer ${apiKey.value}`
      } else if (apiType.value === 'claude') {
        headers['x-api-key'] = apiKey.value
        headers['anthropic-version'] = '2023-06-01'
      }

      const testContent = '请简单回复：测试成功。这是一个 API 连接性测试。'
      
      const fetchOptions = getFetchOptions(
        headers, 
        'POST', 
        JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: testContent }],
          max_tokens: 100
        })
      )

      let url = getUrl('chat/completions')
      if (apiType.value === 'claude') {
        url = getUrl('messages')
        fetchOptions.body = JSON.stringify({
          model: model,
          max_tokens: 100,
          messages: [{ role: 'user', content: testContent }]
        })
      }

      response = await fetch(url, {
        method: 'POST',
        headers: fetchOptions.headers,
        body: fetchOptions.body
      })

      result.latency = Date.now() - result.startTime

      if (response.ok) {
        const data = await response.json()
        
        if (data.usage) {
          result.usage = data.usage
        }
        
        if (!data.choices || data.choices.length === 0) {
          result.available = false
          result.error = '模型返回空响应'
          result.errorType = 'model_error'
          result.rawResponse = data
        } else {
          result.available = true
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        const errorMsg = errorData.error?.message || `HTTP ${response.status}`
        result.error = errorMsg
        result.errorType = classifyError(response.status, errorMsg)
      }
    } catch (e) {
      result.error = e.message
      result.latency = Date.now() - result.startTime
    }

    results.value.push(result)
  }

  testing.value = false
}

const reset = () => {
  step.value = 1
  modelList.value = []
  results.value = []
}

const downloadFile = (content, filename, type) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const exportResults = () => {
  const availableModels = results.value.filter(r => r.available)
  
  if (availableModels.length === 0) {
    alert('没有可用的模型')
    return
  }

  const format = exportFormat.value
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  
  if (format === 'json') {
    const jsonData = {
      apiBase: apiBase.value,
      apiType: apiType.value,
      exportTime: new Date().toISOString(),
      totalModels: results.value.length,
      availableModels: availableModels.map(m => ({
        model: m.model,
        latency: m.latency,
        usage: m.usage
      }))
    }
    const jsonStr = JSON.stringify(jsonData, null, 2)
    downloadFile(jsonStr, `models-${timestamp}.json`, 'application/json')
  } else if (format === 'csv') {
    const csvHeader = 'Model,Latency (ms),Input Tokens,Output Tokens,Total Tokens\n'
    const csvRows = availableModels.map(m => 
      `"${m.model}",${m.latency || ''},${m.usage?.prompt_tokens || ''},${m.usage?.completion_tokens || ''},${m.usage?.total_tokens || ''}`
    ).join('\n')
    downloadFile(csvHeader + csvRows, `models-${timestamp}.csv`, 'text/csv')
  } else if (format === 'txt') {
    const txtList = availableModels.map(m => m.model).join('\n')
    downloadFile(txtList, `models-${timestamp}.txt`, 'text/plain')
  }
}

const sortBy = ref('name')
const exportFormat = ref('json')

const sortedResults = computed(() => {
  const resultsCopy = [...results.value]
  if (sortBy.value === 'latency') {
    return resultsCopy.sort((a, b) => {
      if (a.available && !b.available) return -1
      if (!a.available && b.available) return 1
      return (a.latency || 0) - (b.latency || 0)
    })
  }
  return resultsCopy.sort((a, b) => a.model.localeCompare(b.model))
})

const availableCount = computed(() => results.value.filter(r => r.available).length)
</script>

<template>
  <div class="container">
    <header>
      <h1>🔌 API Model Tester</h1>
      <p>测试你的 API Key 可用哪些模型</p>
    </header>

    <main>
      <div class="config-section">
        <h2>API 配置</h2>

        <div class="form-group">
          <label>快速选择</label>
          <select v-model="selectedPreset" @change="handlePresetChange">
            <option value="">自定义</option>
            <option v-for="p in presets" :key="p.name" :value="p.name">{{ p.name }}</option>
          </select>
        </div>

        <div class="form-group">
          <label>API 端点</label>
          <input
            v-model="apiBase"
            placeholder="例如: https://api.openai.com/v1"
          />
        </div>

        <div class="form-group">
          <label>API Key</label>
          <input
            v-model="apiKey"
            type="password"
            placeholder="输入你的 API Key"
          />
        </div>

        <div class="form-group">
          <label>API 类型</label>
          <select v-model="apiType">
            <option value="openai">OpenAI 兼容</option>
            <option value="claude">Claude 兼容</option>
          </select>
        </div>

        <div class="form-group checkbox-group">
          <label>
            <input type="checkbox" v-model="useLocalProxy" />
            启用本地代理服务（火山引擎等国内 API）
          </label>
          <p class="hint">
            火山引擎、百度等国内 API 不支持浏览器直接调用，需启用本地代理转发。
            <br/>
            代理已自动启动，地址：<code>http://localhost:3001</code>
          </p>
        </div>

        <button
          class="test-btn"
          @click="fetchModelList"
          :disabled="fetchingModels"
        >
          {{ fetchingModels ? '获取模型列表中...' : '获取模型列表' }}
        </button>

        <button class="clear-btn" @click="apiKey = ''; apiBase = ''; modelList = []; results = []; step = 1; selectedPreset = ''">
          一键清除
        </button>
      </div>

      <div v-if="step >= 2" class="models-section">
        <div class="models-header">
          <h2>可用模型 ({{ modelList.length }})</h2>
          <button class="reset-btn" @click="reset">重新配置</button>
        </div>
        <p class="hint">点击下方按钮开始测试所有模型的可用性</p>

        <button
          class="test-btn"
          @click="testModels"
          :disabled="testing"
        >
          {{ testing ? '测试中...' : '开始测试所有模型' }}
        </button>
      </div>

      <div v-if="results.length > 0" class="results-section">
        <div class="results-header">
          <h2>
            测试结果
            <span class="badge success">{{ availableCount }} / {{ results.length }} 可用</span>
          </h2>
          <div class="action-btns">
            <select class="export-select" v-model="exportFormat">
              <option value="json">JSON 格式</option>
              <option value="csv">CSV 表格</option>
              <option value="txt">TXT 文本</option>
            </select>
            <button class="export-btn" @click="exportResults" :disabled="availableCount === 0">
              📥 导出可用模型
            </button>
            <div class="sort-btns">
              <button :class="['sort-btn', sortBy === 'name' && 'active']" @click="sortBy = 'name'">按名字</button>
              <button :class="['sort-btn', sortBy === 'latency' && 'active']" @click="sortBy = 'latency'">按延迟</button>
            </div>
          </div>
        </div>

        <div class="results-list">
          <div
            v-for="(r, i) in sortedResults"
            :key="i"
            :class="['result-item', r.available ? 'success' : 'error', r.errorType]"
          >
            <div class="model-info">
              <div class="model-name">{{ r.model }}</div>
              <div v-if="r.usage" class="model-usage">
                消耗：{{ r.usage.total_tokens }} tokens 
                (输入：{{ r.usage.prompt_tokens }} / 输出：{{ r.usage.completion_tokens }})
              </div>
              <div v-if="!r.available && r.errorType" class="error-type">
                <span v-if="r.errorType === 'permission'" class="type-badge permission">🔒 未开通/无权限</span>
                <span v-else-if="r.errorType === 'quota'" class="type-badge quota">⏱️ 配额超限</span>
                <span v-else-if="r.errorType === 'balance'" class="type-badge balance">💰 余额不足</span>
                <span v-else-if="r.errorType === 'auth'" class="type-badge auth">🔑 API Key 无效</span>
                <span v-else-if="r.errorType === 'model_error'" class="type-badge model-error">⚠️ 模型异常 ({{ r.error }})</span>
                <span v-else class="type-badge other">❌ {{ r.error }}</span>
              </div>
            </div>
            <div class="model-status">
              <span v-if="r.available" class="status-badge success">
                ✓ 可用 ({{ r.latency }}ms)
              </span>
              <span v-else class="status-badge error">
                ✗ 不可用
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>

    <footer>
      <p>API Key 仅保存在浏览器本地，不会发送到任何服务器</p>
    </footer>
  </div>
</template>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

header {
  text-align: center;
  margin-bottom: 2rem;
}

header h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

header p {
  color: #666;
}

.config-section {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
}

h2 {
  font-size: 1.2rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.3rem;
  font-weight: 500;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.6rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: normal;
}

.checkbox-group input[type="checkbox"] {
  width: auto;
}

.checkbox-group .hint {
  margin-left: 1.5rem;
  margin-top: 0.5rem;
  color: #666;
  font-size: 0.85rem;
  line-height: 1.6;
}

.checkbox-group code {
  background: #f5f5f5;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: monospace;
}

.info-box {
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.info-box strong {
  color: #856404;
}

.info-box p {
  margin: 0.5rem 0 0;
  color: #856404;
  font-size: 0.9rem;
}

.info-box a {
  color: #007bff;
}

.test-btn {
  width: 100%;
  padding: 0.8rem;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.test-btn:hover:not(:disabled) {
  background: #45a049;
}

.test-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.clear-btn {
  width: 100%;
  padding: 0.6rem;
  margin-top: 0.5rem;
  background: #f5f5f5;
  color: #666;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
}

.clear-btn:hover {
  background: #eee;
}

.models-section {
  background: #fff;
  border: 1px solid #eee;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
}

.models-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.models-header h2 {
  margin-bottom: 0;
}

.reset-btn {
  padding: 0.4rem 0.8rem;
  background: #666;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.hint {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.results-section {
  background: #fff;
  border: 1px solid #eee;
  padding: 1.5rem;
  border-radius: 12px;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.results-header h2 {
  margin-bottom: 0;
}

.action-btns {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.export-btn {
  padding: 0.4rem 0.8rem;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}

.export-btn:hover:not(:disabled) {
  background: #1976D2;
}

.export-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-select {
  padding: 0.3rem 0.6rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
}

.sort-btns {
  display: flex;
  gap: 0.5rem;
}

.sort-btn {
  padding: 0.3rem 0.8rem;
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}

.sort-btn.active {
  background: #4CAF50;
  color: white;
  border-color: #4CAF50;
}

.badge {
  font-size: 0.85rem;
  padding: 0.2rem 0.6rem;
  border-radius: 20px;
  font-weight: normal;
}

.badge.success {
  background: #e8f5e9;
  color: #2e7d32;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 400px;
  overflow-y: auto;
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.8rem 1rem;
  border-radius: 8px;
}

.result-item.success {
  background: #e8f5e9;
}

.result-item.error {
  background: #ffebee;
}

.result-item.error.permission {
  background: #e3f2fd;
}

.result-item.error.quota {
  background: #fff3e0;
}

.result-item.error.balance {
  background: #ffebee;
}

.result-item.error.auth {
  background: #f3e5f5;
}

.result-item.error.model_error {
  background: #fff8e1;
}

.model-name {
  font-weight: 500;
  font-family: monospace;
  font-size: 0.9rem;
}

.model-usage {
  font-size: 0.8rem;
  color: #666;
  margin-top: 0.3rem;
}

.model-info {
  flex: 1;
}

.error-type {
  margin-top: 0.5rem;
}

.type-badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
}

.type-badge.permission {
  background: #e3f2fd;
  color: #1565c0;
}

.type-badge.quota {
  background: #fff3e0;
  color: #e65100;
}

.type-badge.balance {
  background: #ffebee;
  color: #c62828;
}

.type-badge.auth {
  background: #f3e5f5;
  color: #6a1b9a;
}

.type-badge.model-error {
  background: #fff8e1;
  color: #f57f17;
}

.type-badge.other {
  background: #f5f5f5;
  color: #616161;
}

.status-badge {
  font-size: 0.85rem;
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  white-space: nowrap;
}

.status-badge.success {
  color: #2e7d32;
}

.status-badge.error {
  color: #c62828;
}

footer {
  text-align: center;
  margin-top: 2rem;
  color: #999;
  font-size: 0.85rem;
}
</style>
