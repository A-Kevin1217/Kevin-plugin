import fetch from 'node-fetch'
import { replyMarkdownButton } from '../components/CommonReplyUtil.js'

export class 猫猫糕 extends plugin{
    constructor(){
        super({
            name: '猫猫糕',
            dsc: '猫猫糕',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: /^(#|\/)?(今日猫猫糕)$/,
                    fnc: 'TODAY_MMG'
                },
                {
                    reg: /^(#|\/)?(换个猫猫糕)$/,
                    fnc: 'CHANGE_MMG'
                }
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
    }

    async getTotalCount() {
        // 获取猫猫糕数量
        const url = 'https://raw.githubusercontent.com/A-Kevin1217/orange-example/master/json/%E7%8C%AB%E7%8C%AB%E7%B3%95%E6%95%B0%E9%87%8F.json'
        const res = await fetch(url)
        if (!res.ok) throw new Error('获取猫猫糕数量失败')
        const data = await res.json()
        if (!data['猫猫糕数量']) throw new Error('猫猫糕数量字段缺失')
        return data['猫猫糕数量']
    }

    async getMMGUrl(idx) {
        const numStr = idx.toString().padStart(5, '0')
        const exts = ['jpg', 'png', 'gif']
        for (let ext of exts) {
            const fileName = `猫猫糕${numStr}.${ext}`
            const url = `https://raw.githubusercontent.com/A-Kevin1217/orange-example/master/images/%E7%8C%AB%E7%8C%AB%E7%B3%95/${encodeURIComponent(fileName)}`
            try {
                const res = await fetch(url, { method: 'HEAD' })
                if (res.ok) {
                    return url
                }
            } catch (e) {}
        }
        return ''
    }

    getRandomCuteText() {
        const arr = this.cuteTexts
        return arr[Math.floor(Math.random() * arr.length)]
    }

    async sendMMGMarkdown(e, imgUrl) {
        const msg = [
            `![猫猫糕](${imgUrl})`,
            `\r${this.getRandomCuteText()}`
        ].join('')
        await replyMarkdownButton(e, [
            { key: 'a', values: [msg] }
        ], [
            [
                { text: '换个猫猫糕', callback: '换个猫猫糕', visited_label: '正在换猫猫糕' },
                { text: '今日猫猫糕', callback: '今日猫猫糕', visited_label: '正在获取今日猫猫糕' }
            ]
        ])
    }

    async TODAY_MMG(e){
        let total
        try {
            total = await this.getTotalCount()
        } catch (err) {
            await e.reply('获取猫猫糕数量失败，请稍后再试')
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

    async CHANGE_MMG(e){
        let total
        try {
            total = await this.getTotalCount()
        } catch (err) {
            await e.reply('获取猫猫糕数量失败，请稍后再试')
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