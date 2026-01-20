/**
 * 高级测试用例
 * 测试边界情况和特殊场景
 */

import { TestMikeAgent } from './mike.test'

async function runAdvancedTests() {
  const agent = new TestMikeAgent()
  
  console.log('\n' + '='.repeat(60))
  console.log('🧪 高级测试用例')
  console.log('='.repeat(60))
  
  // 测试 1: 简单需求（可能只需要代码）
  console.log('\n📝 测试 1: 简单需求')
  console.log('-'.repeat(60))
  await agent.testFullWorkflow('做一个简单的 Hello World 页面')
  
  // 测试 2: 复杂需求
  console.log('\n\n📝 测试 2: 复杂需求')
  console.log('-'.repeat(60))
  await agent.testFullWorkflow('做一个全栈电商平台，包含用户注册、商品展示、购物车、订单管理、支付集成等功能')
  
  // 测试 3: 验证状态传递
  console.log('\n\n📝 测试 3: 验证状态传递机制')
  console.log('-'.repeat(60))
  console.log('验证 Bob 是否能看到 Emma 的 PRD...')
  const result = await agent.testFullWorkflow('做一个博客系统')
  
  if (result.state.prd && result.state.architecture) {
    // 检查 Bob 的架构是否引用了 PRD 的内容
    const archRefersPRD = result.state.architecture.includes('产品') || 
                         result.state.architecture.includes('需求') ||
                         result.state.architecture.includes('功能')
    console.log(`\n✅ 状态传递验证: ${archRefersPRD ? '通过' : '失败'}`)
    console.log(`   Bob 的架构是否引用了 PRD: ${archRefersPRD ? '✅' : '❌'}`)
  }
  
  // 测试 4: 验证完成判断
  console.log('\n\n📝 测试 4: 验证完成判断逻辑')
  console.log('-'.repeat(60))
  const completionTest = await agent.testFullWorkflow('做一个计算器')
  const isComplete = completionTest.state.prd && 
                     completionTest.state.architecture && 
                     completionTest.state.code &&
                     completionTest.state.currentStatus === 'complete'
  console.log(`\n✅ 完成判断验证: ${isComplete ? '通过' : '失败'}`)
  console.log(`   所有必需字段都存在: ${isComplete ? '✅' : '❌'}`)
  console.log(`   状态为 complete: ${completionTest.state.currentStatus === 'complete' ? '✅' : '❌'}`)
  
  console.log('\n' + '='.repeat(60))
  console.log('✅ 高级测试完成')
  console.log('='.repeat(60))
}

// 运行测试
runAdvancedTests().catch(console.error)
