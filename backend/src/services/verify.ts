/**
 * 验证服务
 * 自动截图预览页面并使用 AI 分析
 */

import Anthropic from '@anthropic-ai/sdk'
import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const mkdir = promisify(fs.mkdir)
const writeFile = promisify(fs.writeFile)
const unlink = promisify(fs.unlink)

interface VerifyResult {
  passed: boolean
  issues: string[]
  suggestions: string[]
  screenshotPath?: string
  needsImprovement: boolean
}

interface VerifyOptions {
  previewUrl?: string // 可选，如果有沙盒 URL
  userRequirement: string
  prd?: string
  architecture?: string
  code?: Record<string, string> // 如果没有 previewUrl，使用代码生成预览
}

// 延迟初始化 client
let client: Anthropic | null = null

function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for verification')
    }
    client = new Anthropic({
      apiKey: apiKey,
    })
  }
  return client
}

/**
 * 从代码生成预览 HTML
 */
export function generatePreviewHTMLFromCode(code: Record<string, string>): string {
  // 找到主文件
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
  <title>Preview</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
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
  <title>Preview</title>
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
 * 截图预览页面
 */
async function captureScreenshot(urlOrCode: string | Record<string, string>): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  
  try {
    const page = await browser.newPage()
    
    // 设置视口大小
    await page.setViewport({ width: 1280, height: 720 })
    
    let url: string
    
    // 如果是代码对象，生成临时 HTML 文件
    if (typeof urlOrCode === 'object') {
      const html = generatePreviewHTMLFromCode(urlOrCode)
      const tempDir = path.join(__dirname, '../../temp')
      await mkdir(tempDir, { recursive: true })
      const tempFile = path.join(tempDir, `preview-${Date.now()}.html`)
      await writeFile(tempFile, html, 'utf-8')
      url = `file://${tempFile}`
    } else {
      url = urlOrCode
    }
    
    // 访问页面
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    })
    
    // 智能等待 React 组件渲染完成
    console.log('⏳ 等待 React 编译和渲染...')
    
    // 1. 初始等待：Babel 需要时间编译 JSX（使用 @babel/standalone）
    await new Promise(resolve => setTimeout(resolve, 2000))
    console.log('✅ Babel 编译等待完成')
    
    try {
      // 2. 等待 root 元素出现
      await page.waitForSelector('#root', { timeout: 5000 })
      console.log('✅ 找到 root 元素')
      
      // 3. 等待 React 组件渲染完成（检查 root 是否有实际内容）
      let renderComplete = false
      const maxRetries = 10
      for (let i = 0; i < maxRetries; i++) {
        const rootContent = await page.evaluate(() => {
          // @ts-ignore - document is available in browser context
          const root = document.getElementById('root')
          if (!root) return { hasContent: false, childrenCount: 0, innerHTML: '' }
          return {
            hasContent: root.innerHTML.trim().length > 50, // root 有实际内容（不仅仅是空白）
            childrenCount: root.children.length,
            innerHTML: root.innerHTML.substring(0, 200),
          }
        })
        
        if (rootContent.hasContent && rootContent.childrenCount > 0) {
          console.log(`✅ React 组件已渲染（${rootContent.childrenCount} 个子元素）`)
          renderComplete = true
          break
        }
        
        // 如果还没有内容，等待一下再检查
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      if (!renderComplete) {
        console.warn('⚠️ React 组件可能未完全渲染')
        // 获取当前状态用于调试
        const rootContent = await page.evaluate(() => {
          // @ts-ignore
          const root = document.getElementById('root')
          return root ? root.innerHTML.substring(0, 500) : 'root not found'
        })
        console.log(`📄 Root 内容预览: ${rootContent}...`)
      }
      
      // 4. 尝试等待交互元素出现（button, input, a 等），进一步确认页面已渲染
      try {
        await page.waitForSelector('button, input, a, [class*="button"], [class*="btn"], [role="button"]', { timeout: 5000 })
        console.log('✅ 检测到交互元素，页面渲染完整')
      } catch (e) {
        // 如果没有交互元素，检查 body 是否有足够内容
        const bodyContent = await page.evaluate(() => {
          // @ts-ignore
          return document.body.innerHTML.length
        })
        if (bodyContent > 100) {
          console.log('✅ 页面内容已加载（无交互元素，但有内容）')
        } else {
          console.warn('⚠️ 页面内容可能为空')
        }
      }
      
      // 5. 额外等待确保所有异步操作完成（useEffect、API 调用等）
      await new Promise(resolve => setTimeout(resolve, 1500))
      console.log('✅ 等待异步操作完成')
    } catch (e) {
      console.warn(`⚠️ 等待渲染过程出错: ${e instanceof Error ? e.message : String(e)}`)
      // 即使出错也等待一下再截图
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    // 创建截图目录
    const screenshotsDir = path.join(__dirname, '../../screenshots')
    await mkdir(screenshotsDir, { recursive: true })
    
    // 生成截图文件名
    const timestamp = Date.now()
    const screenshotPath = path.join(screenshotsDir, `preview-${timestamp}.png`)
    
    // 截图前，保存页面内容用于调试
    const pageContent = await page.evaluate(() => {
      // @ts-ignore - document is available in browser context
      const root = document.getElementById('root')
      // @ts-ignore - document is available in browser context
      return {
        rootHTML: root ? root.innerHTML : 'root not found',
        // @ts-ignore - document is available in browser context
        bodyHTML: document.body.innerHTML.substring(0, 2000), // 限制长度
        // @ts-ignore - document is available in browser context
        buttonCount: document.querySelectorAll('button').length,
        // @ts-ignore - document is available in browser context
        inputCount: document.querySelectorAll('input').length,
        // @ts-ignore - document is available in browser context
        allText: document.body.innerText.substring(0, 1000),
      }
    })
    
    // 保存调试信息到文件
    const debugInfoPath = screenshotPath.replace('.png', '-debug.json')
    await writeFile(debugInfoPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      url,
      pageContent,
    }, null, 2), 'utf-8')
    console.log(`📄 调试信息已保存: ${debugInfoPath}`)
    
    // 截图
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    })
    
    console.log(`📸 截图已保存: ${screenshotPath}`)
    console.log(`📊 页面统计: ${pageContent.buttonCount} 个按钮, ${pageContent.inputCount} 个输入框`)
    console.log(`📝 页面文本预览: ${pageContent.allText.substring(0, 200)}...`)
    
    return screenshotPath
  } finally {
    await browser.close()
  }
}

