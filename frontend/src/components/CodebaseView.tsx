import { useState, useMemo } from 'react'
import Editor from '@monaco-editor/react'
import type { Artifact } from '../types'

interface CodebaseViewProps {
  artifact: Artifact
}

interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
}

// 将扁平文件结构转换为树形结构
function buildFileTree(files: Record<string, string>): FileNode[] {
  const tree: FileNode[] = []
  const pathMap = new Map<string, FileNode>()

  // 创建所有节点
  Object.keys(files).forEach((filePath) => {
    const parts = filePath.split('/')
    let currentPath = ''
    
    parts.forEach((part, index) => {
      const parentPath = currentPath
      currentPath = currentPath ? `${currentPath}/${part}` : part
      
      if (!pathMap.has(currentPath)) {
        const isFile = index === parts.length - 1
        const node: FileNode = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : [],
        }
        
        pathMap.set(currentPath, node)
        
        if (parentPath) {
          const parent = pathMap.get(parentPath)
          if (parent && parent.children) {
            parent.children.push(node)
          }
        } else {
          tree.push(node)
        }
      }
    })
  })

  // 排序：文件夹在前，文件在后，按名称排序
  const sortNodes = (nodes: FileNode[]): FileNode[] => {
    return nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    }).map(node => ({
      ...node,
      children: node.children ? sortNodes(node.children) : undefined
    }))
  }

  return sortNodes(tree)
}

function FileTreeItem({ node, files, onSelectFile, selectedFile, level = 0 }: {
  node: FileNode
  files: Record<string, string>
  onSelectFile: (path: string) => void
  selectedFile: string
  level?: number
}) {
  const [expanded, setExpanded] = useState(level < 2) // 默认展开前2层
  const isSelected = selectedFile === node.path

  if (node.type === 'file') {
    const getFileIcon = (filename: string) => {
      if (filename.endsWith('.tsx') || filename.endsWith('.jsx')) return '⚛️'
      if (filename.endsWith('.ts') || filename.endsWith('.js')) return '📜'
      if (filename.endsWith('.css')) return '🎨'
      if (filename.endsWith('.json')) return '📋'
      if (filename.endsWith('.html')) return '🌐'
      if (filename.endsWith('.md')) return '📝'
      return '📄'
    }

    return (
      <div
        className={`px-2 py-1.5 text-sm cursor-pointer flex items-center hover:bg-gray-100 transition-colors ${
          isSelected ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
        }`}
        onClick={() => onSelectFile(node.path)}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        <span className="mr-2 text-base">{getFileIcon(node.name)}</span>
        <span className="truncate">{node.name}</span>
      </div>
    )
  }

  return (
    <div>
      <div
        className="px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 text-gray-700 flex items-center transition-colors"
        onClick={() => setExpanded(!expanded)}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        <span className="mr-2 w-4 text-center">
          {expanded ? '▼' : '▶'}
        </span>
        <span className="mr-2 text-base">📁</span>
        <span className="font-medium">{node.name}</span>
      </div>
      {expanded && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              files={files}
              onSelectFile={onSelectFile}
              selectedFile={selectedFile}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function CodebaseView({ artifact }: CodebaseViewProps) {
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'files' | 'search'>('files')

  if (artifact.type !== 'code' || !artifact.content) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        暂无代码
      </div>
    )
  }

  const files = artifact.content
  const fileTree = useMemo(() => buildFileTree(files), [files])
  
  // 如果没有选中文件，选择第一个文件
  if (!selectedFile && Object.keys(files).length > 0) {
    const firstFile = Object.keys(files)[0]
    if (firstFile) {
      setSelectedFile(firstFile)
    }
  }

  // 搜索文件
  const filteredFiles = useMemo(() => {
    if (!searchQuery) return Object.keys(files)
    const query = searchQuery.toLowerCase()
    return Object.keys(files).filter(filePath => 
      filePath.toLowerCase().includes(query) ||
      files[filePath].toLowerCase().includes(query)
    )
  }, [files, searchQuery])

  const getLanguage = (filename: string): string => {
    if (filename.endsWith('.tsx') || filename.endsWith('.jsx')) return 'typescript'
    if (filename.endsWith('.ts')) return 'typescript'
    if (filename.endsWith('.js')) return 'javascript'
    if (filename.endsWith('.css')) return 'css'
    if (filename.endsWith('.json')) return 'json'
    if (filename.endsWith('.html')) return 'html'
    if (filename.endsWith('.md')) return 'markdown'
    return 'plaintext'
  }

  const getFileExtension = (filename: string): string => {
    const parts = filename.split('.')
    return parts.length > 1 ? parts[parts.length - 1] : ''
  }

  return (
    <div className="h-full flex bg-white">
      {/* 左侧：文件树 */}
      <div className="w-64 border-r border-gray-200 bg-white flex flex-col">
        {/* 标签页 */}
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('files')}
              className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'files'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Files
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'search'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Search
            </button>
          </div>
        </div>

        {/* 搜索框 */}
        {activeTab === 'search' && (
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        )}

        {/* 文件列表 */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'files' ? (
            <div className="p-2">
              {fileTree.map((node) => (
                <FileTreeItem
                  key={node.path}
                  node={node}
                  files={files}
                  onSelectFile={setSelectedFile}
                  selectedFile={selectedFile}
                />
              ))}
            </div>
          ) : (
            <div className="p-2">
              {filteredFiles.length > 0 ? (
                filteredFiles.map((filePath) => {
                  const fileName = filePath.split('/').pop() || filePath
                  const isSelected = selectedFile === filePath
                  return (
                    <div
                      key={filePath}
                      className={`px-2 py-1.5 text-sm cursor-pointer flex items-center hover:bg-gray-100 transition-colors ${
                        isSelected ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                      }`}
                      onClick={() => setSelectedFile(filePath)}
                    >
                      <span className="mr-2 text-base">📄</span>
                      <span className="truncate flex-1">{fileName}</span>
                      <span className="text-xs text-gray-400 ml-2">{getFileExtension(fileName)}</span>
                    </div>
                  )
                })
              ) : (
                <div className="p-4 text-center text-gray-400 text-sm">
                  {searchQuery ? '未找到匹配的文件' : '输入关键词搜索文件'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 文件统计 */}
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
          {Object.keys(files).length} 个文件
        </div>
      </div>

      {/* 右侧：代码编辑器 */}
      <div className="flex-1 flex flex-col">
        {selectedFile ? (
          <>
            <div className="px-4 py-2 border-b border-gray-200 bg-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">{selectedFile}</span>
                <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-100 rounded">
                  {getFileExtension(selectedFile)}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-xs text-gray-500">
                  {files[selectedFile]?.split('\n').length || 0} 行
                </div>
                <div className="text-xs text-gray-400">
                  {files[selectedFile]?.length || 0} 字符
                </div>
              </div>
            </div>
            <div className="flex-1">
              <Editor
                height="100%"
                language={getLanguage(selectedFile)}
                value={files[selectedFile] || ''}
                theme="vs-light"
                options={{
                  readOnly: true,
                  minimap: { enabled: true },
                  fontSize: 14,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-4">📁</div>
              <p>选择一个文件查看代码</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
