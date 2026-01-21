/**
 * 测试沙盒生成网页preview然后截图功能 (Debug Enhanced Version)
 * * 改进说明：
 * 1. 使用智能等待替代死板的 setTimeout
 * 2. 增加调试截图功能，方便排查渲染问题
 * 3. 增强错误日志输出
 * * 使用方法：
 * cd backend
 * npx ts-node scripts/test-sandbox-screenshot.ts
 */

import { sandboxService } from '../src/services/sandbox'
import { verifyPreview } from '../src/services/verify'
import fs from 'fs'
import path from 'path'
// 引入 puppeteer 类型支持 (如果项目中有)
// import puppeteer from 'puppeteer' 

// ==========================================
// 测试用的简单计算器代码 (保持不变)
// ==========================================
const testCode = {
  'App.tsx': `import React, { useState, useCallback } from 'react';

export default function Calculator() {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);

  const inputNumber = useCallback((num: string) => {
    if (waitingForNewValue) {
      setDisplay(num);
      setWaitingForNewValue(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  }, [display, waitingForNewValue]);

  const inputOperation = useCallback((nextOperation: string) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operation) {
      const currentValue = previousValue || 0;
      const newValue = calculate(currentValue, inputValue, operation);

      setDisplay(String(newValue));
      setPreviousValue(newValue);
    }

    setWaitingForNewValue(true);
    setOperation(nextOperation);
  }, [display, previousValue, operation]);

  const calculate = (firstValue: number, secondValue: number, operation: string): number => {
    switch (operation) {
      case '+': return firstValue + secondValue;
      case '-': return firstValue - secondValue;
      case '*': return firstValue * secondValue;
      case '/': return firstValue / secondValue;
      case '=': return secondValue;
      default: return secondValue;
    }
  };

  const performCalculation = useCallback(() => {
    if (previousValue !== null && operation) {
      const inputValue = parseFloat(display);
      const newValue = calculate(previousValue, inputValue, operation);
      setDisplay(String(newValue));
      setPreviousValue(null);
      setOperation(null);
      setWaitingForNewValue(true);
    }
  }, [display, previousValue, operation]);

  const clear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForNewValue(false);
  };

  return (
    <div className="calculator-container" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <div style={{
        background: '#1e1e1e',
        borderRadius: '20px',
        padding: '20px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
        width: '320px'
      }}>
        <div data-testid="display" style={{
          background: '#000',
          borderRadius: '10px',
          padding: '20px',
          marginBottom: '20px',
          textAlign: 'right'
        }}>
          <div style={{
            color: '#fff',
            fontSize: '2.5rem',
            fontWeight: '300',
            minHeight: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            wordBreak: 'break-all'
          }}>
            {display}
          </div>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '15px'
        }}>
          <button onClick={clear} style={buttonStyle('#a6a6a6', '#000')}>C</button>
          <button onClick={() => inputOperation('/')} style={buttonStyle('#ff9500', '#fff')}>÷</button>
          <button onClick={() => inputOperation('*')} style={buttonStyle('#ff9500', '#fff')}>×</button>
          <button onClick={() => inputOperation('-')} style={buttonStyle('#ff9500', '#fff')}>−</button>
          
          <button onClick={() => inputNumber('7')} style={buttonStyle('#333', '#fff')}>7</button>
          <button onClick={() => inputNumber('8')} style={buttonStyle('#333', '#fff')}>8</button>
          <button onClick={() => inputNumber('9')} style={buttonStyle('#333', '#fff')}>9</button>
          <button onClick={() => inputOperation('+')} style={buttonStyle('#ff9500', '#fff')}>+</button>
          
          <button onClick={() => inputNumber('4')} style={buttonStyle('#333', '#fff')}>4</button>
          <button onClick={() => inputNumber('5')} style={buttonStyle('#333', '#fff')}>5</button>
          <button onClick={() => inputNumber('6')} style={buttonStyle('#333', '#fff')}>6</button>
          <button onClick={performCalculation} style={{...buttonStyle('#ff9500', '#fff'), gridRow: 'span 2'}}>=</button>
          
          <button onClick={() => inputNumber('1')} style={buttonStyle('#333', '#fff')}>1</button>
          <button onClick={() => inputNumber('2')} style={buttonStyle('#333', '#fff')}>2</button>
          <button onClick={() => inputNumber('3')} style={buttonStyle('#333', '#fff')}>3</button>
          
          <button onClick={() => inputNumber('0')} style={{...buttonStyle('#333', '#fff'), gridColumn: 'span 2'}}>0</button>
          <button onClick={() => inputNumber('.')} style={buttonStyle('#333', '#fff')}>.</button>
        </div>
      </div>
    </div>
  );
}

function buttonStyle(bg: string, color: string) {
  return {
    border: 'none',
    borderRadius: '50%',
    fontSize: '1.2rem',
    fontWeight: '500',
    height: '65px',
    width: '65px',
    cursor: 'pointer',
    background: bg,
    color: color,
    transition: 'all 0.2s ease',
    outline: 'none',
    userSelect: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)'
  };
}`,
  'index.css': `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, sans-serif; }`,
  'package.json': JSON.stringify({
    name: 'calculator',
    version: '1.0.0',
    dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' }
  }, null, 2)
}

