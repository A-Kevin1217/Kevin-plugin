import plugin from "../../../lib/plugins/plugin.js";
import { isQQBot, replyMarkdownButton } from '../components/CommonReplyUtil.js'

export class example extends plugin {
  constructor() {
    super({
      name: 'ys-今日人品',
      dsc: 'ys-今日人品',
      event: 'message',
      priority: 5000,
      rule: [{
        reg: '^#?(今日人品|jrrp)$', fnc: 'jrrp'
      }]
    })
  }

  async jrrp(e) {
    if (!isQQBot(e)) {
      await e.reply('请艾特橙子BOT使用')
      return false
    }
    let today = new Date()
    let past = today.getDate() - 1
    today.setDate(past)
    today.setHours(0, 0, 0, 0)
    let seed = (today.getTime() + e.user_id?.slice(11)).toString()
    let randomNumber = this.hashCode(seed)
    let res = Math.abs(this.hashCode(Math.abs(randomNumber).toString())) % 101
    let comment = this.generateComment(res)
    return replyMarkdownButton(e, [
      { key: 'a', values: [`<@${e.user_id?.slice(11)}>\r`] },
      { key: 'b', values: ['#'] },
      { key: 'c', values: [' 今日人品'] },
      { key: 'd', values: [`\r> (据说人品好，一整天都会幸运)\r\r***\r你今天的人品是：${comment}`] },
    ], [
      [{ text: '看看我的', callback: '今日人品', clicked_text: '正在获取今日人品' },
      { text: '看看运势', callback: '今日运势', clicked_text: '正在获取今日运势' },
      { text: '菜单', callback: '菜单', clicked_text: '正在获取菜单' }]
    ])
  }

  generateComment(num) {
    let comment = ''
    Bot.logger.info(`今日人品：${num}, ${typeof num}`)
    switch (true) {
      case (num === 0):
        comment = `${num}！！！非到极致也是欧！`
        break
      case (num === 100):
        comment = `${num}！${num}！${num}！！！难道这就是传说中的欧皇吗 d(ŐдŐ๑)`
        break
      case (num === 50):
        comment = `${num}！五五开......`
        break
      case (num >= 80):
        comment = `${num}，好评如潮！`
        break
      case (num >= 60):
        comment = `${num}，今天运气不错呢！`
        break
      case (num >= 50):
        comment = `${num}，不错呦！`
        break
      case (num >= 20):
        comment = `${num}\r没关系，明天会更好哒 ◝(⑅•ᴗ•⑅)◜..°♡`
        break
      case (num >= 10):
        comment = `${num}？！不会吧......`
        break
      case (num >= 1):
        comment = `${num}......（是百分制哦）`
        break
      default:
        comment = 'Invalid number'
    }
    return comment
  }

  hashCode(str) {
    let hash = 0
    if (str.length === 0) return hash
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash &= hash
    }
    return hash
  }
}
