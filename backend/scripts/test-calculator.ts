/**
 * 自动化测试脚本：构建 Web 版计算器
 * 
 * 使用方法：
 * cd backend
 * npx ts-node scripts/test-calculator.ts
 */

import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'

// 使用 node-fetch
import fetch from 'node-fetch'

const API_URL = process.env.API_URL || 'http://localhost:3001'
const TEST_USER_MESSAGE = '生成一个计算器网页版'

interface StreamChunk {
  type: string
  agent?: string
  content?: string
  artifacts?: any[]
  error?: string
}

interface TestResult {
  success: boolean
  prd?: string
  architecture?: string
  code?: Record<string, string>
  sandboxUrl?: string
  previewUrl?: string
  errors: string[]
  warnings: string[]
}

/**
 * 发送消息并接收流式响应
 */
async function sendMessage(message: string): Promise<TestResult> {
  const result: TestResult = {
    success: false,
    errors: [],
    warnings: [],
  }

  console.log(`\n📤 发送消息: "${message}"`)
  console.log(`📡 连接到: ${API_URL}/api/chat/stream\n`)

  try {
    const response = await fetch(`${API_URL}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        projectId: 'test-calculator',
        userId: 'test-user',
        conversationHistory: [],
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    if (!response.body) {
      throw new Error('No response body')
    }

    // node-fetch 的 body 是 Node.js Readable stream
    const stream = response.body as any
    const decoder = new TextDecoder()
    let buffer = ''
    let currentAgent: string | null = null
    let lastCompleteChunk: StreamChunk | null = null

    console.log('📥 接收流式响应...\n')
    
    const startTime = Date.now()
    const maxWaitTime = 10 * 60 * 1000 // 最大等待时间：10分钟
    let chunkCount = 0

    // 使用 Node.js stream 方式读取
    let hasReceivedData = false
    try {
      for await (const chunk of stream) {
        hasReceivedData = true
        chunkCount++
      const elapsedTime = Date.now() - startTime
      
      // 超时检查
      if (elapsedTime > maxWaitTime) {
        console.warn(`\n⚠️ 超过最大等待时间 (${maxWaitTime / 1000 / 60} 分钟)，停止等待`)
        result.errors.push(`超时：超过最大等待时间`)
        break
      }
      
      // 每50个块输出一次进度
      if (chunkCount % 50 === 0) {
        const minutes = Math.floor(elapsedTime / 60000)
        const seconds = Math.floor((elapsedTime % 60000) / 1000)
        console.log(`   ⏳ 处理中... (已处理 ${chunkCount} 个块, 耗时 ${minutes}m ${seconds}s)`)
      }
      const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        
        if (line.startsWith('data: ')) {
          try {
            const data: StreamChunk = JSON.parse(line.slice(6))

            // 处理不同类型的消息
            if (data.type === 'agent_start') {
              currentAgent = data.agent || null
              console.log(`🚀 ${data.agent?.toUpperCase()} 开始工作...`)
            } else if (data.type === 'content_update') {
              // 流式更新，显示进度（每100个字符换行一次，避免单行太长）
              const content = data.content || ''
              if (content.length > 0) {
                // 只在内容有显著变化时才输出（避免过度刷新）
                const lastChar = content[content.length - 1]
                if (lastChar === '\n' || content.length % 200 === 0) {
                  const lines = content.split('\n').slice(-3) // 只显示最后3行
                  process.stdout.write(`\r   ${lines.join('\n   ')}`)
                }
              }
            } else if (data.type === 'agent_complete') {
              currentAgent = null
              process.stdout.write('\n') // 换行
              console.log(`✅ ${data.agent?.toUpperCase()} 完成工作`)
              
              // 保存 artifacts
              if (data.artifacts) {
                for (const artifact of data.artifacts) {
                  if (artifact.type === 'prd') {
                    result.prd = artifact.content
                    console.log(`   📋 PRD 已生成 (${artifact.content.length} 字符)`)
                  } else if (artifact.type === 'architecture') {
                    result.architecture = artifact.content
                    console.log(`   🏗️ 架构已生成 (${artifact.content.length} 字符)`)
                  } else if (artifact.type === 'code') {
                    result.code = artifact.content
                    const fileCount = Object.keys(artifact.content).length
                    console.log(`   💻 代码已生成 (${fileCount} 个文件)`)
                    
                    // 检查是否有沙盒 URL
                    if (artifact.sandboxInfo?.websiteUrl) {
                      result.sandboxUrl = artifact.sandboxInfo.websiteUrl
                      console.log(`   🌐 沙盒 URL: ${result.sandboxUrl}`)
                    }
                  }
                }
              }
              
              lastCompleteChunk = data
            } else if (data.type === 'complete') {
              console.log(`\n🎉 项目完成！\n`)
              result.success = true
              lastCompleteChunk = data
            } else if (data.type === 'error') {
              result.errors.push(data.error || 'Unknown error')
              console.error(`\n❌ 错误: ${data.error}`)
            } else if (data.type === 'done') {
              console.log('\n✅ 流式响应完成\n')
            }
          } catch (err) {
            console.error('解析响应错误:', err)
          }
        }
      }
    }
  } catch (streamError: any) {
      // 处理流式响应错误
      if (streamError.code === 'ERR_STREAM_PREMATURE_CLOSE' || streamError.message?.includes('Premature close')) {
        if (hasReceivedData && result.code) {
          console.warn('\n⚠️ 流式响应提前关闭，但已获取到代码')
          console.warn('   这可能是因为后端连接关闭，但代码已生成')
          // 如果已经获取到代码，继续测试
        } else {
          result.errors.push(`流式响应提前关闭: ${streamError.message || 'Unknown error'}`)
          console.error(`\n❌ 流式响应错误: ${streamError.message || 'Unknown error'}`)
          console.error('   💡 提示: 检查后端服务是否正常运行')
        }
      } else {
        result.errors.push(`流式响应错误: ${streamError.message || 'Unknown error'}`)
        console.error(`\n❌ 流式响应错误: ${streamError.message || 'Unknown error'}`)
      }
    }

    // 处理最后的完成消息
    if (lastCompleteChunk?.artifacts) {
      for (const artifact of lastCompleteChunk.artifacts) {
        if (artifact.type === 'code' && !result.code) {
          result.code = artifact.content
        }
        if (artifact.sandboxInfo?.websiteUrl && !result.sandboxUrl) {
          result.sandboxUrl = artifact.sandboxInfo.websiteUrl
        }
      }
    }

  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    console.error('❌ 请求失败:', error)
  }

  return result
}

/**
 * 从代码生成预览 HTML
 */
function generatePreviewHTML(code: Record<string, string>): string {
  const mainFilePath = 'index.html' in code 
    ? 'index.html' 
    : 'App.tsx' in code 
    ? 'App.tsx' 
    : 'App.jsx' in code 
    ? 'App.jsx' 
    : Object.keys(code)[0]
  
  if (!mainFilePath) {
    return '<html><body><h1>No code found</h1></body></html>'
  }
  
  const mainCode = code[mainFilePath] || ''
  
  // 如果是 React 代码
  if (mainCode.includes('React') || mainCode.includes('react') || mainCode.includes('JSX')) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Calculator Preview</title>
  <script crossorigin src="https://cdn.staticfile.org/react/18.2.0/umd/react.development.js"></script>
  <script crossorigin src="https://cdn.staticfile.org/react-dom/18.2.0/umd/react-dom.development.js"></script>
  <script src="https://cdn.staticfile.org/babel-standalone/7.23.5/babel.min.js"></script>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    ${code['index.css'] || code['App.css'] || ''}
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useCallback, useEffect } = React;
    ${mainCode
      .replace(/export default/g, 'const App =')
      .replace(/export /g, '')
      // 移除所有 import 语句（包括 CSS import）
      .replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '')
      .replace(/import\s+['"].*?['"];?\s*/g, '')
      // 移除 TypeScript 接口定义
      .replace(/interface\s+\w+\s*\{[^}]*\}\s*/g, '')
      .replace(/type\s+\w+\s*=\s*.*?;\s*/g, '')
      // 移除 TypeScript 类型注解
      .replace(/:\s*React\.FC\s*(<[^>]*>)?/g, '')
      .replace(/:\s*React\.ComponentType\s*(<[^>]*>)?/g, '')
      .replace(/:\s*React\.Component\s*(<[^>]*>)?/g, '')
      .replace(/:\s*React\.FC/g, '')
      .replace(/:\s*React\.ComponentType/g, '')
      .replace(/:\s*React\.Component/g, '')
      // 移除泛型类型参数（如 useState<number | null>）
      .replace(/useState\s*<[^>]+>/g, 'useState')
      .replace(/useCallback\s*<[^>]+>/g, 'useCallback')
      .replace(/useEffect\s*<[^>]+>/g, 'useEffect')
      // 移除函数参数和返回值的类型注解
      .replace(/:\s*number\s*\|\s*null/g, '')
      .replace(/:\s*string\s*\|\s*null/g, '')
      .replace(/:\s*boolean\s*\|\s*null/g, '')
      .replace(/:\s*number\s*\|\s*string/g, '')
      .replace(/:\s*number/g, '')
      .replace(/:\s*string/g, '')
      .replace(/:\s*boolean/g, '')
      .replace(/:\s*void/g, '')
      .replace(/:\s*any/g, '')
      // 移除其他泛型
      .replace(/<number\s*\|\s*null>/g, '')
      .replace(/<string\s*\|\s*null>/g, '')
      .replace(/<boolean\s*\|\s*null>/g, '')
      .replace(/<number>/g, '')
      .replace(/<string>/g, '')
      .replace(/<boolean>/g, '')
      // 移除重复的 App 定义（如 const App = App;）
      .replace(/const\s+App\s*=\s*App\s*;/g, '')
      .replace(/let\s+App\s*=\s*App\s*;/g, '')
      .replace(/var\s+App\s*=\s*App\s*;/g, '')
    }
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  </script>
</body>
</html>
    `
  }
  
  // 普通 HTML
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Calculator Preview</title>
  <style>
    ${code['index.css'] || code['App.css'] || 'body { margin: 0; padding: 20px; }'}
  </style>
</head>
<body>
  ${mainCode}
</body>
</html>
  `
}

/**
 * 测试预览页面（带重试机制）
 */
async function testPreview(url: string, expectedFeatures: string[], maxRetries: number = 3): Promise<{ passed: boolean, issues: string[] }> {
  const issues: string[] = []
  
  console.log(`\n🔍 测试预览页面: ${url}\n`)
  
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (attempt > 1) {
      console.log(`\n🔄 重试第 ${attempt}/${maxRetries} 次...`)
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt)) // 递增等待时间
    }
    
    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
      
      const page = await browser.newPage()
      await page.setViewport({ width: 1280, height: 720 })
      
      // 监听控制台错误
      const consoleErrors: string[] = []
      page.on('console', msg => {
        const type = msg.type()
        const text = msg.text()
        if (type === 'error') {
          consoleErrors.push(text)
          // 只显示非网络错误（网络错误可能是CDN问题，不影响功能）
          if (!text.includes('ERR_CONNECTION') && !text.includes('Failed to load resource')) {
            console.error(`   🚨 控制台错误: ${text}`)
          }
        }
      })
      
      // 监听页面错误
      page.on('pageerror', (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error)
        consoleErrors.push(errorMessage)
        console.error(`   🚨 页面错误: ${errorMessage}`)
      })
      
      // 访问页面（增加超时时间）
      try {
        await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: 45000, // 增加超时时间
        })
      } catch (gotoError) {
        // 如果是网络错误，尝试重试
        if (gotoError instanceof Error && (
          gotoError.message.includes('net::ERR') || 
          gotoError.message.includes('Navigation timeout')
        )) {
          await browser.close()
          lastError = gotoError
          if (attempt < maxRetries) {
            console.warn(`   ⚠️ 页面加载失败，将重试: ${gotoError.message}`)
            continue
          }
        }
        throw gotoError
      }
    
    // 等待 React 编译和渲染（Babel 需要时间编译 JSX）
    console.log('   ⏳ 等待 React 编译和渲染...')
    await new Promise(resolve => setTimeout(resolve, 2000)) // 初始等待
    
    // 等待 React 组件渲染完成 - 使用智能等待
    try {
      await page.waitForSelector('#root', { timeout: 5000 })
      console.log('   ✅ 找到 root 元素')
      
      // 等待按钮元素出现（计算器应该有按钮）
      console.log('   ⏳ 等待计算器组件渲染 (寻找 Button 元素)...')
      try {
        await page.waitForSelector('button', { timeout: 15000 })
        console.log('   ✅ 检测到按钮元素，React 已挂载')
      } catch (e) {
        console.warn('   ⚠️ 等待按钮超时，尝试截图当前状态...')
        const screenshotsDir = path.join(__dirname, '../../screenshots')
        if (!fs.existsSync(screenshotsDir)) {
          fs.mkdirSync(screenshotsDir, { recursive: true })
        }
        const debugPath = path.join(screenshotsDir, `debug-failure-${Date.now()}.png`)
        await page.screenshot({ path: debugPath, fullPage: true })
        console.log(`   📸 调试截图已保存至: ${debugPath}`)
        
        // 获取页面 HTML 片段用于调试
        const pageContent = await page.evaluate(() => {
          // @ts-ignore - document is available in browser context
          return document.body.innerHTML.substring(0, 500)
        })
        console.log(`   📄 页面内容预览: ${pageContent}...`)
      }
    } catch (e) {
      console.warn(`   ⚠️ 等待渲染超时: ${e instanceof Error ? e.message : String(e)}`)
    }
    
    // 如果有错误，添加到 issues
    if (consoleErrors.length > 0) {
      issues.push(`JavaScript 错误: ${consoleErrors.join('; ')}`)
    }
    
    // 截图
    const screenshotsDir = path.join(__dirname, '../../screenshots')
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true })
    }
    const screenshotPath = path.join(screenshotsDir, `test-calculator-${Date.now()}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: true })
    console.log(`📸 截图已保存: ${screenshotPath}`)
    
    // 检查页面内容
    const pageContent = await page.content()
    const pageText = await page.evaluate(() => {
      // @ts-ignore - document 在浏览器环境中存在
      return document.body ? document.body.innerText : ''
    })
    
    console.log(`\n📄 页面内容预览:`)
    console.log(`   ${pageText.substring(0, 200)}...`)
    
    // 检查页面是否真的渲染了内容
    const rootContent = await page.evaluate(() => {
      // @ts-ignore
      const root = document.getElementById('root')
      return root ? root.innerHTML : ''
    })
    
    console.log(`\n📦 Root 元素内容长度: ${rootContent.length}`)
    if (rootContent.length < 10) {
      issues.push('React 组件可能未正确渲染（root 元素为空）')
      console.log(`   ⚠️ Root 内容: ${rootContent.substring(0, 200)}`)
    }
    
    // 检查预期功能
    console.log(`\n✅ 检查预期功能:`)
    for (const feature of expectedFeatures) {
      const hasFeature = pageText.toLowerCase().includes(feature.toLowerCase()) ||
                        pageContent.toLowerCase().includes(feature.toLowerCase()) ||
                        rootContent.toLowerCase().includes(feature.toLowerCase())
      
      if (hasFeature) {
        console.log(`   ✅ ${feature}`)
      } else {
        console.log(`   ❌ ${feature}`)
        issues.push(`缺少功能: ${feature}`)
      }
    }
    
    // 检查是否有按钮或交互元素（包括类名包含 button 的元素）
    const buttons = await page.$$('button')
    const inputs = await page.$$('input')
    const clickableElements = await page.$$('[onclick], [role="button"], .button, [class*="button"]')
    
    console.log(`\n🔘 交互元素:`)
    console.log(`   按钮: ${buttons.length}`)
    console.log(`   输入框: ${inputs.length}`)
    console.log(`   可点击元素: ${clickableElements.length}`)
    
    // 详细分析页面内容
    const evalResult = await page.evaluate(() => {
      // @ts-ignore
      const buttons = Array.from(document.querySelectorAll('button'))
      // @ts-ignore
      const rootText = document.getElementById('root')?.innerText || ''
      // @ts-ignore
      const bodyText = document.body.innerText
      
      return {
        buttonCount: buttons.length,
        hasNumbers: /[0-9]/.test(bodyText),
        buttonTexts: buttons.map((b: any) => b.innerText).slice(0, 10), // 取前10个看样本
        rootTextLength: rootText.length
      }
    })

    console.log('\n   📊 页面内容分析:')
    console.log(`      - 按钮数量: ${evalResult.buttonCount} (预期 >= 10)`)
    console.log(`      - 包含数字: ${evalResult.hasNumbers}`)
    console.log(`      - 按钮样本: ${JSON.stringify(evalResult.buttonTexts)}`)
    
    if (evalResult.buttonCount < 10) {
      console.warn('   ⚠️ 警告：按钮数量似乎不足，可能是渲染不完整')
      issues.push(`按钮数量不足 (${evalResult.buttonCount} 个，预期 >= 10)`)
    } else {
      console.log('   ✅ 确认：页面结构符合计算器特征')
    }
    
    if (buttons.length === 0 && clickableElements.length === 0) {
      issues.push('没有找到交互元素（按钮等）')
    } else {
      // 尝试点击一个按钮看看是否有响应
      try {
        const firstButton = buttons[0] || clickableElements[0]
        if (firstButton) {
          await firstButton.click()
          await new Promise(resolve => setTimeout(resolve, 500))
          console.log(`   ✅ 成功点击了一个按钮`)
        }
      } catch (e) {
        console.log(`   ⚠️ 无法点击按钮: ${e}`)
      }
    }
    
    // 检查是否有数字显示（包括在 HTML 中）
    const hasNumbers = /[0-9]/.test(pageText) || /[0-9]/.test(rootContent) || evalResult.hasNumbers
    if (!hasNumbers) {
      issues.push('页面中没有数字显示')
    } else {
      console.log(`   ✅ 找到数字显示`)
    }
    
      await browser.close()
      
      // 如果成功，返回结果
      return {
        passed: issues.length === 0,
        issues,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`   ⚠️ 尝试 ${attempt} 失败: ${lastError.message}`)
      
      if (attempt === maxRetries) {
        // 最后一次尝试也失败
        issues.push(`测试失败（已重试 ${maxRetries} 次）: ${lastError.message}`)
        return {
          passed: false,
          issues,
        }
      }
      // 继续重试
    }
  }
  
  // 所有重试都失败
  issues.push(`测试失败（已重试 ${maxRetries} 次）: ${lastError?.message || 'Unknown error'}`)
  return {
    passed: false,
    issues,
  }
}

