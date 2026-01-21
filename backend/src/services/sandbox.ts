/**
 * 沙盒环境服务
 * 
 * 支持两种模式：
 * 1. 浏览器预览（简单前端应用）
 * 2. Daytona 沙盒（完整前后端应用）
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

interface SandboxOptions {
  userId: string
  projectId: string
  code: Record<string, string>
}

interface SandboxResult {
  url: string
  type: 'browser' | 'container' | 'cloud' | 'daytona'
  containerId?: string
  vncUrl?: string
  websiteUrl?: string
}

interface DaytonaSandboxInfo {
  sandboxId: string
  vncUrl: string
  websiteUrl: string
}

/**
 * 沙盒服务
 * 根据代码复杂度自动选择预览方式
 */
export class SandboxService {
  private pythonScriptPath: string
  
  constructor() {
    // Python 脚本路径
    this.pythonScriptPath = path.join(__dirname, '../../scripts/daytona_sandbox.py')
  }
  
  /**
   * 调用 Python 脚本执行 Daytona 操作
   */
  private async callPythonScript(action: string, ...args: string[]): Promise<any> {
    const command = `python3 "${this.pythonScriptPath}" ${action} ${args.map(arg => `"${arg.replace(/"/g, '\\"')}"`).join(' ')}`
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        env: {
          ...process.env,
          DAYTONA_API_KEY: process.env.DAYTONA_API_KEY,
          DAYTONA_SERVER_URL: process.env.DAYTONA_SERVER_URL,
          DAYTONA_TARGET: process.env.DAYTONA_TARGET,
          DAYTONA_SANDBOX_IMAGE: process.env.DAYTONA_SANDBOX_IMAGE,
        },
        maxBuffer: 10 * 1024 * 1024, // 10MB
      })
      
      const output = stdout.trim()
      if (output) {
        return JSON.parse(output)
      }
      
      if (stderr) {
        const error = JSON.parse(stderr)
        throw new Error(error.error || stderr)
      }
      
      return { success: true }
    } catch (error: any) {
      // 尝试解析错误输出
      if (error.stderr) {
        try {
          const errorData = JSON.parse(error.stderr)
          throw new Error(errorData.error || errorData.message || 'Unknown error')
        } catch {
          // 如果不是 JSON，使用原始错误
        }
      }
      throw error
    }
  }
  
  /**
   * 创建沙盒环境
   * 根据代码复杂度自动选择预览方式
   */
  async createSandbox(options: SandboxOptions): Promise<SandboxResult> {
    const { userId, projectId, code } = options
    
    // 检查是否需要 Daytona 沙盒
    if (this.needsSandbox(code) && process.env.DAYTONA_API_KEY) {
      try {
        return await this.createDaytonaSandbox(options)
      } catch (error) {
        console.error('Failed to create Daytona sandbox, falling back to browser preview:', error)
        // 降级到浏览器预览
      }
    }
    
    // 默认：浏览器预览
    return {
      url: 'browser-preview',
      type: 'browser',
    }
  }
  
  /**
   * 创建 Daytona 沙盒
   */
  async createDaytonaSandbox(options: SandboxOptions): Promise<SandboxResult> {
    const { userId, projectId } = options
    const password = process.env.DAYTONA_VNC_PASSWORD || '123456'
    
    const result = await this.callPythonScript('create', password, projectId || userId)
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create sandbox')
    }
    
    return {
      url: result.website_url,
      type: 'daytona',
      containerId: result.sandbox_id,
      vncUrl: result.vnc_url,
      websiteUrl: result.website_url,
    }
  }
  
  /**
   * 在沙盒中写入文件
   * 使用 stdin 传递文件内容，避免命令行长度限制
   */
  async writeFile(sandboxId: string, filePath: string, content: string): Promise<void> {
    const { spawn } = require('child_process')
    
    return new Promise((resolve, reject) => {
      const args = [this.pythonScriptPath, 'write_file_stdin', sandboxId, filePath]
      const child = spawn('python3', args, {
        env: {
          ...process.env,
          DAYTONA_API_KEY: process.env.DAYTONA_API_KEY,
          DAYTONA_SERVER_URL: process.env.DAYTONA_SERVER_URL,
          DAYTONA_TARGET: process.env.DAYTONA_TARGET,
          DAYTONA_SANDBOX_IMAGE: process.env.DAYTONA_SANDBOX_IMAGE,
        },
      })
      
      let stdout = ''
      let stderr = ''
      
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString()
      })
      
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })
      
      child.on('close', (code: number) => {
        try {
          const result = JSON.parse(stdout.trim())
          if (result.success) {
            resolve()
          } else {
            reject(new Error(result.error || 'Failed to write file'))
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${stdout}\n${stderr}`))
        }
      })
      
      child.on('error', (err: Error) => {
        reject(err)
      })
      
      // 通过 stdin 传递文件内容
      child.stdin.write(content)
      child.stdin.end()
    })
  }
  
  /**
   * 在沙盒中执行命令
   */
  async runCommand(sandboxId: string, command: string, blocking: boolean = false, timeout: number = 60): Promise<string> {
    const result = await this.callPythonScript(
      'run_command',
      sandboxId,
      command,
      blocking.toString(),
      timeout.toString()
    )
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to run command')
    }
    
    return result.output || result.message || ''
  }
  
  /**
   * 删除沙盒
   */
  async deleteSandbox(sandboxId: string): Promise<void> {
    const result = await this.callPythonScript('delete', sandboxId)
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete sandbox')
    }
  }
  
  /**
   * 检查代码是否需要沙盒环境
   */
  needsSandbox(code: Record<string, string>): boolean {
    // 检查是否有后端代码
    const hasBackend = Object.keys(code).some(file => 
      file.includes('server') || 
      file.includes('api') || 
      file.includes('backend') ||
      file.includes('express') ||
      file.includes('database')
    )
    
    if (hasBackend) return true

    // 检查是否有 package.json
    if (code['package.json']) {
      // 只要有 package.json，就认为是一个完整的项目，可以使用沙盒运行
      // 这样可以支持 React、Vue 等前端项目的在线预览
      return true
    }
    
    return false
  }
}

export const sandboxService = new SandboxService()