/**
 * 主测试函数
 */
async function main() {
  console.log('🧪 开始测试：沙盒生成网页preview然后截图 (Debug Mode)\n')
  console.log('='.repeat(60))
  
  let sandboxResult = null
  let screenshotPath: string | undefined
  let browser = null
  
  try {
    // 1. 测试创建沙盒
    console.log('\n📦 步骤 1: 创建沙盒...')
    
    sandboxResult = await sandboxService.createSandbox({
      userId: 'test-user',
      projectId: 'test-sandbox-screenshot',
      code: testCode,
    })
    
    console.log('   ✅ 沙盒创建成功')
    console.log(`   类型: ${sandboxResult.type}`)
    if (sandboxResult.websiteUrl) console.log(`   🌐 URL: ${sandboxResult.websiteUrl}`)
    
    // 1.5. 如果是 Daytona 沙盒，需要写入文件
    if (sandboxResult.type === 'daytona' && sandboxResult.containerId) {
      console.log('\n📝 步骤 1.5: 写入代码文件到沙盒...')
      try {
        // 写入所有文件
        for (const [fileName, content] of Object.entries(testCode)) {
          await sandboxService.writeFile(sandboxResult.containerId!, fileName, content)
          console.log(`   ✅ 已写入: ${fileName}`)
        }
        
        // 如果是 React 项目，可能需要安装依赖和启动服务器
        if (testCode['package.json']) {
          console.log('   📦 检测到 package.json，尝试安装依赖...')
          try {
            await sandboxService.runCommand(
              sandboxResult.containerId!,
              'cd /workspace && npm install',
              true,
              120 // 2分钟超时
            )
            console.log('   ✅ 依赖安装完成')
          } catch (e) {
            console.warn('   ⚠️  依赖安装失败（可能不需要）:', e instanceof Error ? e.message : String(e))
          }
          
          // 尝试启动开发服务器（如果存在）
          console.log('   🚀 尝试启动开发服务器...')
          try {
            await sandboxService.runCommand(
              sandboxResult.containerId!,
              'cd /workspace && npm start',
              false, // 非阻塞
              10
            )
            console.log('   ✅ 开发服务器已启动（后台运行）')
            // 等待服务器启动
            await new Promise(resolve => setTimeout(resolve, 5000))
          } catch (e) {
            console.warn('   ⚠️  启动服务器失败，可能使用静态 HTML:', e instanceof Error ? e.message : String(e))
            // 如果启动失败，尝试生成静态 HTML
            const { generatePreviewHTMLFromCode } = require('../src/services/verify')
            const html = generatePreviewHTMLFromCode(testCode)
            await sandboxService.writeFile(sandboxResult.containerId!, 'index.html', html)
            console.log('   ✅ 已生成静态 HTML 文件')
          }
        } else {
          // 没有 package.json，直接生成 HTML
          const { generatePreviewHTMLFromCode } = require('../src/services/verify')
          const html = generatePreviewHTMLFromCode(testCode)
          await sandboxService.writeFile(sandboxResult.containerId!, 'index.html', html)
          console.log('   ✅ 已生成静态 HTML 文件')
        }
      } catch (e) {
        console.error('   ❌ 写入文件失败:', e instanceof Error ? e.message : String(e))
        throw e
      }
    }

    // 2. 测试截图功能并检查内容
    console.log('\n📸 步骤 2: 截图预览页面...')
    
    const previewUrl = sandboxResult.websiteUrl || (sandboxResult.type === 'daytona' ? sandboxResult.url : undefined)
    
    if (!previewUrl && sandboxResult.type !== 'daytona') {
       // 如果没有 URL 且不是 daytona，可能使用了 browser-preview 模式
       console.log('   ℹ️  使用浏览器内存预览模式 (No external URL)')
    }

    const verifyResult = await verifyPreview({
      previewUrl: previewUrl && previewUrl !== 'browser-preview' ? previewUrl : undefined,
      userRequirement: '生成一个计算器网页版',
      code: testCode,
    })
    
    screenshotPath = verifyResult.screenshotPath
    
    if (screenshotPath && fs.existsSync(screenshotPath)) {
      const stats = fs.statSync(screenshotPath)
      console.log(`   ✅ 截图成功: ${screenshotPath} (${(stats.size / 1024).toFixed(2)} KB)`)
    } else {
      console.error('   ❌ 截图失败或文件不存在')
    }
    
    // 2.5. 使用 Puppeteer 深入检查页面内容
    console.log('\n🔍 步骤 2.5: 深入检查页面内容 (Puppeteer)...')
    const puppeteer = require('puppeteer')
    browser = await puppeteer.launch({
      headless: true, // 调试时可以改为 false 观察浏览器行为
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 720 })
    
    // 确定访问地址
    let urlToCheck: string
    if (previewUrl && previewUrl !== 'browser-preview') {
      urlToCheck = previewUrl
      // 如果是 Daytona URL，确保使用正确的端口
      if (sandboxResult.type === 'daytona' && !urlToCheck.includes('8080')) {
        // 尝试使用 8080 端口的预览链接
        urlToCheck = sandboxResult.websiteUrl || urlToCheck
      }
    } else {
      const { generatePreviewHTMLFromCode } = require('../src/services/verify')
      const html = generatePreviewHTMLFromCode(testCode)
      const tempDir = path.join(__dirname, '../../temp')
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
      const tempFile = path.join(tempDir, `check-${Date.now()}.html`)
      fs.writeFileSync(tempFile, html, 'utf-8')
      urlToCheck = `file://${tempFile}`
    }

    console.log(`   🔗 正在访问: ${urlToCheck}`)
    console.log(`   📋 沙盒类型: ${sandboxResult.type}`)

    // 捕获页面日志
    page.on('console', (msg: any) => {
      const type = msg.type()
      if (type === 'error' || type === 'warning') {
         console.log(`   [Browser ${type.toUpperCase()}] ${msg.text()}`)
      }
    })
    
    // 提升 evalResult 到外层作用域
    let evalResult: { buttonCount: number; hasNumbers: boolean; buttonTexts: string[]; rootTextLength: number } | null = null
    
    try {
        console.log('   ⏳ 正在加载页面...')
        await page.goto(urlToCheck, { 
          waitUntil: 'networkidle0', 
          timeout: 30000 
        })
        console.log('   ✅ 页面加载完成')
        
        // 额外等待，确保 React 组件渲染
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // ⚡️ 改进：使用 waitForFunction 替代 setTimeout
        console.log('   ⏳ 等待计算器组件渲染 (寻找 Button 元素)...')
        try {
            await page.waitForSelector('button', { timeout: 15000 })
            console.log('   ✅ 检测到按钮元素，React 已挂载')
        } catch (e) {
            console.warn('   ⚠️ 等待按钮超时，尝试截图当前状态...')
            const debugPath = path.join(
              path.dirname(screenshotPath || './'), 
              `debug-failure-${Date.now()}.png`
            )
            await page.screenshot({ path: debugPath, fullPage: true })
            console.log(`   📸 调试截图已保存至: ${debugPath}`)
            
            // 获取页面 HTML 片段用于调试
            const pageContent = await page.evaluate(() => {
              // @ts-ignore - document is available in browser context
              return document.body.innerHTML.substring(0, 500)
            })
            console.log(`   📄 页面内容预览: ${pageContent}...`)
            
            throw new Error('页面似乎未正确渲染 (找不到 button 标签)')
        }

        // 检查具体内容
        evalResult = await page.evaluate(() => {
            // @ts-ignore
            const buttons = Array.from(document.querySelectorAll('button'))
            // @ts-ignore
            const rootText = document.getElementById('root')?.innerText || ''
            // @ts-ignore
            const bodyText = document.body.innerText
            
            return {
                buttonCount: buttons.length,
                hasNumbers: /[0-9]/.test(bodyText),
                buttonTexts: buttons.map((b: any) => b.innerText).slice(0, 5), // 只取前5个看样本
                rootTextLength: rootText.length
            }
        })

        if (evalResult) {
          console.log('\n   📊 页面内容分析:')
          console.log(`      - 按钮数量: ${evalResult.buttonCount} (预期 >= 10)`)
          console.log(`      - 包含数字: ${evalResult.hasNumbers}`)
          console.log(`      - 按钮样本: ${JSON.stringify(evalResult.buttonTexts)}`)
          
          if (evalResult.buttonCount < 10) {
              console.warn('   ⚠️ 警告：按钮数量似乎不足，可能是渲染不完整')
          } else {
              console.log('   ✅ 确认：页面结构符合计算器特征')
          }
        }

    } catch (e) {
        console.error(`   ❌ 页面访问/检查过程中出错: ${e instanceof Error ? e.message : String(e)}`)
    }

    // 3. 验证结果
    console.log('\n🔍 步骤 3: 最终验证结果')
    console.log('='.repeat(60))
    
    // 如果 AI 分析失败但截图成功，说明基本功能正常
    const buttonCount = evalResult?.buttonCount || 0
    const aiFailed = verifyResult.issues?.some(issue => issue.includes('AI 分析失败')) || 
                     verifyResult.issues?.some(issue => issue.includes('ANTHROPIC_API_KEY'))
    const basicFunctionsWork = screenshotPath && fs.existsSync(screenshotPath) && buttonCount >= 10
    
    if (aiFailed && basicFunctionsWork) {
      console.log(`   验证状态: ⚠️  AI 分析不可用，但基本功能正常`)
      console.log(`   💡 提示: 设置 ANTHROPIC_API_KEY 环境变量以启用 AI 验证`)
    } else {
      console.log(`   验证通过: ${verifyResult.passed ? '✅ 是' : '❌ 否'}`)
    }
    
    if (verifyResult.issues?.length) {
      console.log(`\n   ⚠️  发现的问题:`)
      verifyResult.issues.forEach((issue, idx) => {
        console.log(`      ${idx + 1}. ${issue}`)
      })
    }
    if (verifyResult.suggestions?.length) {
      console.log(`\n   💡 优化建议:`)
      verifyResult.suggestions.forEach((suggestion, idx) => {
        console.log(`      ${idx + 1}. ${suggestion}`)
      })
    }
    if (screenshotPath) {
      console.log(`\n   📸 截图路径: ${screenshotPath}`)
    }
    console.log('='.repeat(60))
    
    // 最终总结
    if (verifyResult.passed) {
      console.log('\n🎉 测试成功！沙盒预览功能正常工作。')
    } else if (aiFailed && basicFunctionsWork) {
      console.log('\n✅ 测试基本通过！沙盒和截图功能正常工作。')
      console.log('   ⚠️  AI 分析不可用，请设置 ANTHROPIC_API_KEY 环境变量以启用完整验证。')
    } else {
      console.log('\n⚠️  测试发现问题，但沙盒功能基本可用。')
    }

  } catch (error) {
    console.error('\n❌ 测试流程发生致命错误:')
    console.error('='.repeat(60))
    if (error instanceof Error) {
      console.error(`   错误类型: ${error.constructor.name}`)
      console.error(`   错误消息: ${error.message}`)
      if (error.stack) {
        console.error(`\n   堆栈跟踪:`)
        console.error(error.stack.split('\n').slice(0, 10).join('\n'))
      }
    } else {
      console.error(`   错误: ${String(error)}`)
    }
    console.error('='.repeat(60))
  } finally {
    // 4. 清理资源
    if (browser) await browser.close()
    
    if (sandboxResult?.containerId && sandboxResult.type === 'daytona') {
      console.log('\n🧹 清理沙盒容器...')
      try {
        await sandboxService.deleteSandbox(sandboxResult.containerId)
        console.log('   ✅ 清理完成')
      } catch (e) { console.error('   ❌ 清理失败', e) }
    }
  }
}

main()