/**
 * 主测试函数
 */
async function main() {
  console.log('🧪 开始自动化测试：Web 版计算器\n')
  console.log('=' .repeat(60))
  console.log('⚠️  注意：此测试需要较长时间（AI 调用），请耐心等待...\n')
  
  // 1. 发送消息并获取结果
  const result = await sendMessage(TEST_USER_MESSAGE)
  
  if (result.errors.length > 0) {
    console.error('\n❌ 测试失败，错误:')
    result.errors.forEach(err => console.error(`   - ${err}`))
    console.log('\n💡 提示:')
    console.log('   - 确保后端 API 运行在 http://localhost:3001')
    console.log('   - 检查 API 端点是否正确: /api/chat/stream')
    console.log('   - 确保环境变量 ANTHROPIC_API_KEY 已设置')
    process.exit(1)
  }
  
  if (!result.code) {
    console.error('\n❌ 测试失败：没有生成代码')
    console.log('\n💡 提示:')
    console.log('   - 检查后端日志，查看是否有错误')
    console.log('   - 确保 AI 调用成功')
    console.log('   - 等待时间可能不够，代码生成需要较长时间')
    process.exit(1)
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('📊 测试结果摘要:')
  console.log(`   PRD: ${result.prd ? '✅' : '❌'}`)
  console.log(`   架构: ${result.architecture ? '✅' : '❌'}`)
  console.log(`   代码: ${result.code ? `✅ (${Object.keys(result.code).length} 个文件)` : '❌'}`)
  console.log(`   沙盒 URL: ${result.sandboxUrl ? '✅' : '❌'}`)
  
  // 2. 测试预览页面
  let previewUrl = result.sandboxUrl
  
  if (!previewUrl) {
    // 如果没有沙盒 URL，生成预览 HTML
    console.log('\n📝 生成预览 HTML...')
    const html = generatePreviewHTML(result.code)
    const tempDir = path.join(__dirname, '../../temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    const tempFile = path.join(tempDir, `test-calculator-${Date.now()}.html`)
    fs.writeFileSync(tempFile, html, 'utf-8')
    previewUrl = `file://${tempFile}`
    console.log(`   预览文件: ${tempFile}`)
  }
  
  // 3. 测试预览页面
  const expectedFeatures = [
    '计算器',
    '数字',
    '按钮',
    '运算',
  ]
  
  const testResult = await testPreview(previewUrl, expectedFeatures)
  
  // 4. 输出最终结果
  console.log('\n' + '='.repeat(60))
  console.log('🎯 最终测试结果:')
  console.log('='.repeat(60))
  console.log(`   成功: ${testResult.passed ? '✅ 是' : '❌ 否'}`)
  
  if (testResult.issues.length > 0) {
    console.log(`\n⚠️ 发现的问题:`)
    testResult.issues.forEach((issue, idx) => {
      console.log(`   ${idx + 1}. ${issue}`)
    })
  }
  
  console.log('\n' + '='.repeat(60))
  
  if (testResult.passed) {
    console.log('\n🎉 测试通过！计算器已成功生成并可以正常使用。')
    process.exit(0)
  } else {
    console.log('\n⚠️ 测试发现问题，但基本功能可能可用。')
    console.log('   请检查生成的代码和预览页面。')
    process.exit(1)
  }
}

// 运行测试
main().catch(error => {
  console.error('❌ 测试执行失败:', error)
  process.exit(1)
})