/**
 * 将图片转换为 base64（用于 AI 分析）
 */
async function imageToBase64(imagePath: string): Promise<string> {
  const imageBuffer = fs.readFileSync(imagePath)
  return imageBuffer.toString('base64')
}

/**
 * 使用 AI 分析截图
 */
async function analyzeScreenshot(
  screenshotPath: string,
  userRequirement: string,
  prd?: string,
  architecture?: string
): Promise<{ issues: string[], suggestions: string[], needsImprovement: boolean }> {
  const imageBase64 = await imageToBase64(screenshotPath)
  
  const prompt = `你是一个专业的 UI/UX 和质量检查专家。请分析这个网页预览截图，检查是否符合用户需求。

用户需求: ${userRequirement}
${prd ? `\nPRD:\n${prd}` : ''}
${architecture ? `\n架构设计:\n${architecture}` : ''}

请检查以下方面：
1. **功能完整性**: 是否实现了用户要求的所有功能？
2. **UI/UX 质量**: 界面是否美观、易用？
3. **视觉问题**: 是否有布局错误、样式问题、显示异常？
4. **交互问题**: 是否有按钮无法点击、功能无法使用？
5. **响应式设计**: 在不同屏幕尺寸下是否正常显示？
6. **性能问题**: 是否有明显的加载问题？

请以 JSON 格式返回分析结果：
{
  "passed": true/false,
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"],
  "needsImprovement": true/false
}

如果没有问题，passed 为 true，issues 为空数组。
如果有问题，passed 为 false，列出具体问题。
如果问题较小可以优化，needsImprovement 为 true。
如果问题严重需要修复，needsImprovement 为 true 且 passed 为 false。

只返回 JSON，不要其他解释。`

  try {
    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    })
    
    // Anthropic SDK 返回的是 Message 对象，需要提取文本内容
    const content = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('')
    
    // 尝试解析 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0])
      return {
        issues: result.issues || [],
        suggestions: result.suggestions || [],
        needsImprovement: result.needsImprovement || false,
      }
    }
    
    // 如果解析失败，尝试从文本中提取
    return {
      issues: content.includes('问题') ? [content] : [],
      suggestions: [],
      needsImprovement: true,
    }
  } catch (error) {
    console.error('AI analysis error:', error)
    return {
      issues: ['AI 分析失败，请手动检查'],
      suggestions: [],
      needsImprovement: true,
    }
  }
}

/**
 * 验证预览页面
 */
export async function verifyPreview(options: VerifyOptions): Promise<VerifyResult> {
  const { previewUrl, userRequirement, prd, architecture, code } = options
  
  let screenshotPath: string | undefined
  
  try {
    // 1. 截图
    console.log('📸 Capturing screenshot...')
    console.log(`📋 验证信息: ${previewUrl ? '使用沙盒 URL' : '使用代码预览'}`)
    if (code) {
      console.log(`📁 代码文件: ${Object.keys(code).join(', ')}`)
    }
    // 如果有预览 URL，使用 URL；否则使用代码生成预览
    const screenshotSource = previewUrl || code
    if (!screenshotSource) {
      throw new Error('No preview URL or code provided')
    }
    screenshotPath = await captureScreenshot(screenshotSource)
    console.log('✅ Screenshot captured:', screenshotPath)
    
    // 2. AI 分析
    console.log('🤖 Analyzing screenshot with AI...')
    const analysis = await analyzeScreenshot(screenshotPath, userRequirement, prd, architecture)
    
    const passed = analysis.issues.length === 0
    
    return {
      passed,
      issues: analysis.issues,
      suggestions: analysis.suggestions,
      screenshotPath,
      needsImprovement: analysis.needsImprovement,
    }
  } catch (error) {
    console.error('Verification error:', error)
    return {
      passed: false,
      issues: [`验证失败: ${error instanceof Error ? error.message : 'Unknown error'}`],
      suggestions: ['请手动检查预览页面'],
      needsImprovement: true,
    }
  }
}

/**
 * 生成验证反馈消息
 */
export function generateVerificationFeedback(result: VerifyResult): string {
  if (result.passed) {
    return `✅ **验证通过**\n\n预览页面检查完成，未发现问题。应用已准备就绪！`
  }
  
  let feedback = `⚠️ **验证发现问题**\n\n`
  
  if (result.issues.length > 0) {
    feedback += `**发现的问题：**\n`
    result.issues.forEach((issue, index) => {
      feedback += `${index + 1}. ${issue}\n`
    })
    feedback += `\n`
  }
  
  if (result.suggestions.length > 0) {
    feedback += `**优化建议：**\n`
    result.suggestions.forEach((suggestion, index) => {
      feedback += `${index + 1}. ${suggestion}\n`
    })
    feedback += `\n`
  }
  
  if (result.needsImprovement) {
    feedback += `\n我将自动修复这些问题，请稍候...`
  }
  
  return feedback
}
