/**
 * 测试 Mike 验证预览页面并触发 Alex 修复的功能
 * 
 * 测试流程：
 * 1. 生成一个初始代码（计算器）
 * 2. 验证预览页面
 * 3. 如果发现问题，触发修复流程
 * 4. 检查修复后的代码
 */

import dotenv from 'dotenv'
dotenv.config()

import { createMikeAgent } from '../src/agents/mike'
import { verifyPreview, generatePreviewHTMLFromCode } from '../src/services/verify'
import fs from 'fs'
import path from 'path'

const API_URL = process.env.API_URL || 'http://localhost:3001'

interface TestResult {
  success: boolean
  initialCode?: Record<string, string>
  verifyResult?: any
  fixedCode?: Record<string, string>
  issues?: string[]
  error?: string
}

/**
 * 生成一个简单的计算器代码（故意留一些问题用于测试）
 */
function generateTestCalculatorCode(): Record<string, string> {
  return {
    'App.tsx': `import React, { useState } from 'react';

export default function App() {
  const [display, setDisplay] = useState('0');
  
  const handleNumber = (num: string) => {
    setDisplay(display === '0' ? num : display + num);
  };
  
  const handleClear = () => {
    setDisplay('0');
  };
  
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Calculator</h1>
      <div style={{ 
        border: '1px solid #ccc', 
        padding: '10px', 
        marginBottom: '10px',
        fontSize: '24px',
        textAlign: 'right',
        minHeight: '40px'
      }}>
        {display}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        <button onClick={() => handleNumber('1')}>1</button>
        <button onClick={() => handleNumber('2')}>2</button>
        <button onClick={() => handleNumber('3')}>3</button>
        <button onClick={() => handleNumber('4')}>4</button>
        <button onClick={() => handleNumber('5')}>5</button>
        <button onClick={() => handleNumber('6')}>6</button>
        <button onClick={() => handleNumber('7')}>7</button>
        <button onClick={() => handleNumber('8')}>8</button>
        <button onClick={() => handleNumber('9')}>9</button>
        <button onClick={() => handleNumber('0')}>0</button>
        <button onClick={handleClear}>C</button>
      </div>
    </div>
  );
}`,
    'index.css': `body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

button {
  padding: 15px;
  font-size: 18px;
  border: 1px solid #ccc;
  background: #f0f0f0;
  cursor: pointer;
}

button:hover {
  background: #e0e0e0;
}`,
    'package.json': JSON.stringify({
      name: 'calculator',
      version: '1.0.0',
      dependencies: {
        react: '^18.0.0',
      },
    }, null, 2),
  }
}

/**
 * 测试验证和修复流程
 */
