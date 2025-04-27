import common from "../../../lib/common/common.js"
import path from 'path'
import fs from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'
import archiver from 'archiver'
import os from 'os'
import {
  bfPath, pluginsPath, lastBackupInfoPath, resourcesPath, ignorePaths,
  getFileHash, saveBackupInfo, loadBackupInfo, updateProgress, createZipArchive, copyFile, getBackupFileName
} from '../components/BackupUtil.js'

const execAsync = promisify(exec)
const tempDir = path.join(os.tmpdir(), 'yunzai-backup-temp')

export class updateLog extends plugin {
  constructor(e) {
    super({
      name: '[备份|还原]',
      dsc: '备份还原与云端备份',
      event: 'message',
      priority: 10,
      rule: [
        {
          reg: '^#?(配置文件)?备份$',
          fnc: 'bf'
        },
        {
          reg: '^#?(配置文件)?备份并压缩$',
          fnc: 'backupAndCompress'
        },
        {
          reg: '^#?(配置文件)?增量备份$',
          fnc: 'incrementalBackup'
        },
        {
          reg: '^#?(配置文件)?增量备份并压缩$',
          fnc: 'incrementalBackupAndCompress'
        },
        {
          reg: '^#?(配置文件)?还原$',
          fnc: 'hy'
        },
        {
          reg: '^#?查看备份进度$',
          fnc: 'checkProgress'
        }
      ]
    })
  }

  // 工具方法：检查是否为主人
  checkMaster(e) {
    if (!e.isMaster) {
      e.reply('只有主人才能使用此功能哦~')
      return false
    }
    return true
  }

  // 查看备份进度
  async checkProgress(e) {
    if (!this.checkMaster(e)) return false

    let msg = '当前没有正在进行的备份任务'
    
    if (backupProgress.status !== 'idle') {
      const progress = Math.floor((backupProgress.processedFiles / backupProgress.totalFiles) * 100) || 0
      const status = {
        'compressing': '压缩中',
        'uploading': '上传中',
        'done': '已完成',
        'error': '出错'
      }[backupProgress.status]

      msg = `备份状态：${status}\n`
      msg += `总文件数：${backupProgress.totalFiles}\n`
      msg += `已处理：${backupProgress.processedFiles}\n`
      msg += `进度：${progress}%`

      if (backupProgress.error) {
        msg += `\n错误信息：${backupProgress.error}`
      }
    }

    await this.reply(msg, true)
    return true
  }

  // 工具方法：创建压缩文件
  async createZipArchive(sourcePath, zipPath) {
    const output = fs.createWriteStream(zipPath)
    const archive = archiver('zip', {
      zlib: { level: 9 }
    })

    let fileCount = 0
    archive.on('entry', () => {
      fileCount++
      updateProgress('compressing', {
        processedFiles: fileCount,
        totalFiles: fileCount
      })
    })

    return new Promise((resolve, reject) => {
      output.on('close', () => resolve(fileCount))
      archive.on('error', reject)
      archive.pipe(output)
      archive.directory(sourcePath, false)
      archive.finalize()
    })
  }

