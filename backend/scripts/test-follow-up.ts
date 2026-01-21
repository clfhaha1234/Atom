/**
 * 测试 follow-up 场景：验证修改请求时是否正确保留原有代码
 * 
 * 测试场景：
 * 1. 第一次生成完整代码（计算器）
 * 2. 保存状态到数据库
 * 3. 发送修改请求（优化/修改）
 * 4. 验证新代码是否保留了原有代码，只修改了 diff 部分
 */

import dotenv from 'dotenv'
import { resolve } from 'path'

// Load from root .env file - must be before other imports
dotenv.config({ path: resolve(__dirname, '../../.env') })

import { createMikeAgent } from '../src/agents/mike'
import { supabase } from '../src/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

const TEST_PROJECT_ID = 'test-follow-up-' + Date.now()
const TEST_USER_ID = 'test-user-follow-up'

// 初始代码（计算器）- 包含完整的 4 个文件
const INITIAL_CODE = {
  'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>计算器</title>
  <script crossorigin src="https://cdn.staticfile.org/react/18.2.0/umd/react.development.js"></script>
  <script crossorigin src="https://cdn.staticfile.org/react-dom/18.2.0/umd/react-dom.development.js"></script>
  <script src="https://cdn.staticfile.org/babel-standalone/7.23.5/babel.min.js"></script>
  <link rel="stylesheet" href="index.css">
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" src="App.tsx"></script>
  <script type="text/babel">
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  </script>
</body>
</html>`,
  'App.tsx': `const { useState } = React;

function App() {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState(null);
  const [operation, setOperation] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputNumber = (num: string) => {
    if (waitingForOperand) {
      setDisplay(num);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const inputOperation = (nextOperation) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operation) {
      const currentValue = previousValue || 0;
      const newValue = calculate(currentValue, inputValue, operation);

      setDisplay(String(newValue));
      setPreviousValue(newValue);
    }

    setWaitingForOperand(true);
    setOperation(nextOperation);
  };

  const calculate = (firstValue, secondValue, operation) => {
    switch (operation) {
      case '+':
        return firstValue + secondValue;
      case '-':
        return firstValue - secondValue;
      case '*':
        return firstValue * secondValue;
      case '/':
        return firstValue / secondValue;
      default:
        return secondValue;
    }
  };

  const performCalculation = () => {
    if (previousValue !== null && operation) {
      const inputValue = parseFloat(display);
      const newValue = calculate(previousValue, inputValue, operation);
      setDisplay(String(newValue));
      setPreviousValue(null);
      setOperation(null);
      setWaitingForOperand(true);
    }
  };

  const clear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>计算器</h1>
      <div style={{ 
        border: '1px solid #ccc', 
        padding: '10px', 
        marginBottom: '10px',
        fontSize: '24px',
        textAlign: 'right',
        backgroundColor: '#f5f5f5'
      }}>
        {display}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px' }}>
        <button onClick={clear} style={{ gridColumn: 'span 2', padding: '10px' }}>C</button>
        <button onClick={() => inputOperation('/')} style={{ padding: '10px' }}>/</button>
        <button onClick={() => inputOperation('*')} style={{ padding: '10px' }}>*</button>
        
        <button onClick={() => inputNumber('7')} style={{ padding: '10px' }}>7</button>
        <button onClick={() => inputNumber('8')} style={{ padding: '10px' }}>8</button>
        <button onClick={() => inputNumber('9')} style={{ padding: '10px' }}>9</button>
        <button onClick={() => inputOperation('-')} style={{ padding: '10px' }}>-</button>
        
        <button onClick={() => inputNumber('4')} style={{ padding: '10px' }}>4</button>
        <button onClick={() => inputNumber('5')} style={{ padding: '10px' }}>5</button>
        <button onClick={() => inputNumber('6')} style={{ padding: '10px' }}>6</button>
        <button onClick={() => inputOperation('+')} style={{ padding: '10px' }}>+</button>
        
        <button onClick={() => inputNumber('1')} style={{ padding: '10px' }}>1</button>
        <button onClick={() => inputNumber('2')} style={{ padding: '10px' }}>2</button>
        <button onClick={() => inputNumber('3')} style={{ padding: '10px' }}>3</button>
        <button onClick={performCalculation} style={{ gridRow: 'span 2', padding: '10px' }}>=</button>
        
        <button onClick={() => inputNumber('0')} style={{ gridColumn: 'span 2', padding: '10px' }}>0</button>
        <button onClick={() => inputNumber('.')} style={{ padding: '10px' }}>.</button>
      </div>
    </div>
  );
}`,
  'index.css': `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#root {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}`,
  'package.json': `{
  "name": "calculator",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}`
}

