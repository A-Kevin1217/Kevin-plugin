import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import archiver from 'archiver'
import os from 'os'

export const bfPath = path.join(process.cwd(), '/resources/bf/')
export const pluginsPath = path.join(process.cwd(), '/plugins/')
export const lastBackupInfoPath = path.join(process.cwd(), '/resources/bf/.last_backup.json')
export const tempDir = path.join(os.tmpdir(), 'yunzai-backup-temp')
export const resourcesPath = path.join(process.cwd(), '/resources/')

export const ignorePaths = [
  'data/meme',
  'plugins/example/data/bot_pic/猫猫糕'
]

export let backupProgress = {
  status: 'idle',
  totalFiles: 0,
  processedFiles: 0,
  currentFile: '',
  error: null
}

export async function getFileHash(filePath) {
  try {
    const fileContent = await fs.promises.readFile(filePath)
    const hash = crypto.createHash('md5')
    hash.update(fileContent)
    return hash.digest('hex')
  } catch (err) {
    return null
  }
}

export async function saveBackupInfo(backupInfo) {
  await fs.promises.writeFile(lastBackupInfoPath, JSON.stringify(backupInfo, null, 2))
}

export async function loadBackupInfo() {
  if (fs.existsSync(lastBackupInfoPath)) {
    const content = await fs.promises.readFile(lastBackupInfoPath, 'utf8')
    return JSON.parse(content)
  }
  return { files: {} }
}

export function updateProgress(status, data = {}) {
  backupProgress = {
    ...backupProgress,
    status,
    ...data
  }
}

export async function createZipArchive(sourcePath, zipPath, updateProgressFn) {
  const output = fs.createWriteStream(zipPath)
  const archive = archiver('zip', { zlib: { level: 9 } })
  let fileCount = 0
  archive.on('entry', () => {
    fileCount++
    if (updateProgressFn) updateProgressFn('compressing', { processedFiles: fileCount, totalFiles: fileCount })
  })
  return new Promise((resolve, reject) => {
    output.on('close', () => resolve(fileCount))
    archive.on('error', reject)
    archive.pipe(output)
    archive.directory(sourcePath, false)
    archive.finalize()
  })
}

export function getBackupFileName() {
  const now = new Date()
  return `backup_${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`
}

export async function copyFile(src, dest) {
  const normalizedSrc = src.replace(/^\.\//, '')
  const normalizedDest = dest.replace(/^\.\//, '')
  if (ignorePaths.some(ignorePath => normalizedSrc.includes(ignorePath) || normalizedDest.includes(ignorePath))) {
    return
  }
  if (!fs.existsSync(dest)) {
    await fs.promises.mkdir(dest, { recursive: true })
  }
  const files = await fs.promises.readdir(src, { withFileTypes: true })
  for (const file of files) {
    if (file.name === '备份.js') continue
    const srcPath = path.join(src, file.name)
    const destPath = path.join(dest, file.name)
    if (file.isDirectory()) {
      const relativePath = path.relative(process.cwd(), srcPath).replace(/\\/g, '/')
      if (!ignorePaths.some(ignorePath => relativePath.includes(ignorePath))) {
        await copyFile(srcPath, destPath)
      }
    } else {
      await fs.promises.copyFile(srcPath, destPath)
    }
  }
} 