  async bf(e) {
    if (!this.checkMaster(e)) return false

    let ok = []
    let err = []

    this.reply('开始备份插件配置文件，请稍后......\n会同时备份面板,礼记数据,喵喵帮助,\n抽卡记录,stoken,js哦!')
    await common.sleep(1000)

    try {
      // 清理旧的备份目录
      if (fs.existsSync(bfPath)) {
        await fs.promises.rm(bfPath, { recursive: true, force: true })
      }
      await fs.promises.mkdir(bfPath, { recursive: true })

      // 备份主要目录
      await this.copyFile('./config', path.join(bfPath, 'config'))
      await this.copyFile('./data', path.join(bfPath, 'data'))
      ok.push('config', 'data')
    } catch (error) {
      err.push('本体配置文件')
    }

    // 备份插件
    const plugins = fs.readdirSync(pluginsPath)
    for (const plugin of plugins) {
      try {
        if (plugin === 'example') {
          await this.copyFile(path.join(pluginsPath, plugin), path.join(bfPath, plugin))
        } else {
          // 备份插件配置
          const configPath = path.join(pluginsPath, plugin, 'config')
          if (fs.existsSync(configPath)) {
            await this.copyFile(configPath, path.join(bfPath, `${plugin}/config`))
          }

          // 备份插件数据
          const dataPath = path.join(pluginsPath, plugin, 'data')
          if (fs.existsSync(dataPath)) {
            await this.copyFile(dataPath, path.join(bfPath, `${plugin}/data`))
          }

          // 特殊处理 miao-plugin
          if (plugin === 'miao-plugin') {
            const helpPath = path.join(pluginsPath, plugin, 'resources/help')
            if (fs.existsSync(helpPath)) {
              await this.copyFile(helpPath, path.join(bfPath, `${plugin}/resources/help`))
            }
          }
        }
        ok.push(plugin)
      } catch (error) {
        err.push(plugin)
      }
    }

    const msg = [`共备份${ok.length + err.length}个插件配置文件，\n已保存到Bot/resources/bf下\n成功${ok.length}个\n${ok.toString().replace(/,/g, '，\n')}\n\n失败${err.length}个\n${err.toString().replace(/,/g, '，\n')}`]
    this.reply(await common.makeForwardMsg(e, msg, '备份成功,点击查看备份内容'))
    return true
  }

  async backupAndCompress(e) {
    if (!this.checkMaster(e)) return false

    try {
      // 重置进度信息
      updateProgress('idle', {
        totalFiles: 0,
        processedFiles: 0,
        currentFile: '',
        error: null
      })

      // 先执行备份
      await this.bf(e)

      // 创建压缩文件
      const zipFileName = getBackupFileName() + '.zip'
      const zipPath = path.join(resourcesPath, zipFileName)
      updateProgress('compressing', { currentFile: zipFileName })
      await this.createZipArchive(bfPath, zipPath)

      updateProgress('done')
      e.reply(`备份压缩完成！压缩包已生成于：${zipPath}`)
    } catch (err) {
      updateProgress('error', { error: err.message })
      logger.error('[备份压缩] 发生错误：', err)
      e.reply(`备份压缩出错：${err.message}`)
    }
  }

  async incrementalBackup(e) {
    if (!this.checkMaster(e)) return false

    try {
      // 先执行备份
      await this.bf(e)

      // 加载上次备份信息
      const lastBackupInfo = await loadBackupInfo()
      const currentBackupInfo = { files: {}, timestamp: Date.now() }

      // 检查文件变更并更新bf目录
      const changedFiles = []
      const getFiles = async (dir) => {
        const items = fs.readdirSync(dir)
        for (const item of items) {
          const fullPath = path.join(dir, item)
          const stat = fs.statSync(fullPath)
          
          if (stat.isDirectory()) {
            await getFiles(fullPath)
          } else {
            if (item !== '备份.js' && !item.startsWith('.')) {
              const relPath = path.relative(bfPath, fullPath)
              const currentHash = await this.getFileHash(fullPath)
              currentBackupInfo.files[relPath] = currentHash
              
              if (currentHash !== lastBackupInfo.files[relPath]) {
                changedFiles.push({
                  path: fullPath,
                  relativePath: relPath
                })
              }
            }
          }
        }
      }
      
      await getFiles(bfPath)

      if (changedFiles.length === 0) {
        e.reply('增量备份完成，未发现文件变更')
        return
      }

      // 更新bf目录中的文件
      e.reply(`发现 ${changedFiles.length} 个文件变更，正在更新备份目录...`)
      
      for (const file of changedFiles) {
        const targetPath = path.join(bfPath, file.relativePath)
        const targetDir = path.dirname(targetPath)
        
        // 确保目标目录存在
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true })
        }
        
