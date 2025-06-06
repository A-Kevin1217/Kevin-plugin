import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import fetch from 'node-fetch'
import { promisify } from 'util'
import sizeOf from 'image-size'
import { isQQBot, replyMarkdownButton } from '../components/CommonReplyUtil.js'

const unlinkAsync = promisify(fs.unlink)

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
        this.cuteTexts = [
            '喵呜~今日份猫猫糕新鲜出炉，快来尝一口吧！',
            '猫猫糕来啦，软软糯糯，专属于你的小甜点~',
            '叮咚！猫猫糕快递送到，今天也要元气满满喵！',
            '今日猫猫糕已上线，吃一口好运一整天！',
            '小猫猫亲手做的猫猫糕，送给最可爱的你~',
            '猫猫糕到货，快抱走你的专属可爱吧！',
            '喵星人派送的猫猫糕，今天也要开心哦！',
            '猫猫糕：请签收你的快乐小点心~',
            '今日份猫猫糕，软萌上线，快来rua一口！',
            '猫猫糕已就位，愿你今天甜甜的，喵~'
        ]
        this.mmgCount = 435
    }

    async getTotalCount() {
        return this.mmgCount
    }

    async getMMGPath(idx) {
        const numStr = idx.toString().padStart(5, '0')
        const exts = ['jpg', 'png', 'gif', 'webp']
        for (let ext of exts) {
            const url = `https://vip.123pan.cn/1810660/data/%E7%8C%AB%E7%8C%AB%E7%B3%95/%E7%8C%AB%E7%8C%AB%E7%B3%95${numStr}.${ext}`
            try {
                const res = await fetch(url)
                const text = await res.text()
                if (!text.includes('文件不存在') && !text.includes('code":1023')) {
                    return url
                }
            } catch (e) {
                // 网络异常等，尝试下一个
                continue
            }
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

    async getImageSizeByDownload(url) {
        const tempPath = path.join('/tmp', `mmg_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(url)}`)
        const res = await fetch(url)
        if (!res.ok) return null
        const arrayBuffer = await res.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        fs.writeFileSync(tempPath, buffer)
        try {
            const dimensions = sizeOf(tempPath)
            return { width: dimensions.width, height: dimensions.height }
        } catch (e) {
            return null
        } finally {
            await unlinkAsync(tempPath)
        }
    }

    async sendMMG(e, imgPath, idx) {
        if (!isQQBot(e)) {
            await e.reply('请艾特六阶堂穗玉使用')
            return false
        }
        const cuteText = this.getRandomCuteText()
        let sizeStr = ''
        const size = await this.getImageSizeByDownload(imgPath)
        if (size && size.width && size.height) {
            sizeStr = ` #${size.width}px #${size.height}px`
        }

        let md = [
            { key: 'a', values: [`${idx}号猫猫糕前来报道啦～\r`] },
            { key: 'b', values: [`![猫猫糕${sizeStr}]`] },
            { key: 'c', values: [`(${imgPath})`] },
            { key: 'd', values: [`\r\r> ${cuteText}`] }
        ]
        let btn = [
            [
                { text: '换个猫猫糕', callback: '换个猫猫糕', clicked_text: '正在换猫猫糕' },
                { text: '今日猫猫糕', callback: '今日猫猫糕', clicked_text: '正在获取今日猫猫糕' }
            ],
            [
                { text: '反馈问题', link: 'https://txc.qq.com/products/637343', clicked_text: '正在跳转',style:4 }
            ]
        ]
        await replyMarkdownButton(e, md, btn);
        console.log(md)
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
        const imgPath = await this.getMMGPath(idx)
        if (!imgPath) {
            await e.reply('未找到今日猫猫糕图片，请联系管理员补图')
            return
        }
        await this.sendMMG(e, imgPath, idx)
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
        const imgPath = await this.getMMGPath(idx)
        if (!imgPath) {
            await e.reply('未找到猫猫糕图片，请联系管理员补图')
            return
        }
        await this.sendMMG(e, imgPath, idx)
    }
}
