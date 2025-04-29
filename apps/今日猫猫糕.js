import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { replyMarkdownButton, segment } from '../components/CommonReplyUtil.js'

export class 猫猫糕 extends plugin {
    constructor() {
        super({
            name: '猫猫糕',
            dsc: '猫猫糕',
            event: 'message',
            priority: 1000,
            rule: [
                { reg: /^(#|\/)?(今日猫猫糕)$/, fnc: 'TODAY_MMG' },
                { reg: /^(#|\/)?(换个猫猫糕)$/, fnc: 'CHANGE_MMG' }
            ]
        })
        this.cuteTexts = [/* ...可爱文案... */]
        this.repoDir = path.join(process.cwd(), 'resources/orange-example')
        this.countPath = path.join(this.repoDir, 'json/猫猫糕数量.json')
        this.imgDir = path.join(this.repoDir, 'images/猫猫糕')
        this.repoUrl = 'https://gitcode.com/Kevin1217/orange-example'
        this.cloning = false
        this.ensureRepoAsync()
    }

    ensureRepoAsync() {
        if (!fs.existsSync(this.repoDir) && !this.cloning) {
            this.cloning = true
            logger.info('[猫猫糕] orange-example资源未检测到，正在异步clone...')
            const git = spawn('git', ['clone', this.repoUrl, this.repoDir])
            git.on('close', code => {
                if (code === 0) {
                    logger.info('[猫猫糕] orange-example资源clone完成')
                } else {
                    logger.error('[猫猫糕] clone orange-example失败，code=' + code)
                }
                this.cloning = false
            })
        }
    }

    async getTotalCount() {
        if (!fs.existsSync(this.countPath)) {
            throw new Error('资源正在初始化，请稍后再试')
        }
        const data = JSON.parse(fs.readFileSync(this.countPath, 'utf8'))
        if (!data['猫猫糕数量']) throw new Error('猫猫糕数量字段缺失')
        return data['猫猫糕数量']
    }

    getMMGPath(idx) {
        const numStr = idx.toString().padStart(5, '0')
        const exts = ['jpg', 'png', 'gif']
        for (let ext of exts) {
            const filePath = path.join(this.imgDir, `猫猫糕${numStr}.${ext}`)
            if (fs.existsSync(filePath)) return filePath
        }
        return ''
    }

    getRandomCuteText() {
        const arr = this.cuteTexts
        return arr[Math.floor(Math.random() * arr.length)]
    }

    async getImageSize(imgPath) {
        try {
            const buffer = fs.readFileSync(imgPath)
            const bytes = new Uint8Array(buffer)
            // jpg
            if (imgPath.endsWith('.jpg') || imgPath.endsWith('.jpeg')) {
                let i = 0;
                while (i < bytes.length) {
                    if (bytes[i] === 0xFF && bytes[i + 1] === 0xC0) {
                        const height = (bytes[i + 5] << 8) + bytes[i + 6]
                        const width = (bytes[i + 7] << 8) + bytes[i + 8]
                        return { width, height }
                    }
                    i++
                }
            }
            // png
            if (imgPath.endsWith('.png')) {
                if (bytes[12] === 0x49 && bytes[13] === 0x48 && bytes[14] === 0x44 && bytes[15] === 0x52) {
                    const width = (bytes[16] << 24) + (bytes[17] << 16) + (bytes[18] << 8) + bytes[19]
                    const height = (bytes[20] << 24) + (bytes[21] << 16) + (bytes[22] << 8) + bytes[23]
                    return { width, height }
                }
            }
            // gif
            if (imgPath.endsWith('.gif')) {
                const width = bytes[6] + (bytes[7] << 8)
                const height = bytes[8] + (bytes[9] << 8)
                return { width, height }
            }
        } catch (e) { }
        return null
    }

    async sendMMGMarkdown(e, imgPath) {
        let size = await this.getImageSize(imgPath)
        let altText = '猫猫糕'
        if (size) {
            altText += ` #${size.width}px #${size.height}px`
        }
        const msgArr = [
            { key: 'a', values: [`![${altText}](本地图片)`] },
            { key: 'b', values: [this.getRandomCuteText()] }
        ]
        // 先发markdown，再发本地图片
        await replyMarkdownButton(e, msgArr, [
            [
                { text: '换个猫猫糕', callback: '换个猫猫糕', visited_label: '正在换猫猫糕' },
                { text: '今日猫猫糕', callback: '今日猫猫糕', visited_label: '正在获取今日猫猫糕' }
            ]
        ])
        await e.reply(segment.image(imgPath), true)
    }

    async TODAY_MMG(e) {
        let total
        try {
            total = await this.getTotalCount()
        } catch (err) {
            await e.reply(err.message || '获取猫猫糕数量失败，请稍后再试')
            return
        }
        const now = new Date().toLocaleDateString('zh-CN')
        const redisKey = `Yunzai:MMG:${e.user_id?.slice(11)}_mmg`
        let data = await redis.get(redisKey)
        let idx
        if (data) {
            data = JSON.parse(data)
            if (now === data.time) {
                idx = data.idx
            } else {
                idx = (new Date().getFullYear() * 10000 + (new Date().getMonth() + 1) * 100 + new Date().getDate()) % total + 1
            }
        } else {
            idx = (new Date().getFullYear() * 10000 + (new Date().getMonth() + 1) * 100 + new Date().getDate()) % total + 1
        }
        await redis.set(redisKey, JSON.stringify({ idx, time: now }))
        const imgUrl = await this.getMMGUrl(idx)
        if (!imgUrl) {
            await e.reply('未找到今日猫猫糕图片，请联系管理员补图')
            return
        }
        await this.sendMMGMarkdown(e, imgUrl)
    }

    async CHANGE_MMG(e) {
        let total
        try {
            total = await this.getTotalCount()
        } catch (err) {
            await e.reply(err.message || '获取猫猫糕数量失败，请稍后再试')
            return
        }
        const now = new Date().toLocaleDateString('zh-CN')
        const redisKey = `Yunzai:MMG:${e.user_id?.slice(11)}_mmg`
        // 随机新编号，避免和原编号重复
        let oldData = await redis.get(redisKey)
        let oldIdx = null
        if (oldData) {
            oldData = JSON.parse(oldData)
            if (now === oldData.time) {
                oldIdx = oldData.idx
            }
        }
        let idx, tryCount = 0
        do {
            idx = Math.floor(Math.random() * total) + 1
            tryCount++
        } while (idx === oldIdx && tryCount < 10)
        await redis.set(redisKey, JSON.stringify({ idx, time: now }))
        const imgUrl = await this.getMMGUrl(idx)
        if (!imgUrl) {
            await e.reply('未找到猫猫糕图片，请联系管理员补图')
            return
        }
        await this.sendMMGMarkdown(e, imgUrl)
    }
}