        // 复制更新的文件
        await fs.promises.copyFile(file.path, targetPath)
      }

      // 保存当前备份信息
      await saveBackupInfo(currentBackupInfo)

      // 生成变更文件列表
      const changedFilesList = changedFiles.map(file => file.relativePath)
      const msg = [
        `增量备份完成！\n更新文件数：${changedFiles.length}`,
        `变更文件列表：\n${changedFilesList.join('\n')}`
      ]
      
      e.reply(await common.makeForwardMsg(e, msg, '增量备份报告'))
      logger.info(`[增量备份] 完成\n更新文件数：${changedFiles.length}`)

    } catch (err) {
      logger.error('[增量备份] 发生错误：', err)
      e.reply(`增量备份出错：${err.message}`)
    }
  }

  async incrementalBackupAndCompress(e) {
    if (!this.checkMaster(e)) return false

    try {
      // 重置进度信息
      updateProgress('idle', {
        totalFiles: 0,
        processedFiles: 0,
        currentFile: '',
        error: null
      })

      // 执行增量备份
      await this.incrementalBackup(e)

      // 创建压缩文件
      const zipFileName = getBackupFileName() + '_incremental.zip'
      const zipPath = path.join(resourcesPath, zipFileName)
      updateProgress('compressing', { currentFile: zipFileName })
      await this.createZipArchive(bfPath, zipPath)

      updateProgress('done')
      e.reply(`增量备份压缩完成！压缩包已生成于：${zipPath}`)
    } catch (err) {
      updateProgress('error', { error: err.message })
      logger.error('[增量备份压缩] 发生错误：', err)
      e.reply(`增量备份压缩出错：${err.message}`)
    }
  }

  async hy(e) {
    if (!this.checkMaster(e)) return false

    this.reply('还原中......,PS:请先下载所有插件后还原\n还原时请将resources/bf下的文件放到对应位置')
    await common.sleep(1000)

    let ok = []
    let err = []
    const bfs = fs.readdirSync(bfPath)

    for (const bf of bfs) {
      try {
        if (bf === 'data' || bf === 'config') {
          await this.copyFile(path.join(bfPath, bf), `./${bf}`)
        } else {
          await this.copyFile(path.join(bfPath, bf), path.join(pluginsPath, bf))
        }
        ok.push(bf)
      } catch (error) {
        err.push(bf)
      }
    }
   
    const msg = [`共还原${ok.length + err.length}个插件配置文件，成功${ok.length}个\n${ok.toString().replace(/,/g, '，\n')}\n\n失败${err.length}个\n${err.toString().replace(/,/g, '，\n')}`]
    this.reply(await common.makeForwardMsg(e, msg, '还原成功,点击查看还原内容'))
  }
}

function copyFiles(src, dest) {
  // 将路径标准化，移除开头的 ./ 以便于比较
  const normalizedSrc = src.replace(/^\.\//, '')
  const normalizedDest = dest.replace(/^\.\//, '')

  // 检查是否在忽略列表中
  if (ignorePaths.some(ignorePath => 
    normalizedSrc.includes(ignorePath) || normalizedDest.includes(ignorePath))) {
    return
  }

  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
  fs.readdir(src, { withFileTypes: true }, (err, files) => {
    if (err) {
      console.log(err)
      return
    }

    files.forEach(function (srcFile) {
      if (srcFile.isDirectory()) {
        const destFile1 = path.resolve(dest, srcFile.name)
        const srcFile1 = path.resolve(src, srcFile.name)
        
        // 构建完整的相对路径用于检查
        const relativePath = path.relative(process.cwd(), srcFile1).replace(/\\/g, '/')
        if (ignorePaths.some(ignorePath => relativePath.includes(ignorePath))) {
          return
        }

        if (!fs.existsSync(destFile1)) {
          fs.mkdirSync(destFile1, (err) => {
            if (err) console.log(err)
          })
        }
        copyFiles(srcFile1, destFile1)
      } else {
        if (srcFile.name !== '备份.js') {
          const srcFileDir = path.resolve(src, srcFile.name)
          const destFile = path.resolve(dest, srcFile.name)
          fs.promises.copyFile(srcFileDir, destFile)
        }
      }
    })
  })
}


