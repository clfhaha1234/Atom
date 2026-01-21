/**
 * 运行所有测试脚本
 * 
 * 使用方法:
 * cd backend
 * npx ts-node scripts/run-all-tests.ts
 * 
 * 或者:
 * npm run test:all
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

interface TestResult {
  name: string
  success: boolean
  duration: number
  error?: string
  output?: string
}

const tests = [
  {
    name: 'Follow-up 场景测试',
    script: 'test-follow-up.ts',
    description: '测试修改请求时是否正确保留原有代码',
  },
  {
    name: '验证和修复流程测试',
    script: 'test-verify-and-fix.ts',
    description: '测试 Mike 验证预览页面并触发 Alex 修复',
  },
  {
    name: '沙盒截图功能测试',
    script: 'test-sandbox-screenshot.ts',
    description: '测试沙盒生成网页 preview 然后截图功能',
  },
  {
    name: '端到端计算器生成测试',
    script: 'test-calculator.ts',
    description: '完整的端到端测试，从用户请求到生成可用的计算器应用',
    requiresApi: true, // 需要后端 API 运行
  },
]

async function runTest(test: typeof tests[0]): Promise<TestResult> {
  const startTime = Date.now()
  const scriptPath = path.join(__dirname, test.script)
  
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🧪 ${test.name}`)
  console.log(`📝 ${test.description}`)
  console.log(`${'='.repeat(60)}\n`)
  
  try {
    const { stdout, stderr } = await execAsync(
      `npx ts-node "${scriptPath}"`,
      {
        cwd: path.join(__dirname, '..'),
        maxBuffer: 10 * 1024 * 1024, // 10MB
      }
    )
    
    const duration = Date.now() - startTime
    const output = stdout + (stderr ? `\n${stderr}` : '')
    
    // 检查输出中是否有错误标志
    const hasError = output.includes('❌') || 
                    output.includes('测试失败') || 
                    output.includes('Error:') ||
                    output.includes('失败')
    
    // 检查退出码（通过输出判断）
    const success = !hasError && !output.includes('process.exit(1)')
    
    return {
      name: test.name,
      success,
      duration,
      output: output.substring(0, 500), // 只保存前500字符
    }
  } catch (error: any) {
    const duration = Date.now() - startTime
    return {
      name: test.name,
      success: false,
      duration,
      error: error.message,
      output: error.stdout || error.stderr || '',
    }
  }
}

async function main() {
  console.log('🚀 开始运行所有测试\n')
  console.log(`📋 共 ${tests.length} 个测试\n`)
  
  const results: TestResult[] = []
  
  for (const test of tests) {
    if (test.requiresApi) {
      console.log(`⚠️  注意: ${test.name} 需要后端 API 运行`)
      console.log(`   如果 API 未运行，此测试可能会失败\n`)
    }
    
    const result = await runTest(test)
    results.push(result)
    
    // 显示简要结果
    if (result.success) {
      console.log(`\n✅ ${test.name} 通过 (${(result.duration / 1000).toFixed(2)}s)`)
    } else {
      console.log(`\n❌ ${test.name} 失败 (${(result.duration / 1000).toFixed(2)}s)`)
      if (result.error) {
        console.log(`   错误: ${result.error}`)
      }
    }
    
    // 测试之间稍作延迟
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  // 显示总结
  console.log('\n' + '='.repeat(60))
  console.log('📊 测试结果总结')
  console.log('='.repeat(60))
  
  const passed = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)
  
  console.log(`\n✅ 通过: ${passed}/${results.length}`)
  console.log(`❌ 失败: ${failed}/${results.length}`)
  console.log(`⏱️  总耗时: ${(totalDuration / 1000).toFixed(2)}s\n`)
  
  console.log('详细结果:')
  results.forEach((result, index) => {
    const icon = result.success ? '✅' : '❌'
    const duration = (result.duration / 1000).toFixed(2)
    console.log(`  ${index + 1}. ${icon} ${result.name} (${duration}s)`)
    if (!result.success && result.error) {
      console.log(`     错误: ${result.error.substring(0, 100)}...`)
    }
  })
  
  console.log('\n' + '='.repeat(60))
  
  if (failed === 0) {
    console.log('\n🎉 所有测试通过！')
    process.exit(0)
  } else {
    console.log(`\n⚠️  ${failed} 个测试失败，请检查上面的错误信息`)
    process.exit(1)
  }
}

main().catch(error => {
  console.error('❌ 运行测试失败:', error)
  process.exit(1)
})
