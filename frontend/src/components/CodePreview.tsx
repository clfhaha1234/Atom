import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import type { Artifact } from '../types'

interface CodePreviewProps {
  artifact: Artifact
}

const generatePreviewHTML = (mainCode: string, allFiles: Record<string, string>) => {
  // 简单的 React 预览
  if (mainCode.includes('React') || mainCode.includes('react') || mainCode.includes('JSX')) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Preview</title>
  <script crossorigin src="https://cdn.staticfile.org/react/18.2.0/umd/react.development.js"></script>
  <script crossorigin src="https://cdn.staticfile.org/react-dom/18.2.0/umd/react-dom.development.js"></script>
  <script src="https://cdn.staticfile.org/babel-standalone/7.23.5/babel.min.js"></script>
  <style>
    body { margin: 0; padding: 20px; font-family: sans-serif; }
    ${allFiles['index.css'] || ''}
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
    ReactDOM.render(<App />, document.getElementById('root'));
  </script>
</body>
</html>
    `
  }

  // 普通 HTML 预览
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Preview</title>
  <style>
    ${allFiles['index.css'] || 'body { margin: 0; padding: 20px; }'}
  </style>
</head>
<body>
  ${mainCode}
</body>
</html>
  `
}

export function CodePreview({ artifact }: CodePreviewProps) {
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [previewUrl, setPreviewUrl] = useState<string>('')

  useEffect(() => {
    if (artifact.type === 'code' && artifact.content) {
      const files = Object.keys(artifact.content)
      if (files.length > 0) {
        setSelectedFile(files[0])
      }
    }
  }, [artifact])

  useEffect(() => {
    if (artifact.type === 'code' && artifact.content && selectedFile) {
      // 如果有沙盒 URL，优先使用沙盒预览
      if (artifact.sandboxInfo?.websiteUrl) {
        setPreviewUrl(artifact.sandboxInfo.websiteUrl)
        return
      }
      
      // 否则使用浏览器预览
      const code = artifact.content[selectedFile] || ''
      const html = generatePreviewHTML(code, artifact.content)
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)

      return () => {
        URL.revokeObjectURL(url)
      }
    }
  }, [artifact, selectedFile])

  if (artifact.type !== 'code' || !artifact.content) {
    return (
      <div className="p-8 text-center text-gray-500">
        暂无代码预览
      </div>
    )
  }

  const files = Object.keys(artifact.content)

  const hasSandbox = !!artifact.sandboxInfo?.websiteUrl

  return (
    <div className="h-full flex flex-col border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">代码文件:</span>
          <select
            value={selectedFile}
            onChange={(e) => setSelectedFile(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
          >
            {files.map((file) => (
              <option key={file} value={file}>
                {file}
              </option>
            ))}
          </select>
        </div>
        {hasSandbox && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">🌐 沙盒环境</span>
            {artifact.sandboxInfo?.vncUrl && (
              <a
                href={artifact.sandboxInfo.vncUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline"
              >
                VNC 远程桌面
              </a>
            )}
          </div>
        )}
      </div>
      
      <div className="flex-1 grid grid-cols-2 gap-0" style={{ minHeight: '400px' }}>
        <div className="border-r border-gray-200">
          <Editor
            height="100%"
            language={selectedFile.endsWith('.tsx') || selectedFile.endsWith('.jsx') ? 'typescript' : 
                     selectedFile.endsWith('.css') ? 'css' : 
                     selectedFile.endsWith('.json') ? 'json' : 'javascript'}
            value={artifact.content[selectedFile] || ''}
            theme="vs-light"
            options={{
              readOnly: true,
              minimap: { enabled: false },
            }}
          />
        </div>
        
        <div className="bg-white">
          <div className="h-full">
            {previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title="Preview"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                加载预览中...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
