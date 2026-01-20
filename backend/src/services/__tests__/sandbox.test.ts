/**
 * 沙盒服务测试用例
 * 测试 Daytona 沙盒的创建、文件操作、命令执行等功能
 */

import { sandboxService } from '../sandbox'
import * as dotenv from 'dotenv'

// 加载环境变量
dotenv.config()

describe('Sandbox Service Tests', () => {
  const testUserId = 'test-user-123'
  const testProjectId = 'test-project-456'
  
  // 跳过测试如果 API Key 未配置
  const hasDaytonaKey = !!process.env.DAYTONA_API_KEY
  
  beforeAll(() => {
    if (!hasDaytonaKey) {
      console.warn('⚠️  DAYTONA_API_KEY not found, skipping sandbox tests')
    }
  })

  describe('needsSandbox', () => {
    it('should return false for simple frontend code', () => {
      const code = {
        'App.tsx': 'import React from "react";',
        'index.css': 'body { margin: 0; }',
      }
      expect(sandboxService.needsSandbox(code)).toBe(false)
    })

    it('should return true for backend code', () => {
      const code = {
        'server.js': 'const express = require("express");',
        'package.json': JSON.stringify({
          dependencies: { express: '^4.0.0' }
        }),
      }
      expect(sandboxService.needsSandbox(code)).toBe(true)
    })

    it('should return true for code with backend dependencies', () => {
      const code = {
        'package.json': JSON.stringify({
          dependencies: {
            express: '^4.0.0',
            mongoose: '^6.0.0'
          }
        }),
      }
      expect(sandboxService.needsSandbox(code)).toBe(true)
    })
  })

  describe('createSandbox', () => {
    it('should return browser preview for simple code', async () => {
      const code = {
        'App.tsx': 'import React from "react";',
      }
      
      const result = await sandboxService.createSandbox({
        userId: testUserId,
        projectId: testProjectId,
        code,
      })
      
      expect(result.type).toBe('browser')
      expect(result.url).toBe('browser-preview')
    }, 10000)

    it.skip('should create Daytona sandbox for complex code', async () => {
      if (!hasDaytonaKey) {
        console.log('Skipping: DAYTONA_API_KEY not configured')
        return
      }

      const code = {
        'server.js': 'const express = require("express");',
        'package.json': JSON.stringify({
          name: 'test-app',
          dependencies: { express: '^4.0.0' }
        }),
      }
      
      const result = await sandboxService.createSandbox({
        userId: testUserId,
        projectId: testProjectId,
        code,
      })
      
      expect(result.type).toBe('daytona')
      expect(result.containerId).toBeDefined()
      expect(result.websiteUrl).toBeDefined()
      expect(result.vncUrl).toBeDefined()
      
      // 清理：删除沙盒
      if (result.containerId) {
        await sandboxService.deleteSandbox(result.containerId)
      }
    }, 60000)
  })

  describe('writeFile', () => {
    let sandboxId: string | null = null

    beforeAll(async () => {
      if (!hasDaytonaKey) return
      
      // 创建测试沙盒
      const code = {
        'test.txt': 'test content',
      }
      const result = await sandboxService.createSandbox({
        userId: testUserId,
        projectId: testProjectId,
        code,
      })
      
      if (result.type === 'daytona' && result.containerId) {
        sandboxId = result.containerId
      }
    }, 60000)

    afterAll(async () => {
      if (sandboxId) {
        try {
          await sandboxService.deleteSandbox(sandboxId)
        } catch (error) {
          console.error('Failed to cleanup sandbox:', error)
        }
      }
    })

    it.skip('should write file to sandbox', async () => {
      if (!hasDaytonaKey || !sandboxId) {
        console.log('Skipping: DAYTONA_API_KEY not configured or sandbox not created')
        return
      }

      const testContent = 'Hello from test!'
      await sandboxService.writeFile(sandboxId, 'test-file.txt', testContent)
      
      // 验证文件已写入（通过读取命令）
      const output = await sandboxService.runCommand(
        sandboxId,
        'cat /workspace/test-file.txt',
        true,
        10
      )
      
      expect(output).toContain(testContent)
    }, 30000)
  })

  describe('runCommand', () => {
    let sandboxId: string | null = null

    beforeAll(async () => {
      if (!hasDaytonaKey) return
      
      const code = {
        'test.txt': 'test',
      }
      const result = await sandboxService.createSandbox({
        userId: testUserId,
        projectId: testProjectId,
        code,
      })
      
      if (result.type === 'daytona' && result.containerId) {
        sandboxId = result.containerId
      }
    }, 60000)

    afterAll(async () => {
      if (sandboxId) {
        try {
          await sandboxService.deleteSandbox(sandboxId)
        } catch (error) {
          console.error('Failed to cleanup sandbox:', error)
        }
      }
    })

    it.skip('should execute blocking command', async () => {
      if (!hasDaytonaKey || !sandboxId) {
        console.log('Skipping: DAYTONA_API_KEY not configured or sandbox not created')
        return
      }

      const output = await sandboxService.runCommand(
        sandboxId,
        'echo "Hello World"',
        true,
        10
      )
      
      expect(output).toContain('Hello World')
    }, 30000)

    it.skip('should execute non-blocking command', async () => {
      if (!hasDaytonaKey || !sandboxId) {
        console.log('Skipping: DAYTONA_API_KEY not configured or sandbox not created')
        return
      }

      const output = await sandboxService.runCommand(
        sandboxId,
        'sleep 2 && echo "Done"',
        false,
        10
      )
      
      // 非阻塞命令应该立即返回
      expect(output).toBeDefined()
    }, 30000)
  })

  describe('deleteSandbox', () => {
    it.skip('should delete sandbox', async () => {
      if (!hasDaytonaKey) {
        console.log('Skipping: DAYTONA_API_KEY not configured')
        return
      }

      // 创建沙盒
      const code = {
        'test.txt': 'test',
      }
      const result = await sandboxService.createSandbox({
        userId: testUserId,
        projectId: testProjectId,
        code,
      })
      
      if (result.type === 'daytona' && result.containerId) {
        // 删除沙盒
        await expect(
          sandboxService.deleteSandbox(result.containerId)
        ).resolves.not.toThrow()
      }
    }, 60000)
  })

  describe('Integration Test: Full Workflow', () => {
    it.skip('should complete full workflow: create -> write -> run -> delete', async () => {
      if (!hasDaytonaKey) {
        console.log('Skipping: DAYTONA_API_KEY not configured')
        return
      }

      // 1. 创建沙盒
      const code = {
        'index.html': '<html><body><h1>Test</h1></body></html>',
        'package.json': JSON.stringify({
          name: 'test-app',
          version: '1.0.0'
        }),
      }
      
      const result = await sandboxService.createSandbox({
        userId: testUserId,
        projectId: testProjectId,
        code,
      })
      
      expect(result.type).toBe('daytona')
      expect(result.containerId).toBeDefined()
      
      if (!result.containerId) {
        throw new Error('Sandbox ID not returned')
      }
      
      const sandboxId = result.containerId
      
      try {
        // 2. 写入文件
        await sandboxService.writeFile(
          sandboxId,
          'test.js',
          'console.log("Hello from test!");'
        )
        
        // 3. 执行命令验证文件
        const output = await sandboxService.runCommand(
          sandboxId,
          'ls -la /workspace',
          true,
          10
        )
        
        expect(output).toContain('test.js')
        expect(output).toContain('index.html')
        
        // 4. 删除沙盒
        await sandboxService.deleteSandbox(sandboxId)
        
        console.log('✅ Full workflow test passed!')
      } catch (error) {
        // 确保清理
        try {
          await sandboxService.deleteSandbox(sandboxId)
        } catch {
          // Ignore cleanup errors
        }
        throw error
      }
    }, 120000)
  })
})