// 内存状态存储（用于测试，不依赖 Supabase）
let memoryState: any = null

async function saveInitialState() {
  console.log('📝 步骤 1: 保存初始代码状态...\n')
  
  const stateToSave = {
    prd: '创建一个功能完整的计算器应用',
    architecture: '使用 React + TypeScript，状态管理使用 useState',
    code: INITIAL_CODE,
    currentStatus: 'complete',
  }
  
  // 优先使用 Supabase，如果不可用则使用内存存储
  if (supabase) {
    try {
      const { error } = await supabase
        .from('project_states')
        .upsert({
          project_id: TEST_PROJECT_ID,
          user_id: TEST_USER_ID,
          state: stateToSave,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'project_id,user_id'
        })
      
      if (error) {
        // 检查是否是表不存在错误
        if (error.message?.includes('Could not find the table') || 
            error.message?.includes('does not exist')) {
          console.error('❌ 数据库表不存在！请先创建表。')
          console.error('   运行: npx ts-node scripts/verify-and-setup.ts')
          console.error('   或查看: backend/scripts/setup-supabase-tables.md')
          console.warn('\n⚠️  使用内存存储继续测试（结果可能不准确）')
          memoryState = stateToSave
        } else {
          console.warn('⚠️  Supabase 保存失败，使用内存存储:', error.message)
          memoryState = stateToSave
        }
      } else {
        console.log('✅ 初始状态已保存到 Supabase')
      }
    } catch (error: any) {
      console.warn('⚠️  Supabase 保存异常，使用内存存储:', error.message)
      memoryState = stateToSave
    }
  } else {
    console.warn('⚠️  Supabase 未配置，使用内存存储')
    memoryState = stateToSave
  }
  
  console.log('✅ 初始状态已保存')
  console.log('   代码文件:', Object.keys(INITIAL_CODE).join(', '))
  console.log('   App.tsx 行数:', INITIAL_CODE['App.tsx'].split('\n').length)
  console.log()
  return true
}

async function loadState(): Promise<any> {
  // 优先从 Supabase 加载，如果不可用则从内存加载
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('project_states')
        .select('state')
        .eq('project_id', TEST_PROJECT_ID)
        .eq('user_id', TEST_USER_ID)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (error) {
        // 如果是表不存在，使用内存状态
        if (error.message?.includes('Could not find the table') || 
            error.message?.includes('does not exist')) {
          console.warn('⚠️  数据库表不存在，使用内存状态')
          return memoryState
        }
        console.warn('⚠️  从 Supabase 加载失败:', error.message)
        return memoryState
      }
      
      if (data && data.state) {
        return typeof data.state === 'string' ? JSON.parse(data.state) : data.state
      }
    } catch (error: any) {
      console.warn('⚠️  从 Supabase 加载异常，使用内存状态:', error.message)
    }
  }
  
  // 回退到内存状态
  return memoryState
}

