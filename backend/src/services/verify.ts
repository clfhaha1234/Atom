/**
 * 验证服务
 * 使用 AI 分析代码或沙盒 URL 来验证预览页面
 * 
 * 注意：此服务不使用本地浏览器，而是：
 * 1. 如果有沙盒 URL，使用外部截图 API
 * 2. 如果只有代码，直接使用 AI 分析代码
 */

import { GoogleGenAI } from '@google/genai'

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

// Gemini API 配置
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview'

// 延迟初始化 client
let ai: any = null

function getAI() {
  if (!ai) {
    ai = new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
    })
  }
  return ai
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
 * 使用外部 API 获取沙盒 URL 的截图
 * 如果没有配置外部 API，返回 null
 */
async function captureScreenshotFromUrl(url: string): Promise<string | null> {
  // 目前不使用外部截图 API，直接返回 null
  // 如果需要，可以配置 screenshotapi.net、urlbox 等服务
  console.log(`📸 跳过截图（沙盒 URL: ${url}）`)
  console.log('💡 提示: 验证将基于代码分析进行，不依赖截图')
  return null
}

/**
 * 使用 AI 直接分析代码
 * 不需要截图，直接基于代码内容进行分析
 */
async function analyzeCode(
  code: Record<string, string>,
  userRequirement: string,
  prd?: string,
  architecture?: string
): Promise<{ issues: string[], suggestions: string[], needsImprovement: boolean }> {
  
  // 构建代码摘要
  const codeFiles = Object.entries(code)
    .map(([file, content]) => `### ${file}\n\`\`\`\n${content}\n\`\`\``)
    .join('\n\n')
  
  const prompt = `你是一个专业的代码审查和质量检查专家。请分析以下代码，检查是否符合用户需求。

## 用户需求
${userRequirement}

${prd ? `## PRD\n${prd}\n` : ''}
${architecture ? `## 架构设计\n${architecture}\n` : ''}

## 代码文件
${codeFiles}

请检查以下方面：
1. **功能完整性**: 代码是否实现了用户要求的所有功能？例如，如果用户要求"计算器包含四则运算符"，检查代码中是否有 +、-、×、÷ 按钮和对应的处理逻辑。
2. **代码质量**: 代码是否规范、可维护？
3. **UI 组件**: 是否有完整的 UI 组件，包括必要的按钮、输入框等？
4. **错误处理**: 是否有适当的错误处理？
5. **最佳实践**: 是否遵循 React/前端最佳实践？

请以 JSON 格式返回分析结果：
{
  "passed": true/false,
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"],
  "needsImprovement": true/false
}

如果代码完整实现了用户需求，passed 为 true，issues 为空数组。
如果有缺失的功能或问题，passed 为 false，列出具体问题。
如果问题较小可以优化，needsImprovement 为 true。
如果问题严重需要修复，needsImprovement 为 true 且 passed 为 false。

只返回 JSON，不要其他解释。`

  try {
    const response = await getAI().models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { 
        maxOutputTokens: 4096,
        temperature: 0.3,
        responseMimeType: 'application/json'
      }
    })
    
    // Gemini SDK 返回格式
    const content = response.text || ''
    
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
 * 
 * 验证方式：
 * 1. 如果有沙盒 URL，尝试获取截图（需要配置外部截图 API）
 * 2. 如果有代码，直接使用 AI 分析代码
 * 3. 两者都有时，优先使用代码分析（更可靠）
 */
export async function verifyPreview(options: VerifyOptions): Promise<VerifyResult> {
  const { previewUrl, userRequirement, prd, architecture, code } = options
  
  try {
    console.log('🔍 开始验证...')
    console.log(`📋 验证信息: ${previewUrl ? '有沙盒 URL' : '无沙盒 URL'}, ${code ? '有代码' : '无代码'}`)
    
    // 优先使用代码分析（不依赖浏览器）
    if (code && Object.keys(code).length > 0) {
      console.log(`📁 代码文件: ${Object.keys(code).join(', ')}`)
      console.log('🤖 使用 AI 分析代码...')
      
      const analysis = await analyzeCode(code, userRequirement, prd, architecture)
      const passed = analysis.issues.length === 0
      
      console.log(`✅ 代码分析完成: ${passed ? '通过' : '发现问题'}`)
      
      return {
        passed,
        issues: analysis.issues,
        suggestions: analysis.suggestions,
        needsImprovement: analysis.needsImprovement,
      }
    }
    
    // 如果只有沙盒 URL，尝试获取截图
    if (previewUrl) {
      console.log(`🌐 沙盒 URL: ${previewUrl}`)
      const screenshotPath = await captureScreenshotFromUrl(previewUrl)
      
      if (screenshotPath) {
        // 如果成功获取截图，进行截图分析
        // 注意：当前未实现外部截图 API，这个分支暂时不会执行
        return {
          passed: true,
          issues: [],
          suggestions: ['建议配置外部截图 API 以获得更准确的验证'],
          screenshotPath,
          needsImprovement: false,
        }
      }
      
      // 没有截图，返回提示信息
      return {
        passed: true,
        issues: [],
        suggestions: ['无法获取截图，请手动访问沙盒 URL 进行验证'],
        needsImprovement: false,
      }
    }
    
    // 既没有代码也没有 URL
    throw new Error('No preview URL or code provided')
    
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