async function testVerifyAndFix(): Promise<TestResult> {
  console.log('🧪 开始测试验证和修复流程...\n')
  
  try {
    // 1. 生成测试代码
    console.log('📝 步骤 1: 生成初始测试代码（故意缺少运算符按钮）...')
    const initialCode = generateTestCalculatorCode()
    console.log(`✅ 生成代码文件: ${Object.keys(initialCode).join(', ')}`)
    console.log(`📊 代码统计: App.tsx ${initialCode['App.tsx'].length} 字符\n`)
    
    // 2. 验证预览页面
    console.log('🔍 步骤 2: 验证预览页面...')
    const verifyResult = await verifyPreview({
      code: initialCode,
      userRequirement: '做一个计算器，包含数字按钮、四则运算符（+、-、×、÷）、等号按钮、清除按钮和小数点按钮',
      prd: '计算器应用，支持基本四则运算',
      architecture: 'React 组件，使用 useState 管理状态',
    })
    
    console.log(`✅ 验证完成`)
    console.log(`📊 验证结果: ${verifyResult.passed ? '通过' : '发现问题'}`)
    console.log(`📋 问题数量: ${verifyResult.issues.length}`)
    if (verifyResult.issues.length > 0) {
      console.log(`⚠️ 发现的问题:`)
      verifyResult.issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`)
      })
    }
    if (verifyResult.screenshotPath) {
      console.log(`📸 截图路径: ${verifyResult.screenshotPath}`)
    }
    console.log()
    
    // 3. 如果发现问题，触发修复流程
    if (!verifyResult.passed && verifyResult.needsImprovement) {
      console.log('🔧 步骤 3: 触发修复流程...')
      
      // 构建修复请求
      const originalReq = '做一个计算器，包含数字按钮、四则运算符（+、-、×、÷）、等号按钮、清除按钮和小数点按钮'
      const issuesText = verifyResult.issues.join('\n')
      const repairMessage = `${originalReq}\n\n⚠️ 修复要求：预览页面验证发现问题，请修复以下问题：\n${issuesText}\n\n请确保生成的代码是完整的、可运行的 React 组件，不要包含错误信息文本。`
      
      console.log(`📝 修复请求:`)
      console.log(`   原始需求: ${originalReq}`)
      console.log(`   问题列表: ${verifyResult.issues.length} 个问题`)
      console.log()
      
      // 执行修复流程（使用流式 API）
      let fixedCode: Record<string, string> | null = null
      let lastCodeArtifact: any = null
      
      console.log('⏳ 等待 Alex 修复代码...')
      
      // 创建 Mike agent 并调用流式工作流
      const mikeAgent = createMikeAgent()
      
      for await (const chunk of mikeAgent.invokeStream({
        userMessage: repairMessage,
        projectId: 'test-verify-fix',
        userId: 'test-user',
        conversationHistory: [],
      })) {
        if (typeof chunk === 'object' && 'type' in chunk) {
          if (chunk.type === 'agent_complete' && chunk.agent === 'alex') {
            // 找到代码 artifact
            if (chunk.artifacts) {
              const codeArtifact = chunk.artifacts.find((a: any) => a.type === 'code')
              if (codeArtifact && codeArtifact.content) {
                if (typeof codeArtifact.content === 'object' && !Array.isArray(codeArtifact.content)) {
                  fixedCode = codeArtifact.content as Record<string, string>
                  lastCodeArtifact = codeArtifact
                  console.log(`   ✅ 获取到修复后的代码: ${Object.keys(fixedCode).join(', ')}`)
                }
              }
            }
          } else if (chunk.type === 'complete') {
            // 最终完成，提取代码
            if (chunk.artifacts) {
              const codeArtifact = chunk.artifacts.find((a: any) => a.type === 'code')
              if (codeArtifact && codeArtifact.content) {
                if (typeof codeArtifact.content === 'object' && !Array.isArray(codeArtifact.content)) {
                  fixedCode = codeArtifact.content as Record<string, string>
                  lastCodeArtifact = codeArtifact
                  console.log(`   ✅ 从完成消息获取代码: ${Object.keys(fixedCode).join(', ')}`)
                }
              }
            }
          }
        } else if (typeof chunk === 'object' && 'code' in chunk) {
          // 如果返回的是 ProjectState，提取代码
          const state = chunk as any
          if (state.code && typeof state.code === 'object' && !Array.isArray(state.code) && Object.keys(state.code).length > 0) {
            fixedCode = state.code as Record<string, string>
            console.log(`   ✅ 从状态获取代码: ${Object.keys(fixedCode).join(', ')}`)
          }
        }
      }
      
      // 如果流式 API 没有返回代码，尝试从状态中获取
      if (!fixedCode && lastCodeArtifact && lastCodeArtifact.content) {
        if (typeof lastCodeArtifact.content === 'object' && !Array.isArray(lastCodeArtifact.content)) {
          fixedCode = lastCodeArtifact.content as Record<string, string>
        }
      }
      
      if (fixedCode && Object.keys(fixedCode).length > 0) {
        console.log(`✅ 修复完成`)
        console.log(`📁 修复后的代码文件: ${Object.keys(fixedCode).join(', ')}`)
        console.log(`📊 代码统计:`)
        Object.entries(fixedCode).forEach(([file, content]) => {
          const contentStr = typeof content === 'string' ? content : String(content)
          console.log(`   ${file}: ${contentStr.length} 字符`)
        })
        console.log()
        
        // 4. 验证修复后的代码
        console.log('🔍 步骤 4: 验证修复后的代码...')
        const verifyResultAfterFix = await verifyPreview({
          code: fixedCode,
          userRequirement: originalReq,
          prd: '计算器应用，支持基本四则运算',
          architecture: 'React 组件，使用 useState 管理状态',
        })
        
        console.log(`✅ 修复后验证完成`)
        console.log(`📊 验证结果: ${verifyResultAfterFix.passed ? '✅ 通过' : '❌ 仍有问题'}`)
        if (verifyResultAfterFix.issues.length > 0) {
          console.log(`⚠️ 剩余问题:`)
          verifyResultAfterFix.issues.forEach((issue, i) => {
            console.log(`   ${i + 1}. ${issue}`)
          })
        }
        if (verifyResultAfterFix.screenshotPath) {
          console.log(`📸 修复后截图路径: ${verifyResultAfterFix.screenshotPath}`)
        }
        console.log()
        
        // 5. 保存代码到文件用于检查
        const outputDir = path.join(__dirname, '../../test-output')
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true })
        }
        
        console.log('💾 步骤 5: 保存代码到文件...')
        Object.entries(fixedCode).forEach(([file, content]) => {
          const filePath = path.join(outputDir, `fixed-${file}`)
          fs.writeFileSync(filePath, content as string, 'utf-8')
          console.log(`   ✅ 已保存: ${filePath}`)
        })
        console.log()
        
        return {
          success: verifyResultAfterFix.passed,
          initialCode,
          verifyResult,
          fixedCode,
          issues: verifyResultAfterFix.issues,
        }
      } else {
        console.error('❌ 修复失败：未获取到修复后的代码')
        return {
          success: false,
          initialCode,
          verifyResult,
          error: '修复后未获取到代码',
        }
      }
    } else {
      console.log('ℹ️ 验证通过，无需修复')
      return {
        success: true,
        initialCode,
        verifyResult,
      }
    }
  } catch (error) {
    console.error('❌ 测试失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('='.repeat(60))
  console.log('🧪 测试：Mike 验证预览页面并触发 Alex 修复')
  console.log('='.repeat(60))
  console.log()
  
  const result = await testVerifyAndFix()
  
  console.log('='.repeat(60))
  console.log('📊 测试结果总结')
  console.log('='.repeat(60))
  console.log(`✅ 测试状态: ${result.success ? '成功' : '失败'}`)
  if (result.error) {
    console.log(`❌ 错误: ${result.error}`)
  }
  if (result.verifyResult) {
    console.log(`🔍 初始验证: ${result.verifyResult.passed ? '通过' : '发现问题'}`)
    console.log(`📋 发现问题数: ${result.verifyResult.issues.length}`)
  }
  if (result.fixedCode) {
    console.log(`🔧 修复完成: 是`)
    console.log(`📁 修复后文件: ${Object.keys(result.fixedCode).join(', ')}`)
  }
  if (result.issues && result.issues.length > 0) {
    console.log(`⚠️ 修复后剩余问题: ${result.issues.length}`)
  }
  console.log('='.repeat(60))
  
  process.exit(result.success ? 0 : 1)
}

// 运行测试
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ 测试执行失败:', error)
    process.exit(1)
  })
}

export { testVerifyAndFix, generateTestCalculatorCode }