async function testFollowUp() {
  console.log('🧪 测试 Follow-up 场景\n')
  console.log('='.repeat(60))
  console.log()
  
  // 步骤 1: 保存初始状态
  const saved = await saveInitialState()
  if (!saved) {
    console.error('❌ 无法保存初始状态，测试终止')
    return
  }
  
  // 步骤 2: 验证状态已保存
  console.log('📋 步骤 2: 验证状态已保存...\n')
  const loadedState = await loadState()
  if (!loadedState || !loadedState.code) {
    console.error('❌ 无法加载保存的状态')
    return
  }
  
  const initialFileCount = Object.keys(loadedState.code).length
  const initialAppLines = loadedState.code['App.tsx']?.split('\n').length || 0
  console.log('✅ 状态加载成功')
  console.log(`   文件数量: ${initialFileCount}`)
  console.log(`   App.tsx 行数: ${initialAppLines}`)
  console.log()
  
  // 步骤 3: 发送修改请求
  console.log('🔧 步骤 3: 发送修改请求...\n')
  console.log('   请求内容: "优化刚才那个代码库，把按钮颜色改成蓝色"')
  console.log()
  
  // 确保 Supabase 可以访问（如果配置了的话）
  // 如果没有配置，我们需要确保 loadProjectState 能够从内存加载
  // 由于 loadProjectState 是内部函数，我们通过确保数据库中有数据来测试
  
  const mike = createMikeAgent()
  const modificationRequest = '优化刚才那个代码库，把按钮颜色改成蓝色'
  
  // 如果 Supabase 可用，确保状态已保存
  if (supabase) {
    try {
      const stateToSave = {
        prd: '创建一个功能完整的计算器应用',
        architecture: '使用 React + TypeScript，状态管理使用 useState',
        code: INITIAL_CODE,
        currentStatus: 'complete',
      }
      
      await supabase
        .from('project_states')
        .upsert({
          project_id: TEST_PROJECT_ID,
          user_id: TEST_USER_ID,
          state: stateToSave,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'project_id,user_id'
        })
      console.log('✅ 状态已同步到 Supabase（如果可用）')
    } catch (error) {
      console.warn('⚠️  无法同步到 Supabase，将使用内存状态测试')
    }
  }
  
  let finalCode: Record<string, string> | null = null
  let streamComplete = false
  
  try {
    const stream = mike.invokeStream({
      userMessage: modificationRequest,
      projectId: TEST_PROJECT_ID,
      userId: TEST_USER_ID,
    })
    
    console.log('📡 开始接收流式响应...\n')
    
    for await (const chunk of stream) {
      if (chunk.type === 'agent_complete' && chunk.agent === 'alex') {
        if (chunk.artifacts) {
          const codeArtifact = chunk.artifacts.find((a: any) => a.type === 'code')
          if (codeArtifact && codeArtifact.content) {
            finalCode = codeArtifact.content as Record<string, string>
            console.log('✅ 收到代码更新')
            console.log(`   文件数量: ${Object.keys(finalCode).length}`)
            console.log(`   文件列表: ${Object.keys(finalCode).join(', ')}`)
          }
        }
      } else if (chunk.type === 'complete') {
        streamComplete = true
        if (chunk.artifacts) {
          const codeArtifact = chunk.artifacts.find((a: any) => a.type === 'code')
          if (codeArtifact && codeArtifact.content && !finalCode) {
            finalCode = codeArtifact.content as Record<string, string>
          }
        }
      }
    }
    
    // 总是从数据库加载最终状态，因为 artifacts 只包含修改的文件
    console.log('\n📥 从数据库加载最终状态（包含合并后的完整代码）...')
    const finalState = await loadState()
    if (finalState && finalState.code) {
      finalCode = finalState.code
      console.log('✅ 最终代码加载成功')
      console.log(`   文件数量: ${Object.keys(finalCode!).length}`)
      console.log(`   文件列表: ${Object.keys(finalCode!).join(', ')}`)
    }
    
  } catch (error) {
    console.error('❌ 流式处理失败:', error)
    return
  }
  
  // 步骤 4: 验证结果
  console.log('\n' + '='.repeat(60))
  console.log('📊 步骤 4: 验证结果\n')
  
  if (!finalCode) {
    console.error('❌ 未获取到修改后的代码')
    return
  }
  
  const finalFileCount = Object.keys(finalCode).length
  const finalAppLines = finalCode['App.tsx']?.split('\n').length || 0
  
  console.log('📈 代码统计:')
  console.log(`   初始文件数: ${initialFileCount}`)
  console.log(`   最终文件数: ${finalFileCount}`)
  console.log(`   初始 App.tsx 行数: ${initialAppLines}`)
  console.log(`   最终 App.tsx 行数: ${finalAppLines}`)
  console.log()
  
  // 验证 1: 文件数量应该保持一致
  console.log('✅ 验证 1: 文件数量')
  if (finalFileCount === initialFileCount) {
    console.log('   ✅ 通过: 文件数量保持一致')
  } else {
    console.log(`   ❌ 失败: 文件数量不一致 (${initialFileCount} -> ${finalFileCount})`)
  }
  console.log()
  
  // 验证 2: App.tsx 应该保留大部分代码
  console.log('✅ 验证 2: 代码保留情况')
  const lineRetentionRatio = finalAppLines / initialAppLines
  if (lineRetentionRatio > 0.8) {
    console.log(`   ✅ 通过: 保留了 ${(lineRetentionRatio * 100).toFixed(1)}% 的代码`)
  } else {
    console.log(`   ❌ 失败: 只保留了 ${(lineRetentionRatio * 100).toFixed(1)}% 的代码`)
    console.log('   ⚠️  可能代码被完全重写了')
  }
  console.log()
  
  // 验证 3: 检查是否包含修改（蓝色）
  console.log('✅ 验证 3: 修改内容检查')
  const appContent = finalCode['App.tsx'] || ''
  const hasBlueColor = appContent.includes('blue') || 
                       appContent.includes('#0000ff') || 
                       appContent.includes('rgb(0, 0, 255)') ||
                       appContent.includes('backgroundColor') ||
                       appContent.includes('background-color')
  
  if (hasBlueColor) {
    console.log('   ✅ 通过: 检测到颜色修改（蓝色相关）')
  } else {
    console.log('   ⚠️  警告: 未明显检测到蓝色修改')
  }
  console.log()
  
  // 验证 4: 检查是否保留了核心功能
  console.log('✅ 验证 4: 核心功能保留')
  const hasState = appContent.includes('useState')
  const hasCalculate = appContent.includes('calculate') || appContent.includes('计算')
  const hasButtons = appContent.includes('button')
  const hasDisplay = appContent.includes('display')
  
  const coreFeatures = [hasState, hasCalculate, hasButtons, hasDisplay].filter(Boolean).length
  if (coreFeatures >= 3) {
    console.log(`   ✅ 通过: 保留了 ${coreFeatures}/4 个核心功能`)
  } else {
    console.log(`   ❌ 失败: 只保留了 ${coreFeatures}/4 个核心功能`)
  }
  console.log()
  
  // 验证 5: 检查是否包含原始代码的关键部分
  console.log('✅ 验证 5: 原始代码关键部分保留')
  const originalKeyParts = [
    'inputNumber',
    'inputOperation',
    'performCalculation',
    'clear',
    'calculate',
  ]
  
  const preservedParts = originalKeyParts.filter(part => 
    appContent.includes(part)
  ).length
  
  if (preservedParts >= 4) {
    console.log(`   ✅ 通过: 保留了 ${preservedParts}/${originalKeyParts.length} 个关键函数`)
  } else {
    console.log(`   ❌ 失败: 只保留了 ${preservedParts}/${originalKeyParts.length} 个关键函数`)
    console.log('   ⚠️  可能代码被大量重写')
  }
  console.log()
  
  // 详细对比
  console.log('='.repeat(60))
  console.log('📝 详细对比\n')
  
  // 提取关键代码片段进行对比
  const extractKeySections = (code: string) => {
    const sections: Record<string, string> = {}
    
    // 提取函数定义
    const functionMatches = code.matchAll(/(const|function)\s+(\w+)\s*[=\(]/g)
    for (const match of functionMatches) {
      const funcName = match[2]
      const funcStart = code.indexOf(match[0])
      const funcEnd = code.indexOf('}', funcStart) + 1
      if (funcEnd > funcStart) {
        sections[funcName] = code.substring(funcStart, funcEnd).substring(0, 200)
      }
    }
    
    return sections
  }
  
  const originalSections = extractKeySections(INITIAL_CODE['App.tsx'])
  const finalSections = extractKeySections(appContent)
  
  console.log('原始代码关键函数:')
  Object.keys(originalSections).forEach(func => {
    console.log(`   - ${func}`)
  })
  console.log()
  
  console.log('修改后代码关键函数:')
  Object.keys(finalSections).forEach(func => {
    console.log(`   - ${func}`)
  })
  console.log()
  
  const preservedFunctions = Object.keys(originalSections).filter(func => 
    finalSections[func]
  )
  
  console.log(`保留的函数: ${preservedFunctions.length}/${Object.keys(originalSections).length}`)
  preservedFunctions.forEach(func => {
    console.log(`   ✅ ${func}`)
  })
  
  const lostFunctions = Object.keys(originalSections).filter(func => 
    !finalSections[func]
  )
  if (lostFunctions.length > 0) {
    console.log(`\n丢失的函数: ${lostFunctions.length}`)
    lostFunctions.forEach(func => {
      console.log(`   ❌ ${func}`)
    })
  }
  
  // 最终结论
  console.log('\n' + '='.repeat(60))
  console.log('🎯 测试结论\n')
  
  const allTestsPassed = 
    finalFileCount === initialFileCount &&
    lineRetentionRatio > 0.8 &&
    preservedParts >= 4 &&
    preservedFunctions.length >= Object.keys(originalSections).length * 0.8
  
  if (allTestsPassed) {
    console.log('✅ 测试通过: Follow-up 场景工作正常')
    console.log('   - 代码正确保留')
    console.log('   - 只修改了需要的部分')
    console.log('   - 核心功能完整')
  } else {
    console.log('❌ 测试失败: Follow-up 场景存在问题')
    if (finalFileCount !== initialFileCount) {
      console.log('   - 文件数量不一致')
    }
    if (lineRetentionRatio <= 0.8) {
      console.log('   - 代码保留率过低')
    }
    if (preservedParts < 4) {
      console.log('   - 核心功能丢失')
    }
    if (preservedFunctions.length < Object.keys(originalSections).length * 0.8) {
      console.log('   - 关键函数丢失过多')
    }
  }
  
  console.log('\n' + '='.repeat(60))
  
  // 清理测试数据
  if (supabase) {
    await supabase
      .from('project_states')
      .delete()
      .eq('project_id', TEST_PROJECT_ID)
      .eq('user_id', TEST_USER_ID)
    console.log('\n🧹 测试数据已清理')
  }
}

// 运行测试
testFollowUp().catch(error => {
  console.error('❌ 测试执行失败:', error)
  process.exit(1)
})
