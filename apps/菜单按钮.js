// 通用回复函数
async function sendMenu(e, key) {
  // 热更新 menuConfig
  delete require.cache[require.resolve('../config/menuConfig.js')]
  const menuConfig = require('../config/menuConfig.js')
  const menu = menuConfig[key]
  if (!menu) return false
  const platform = e.bot?.adapter?.name || e.platform || '未知'
  if (platform !== 'QQBot') return false
  await e.reply([
    segment.markdown({
      custom_template_id: "102059511_1713948595",
      params: [
        { key: 'a', values: ['#'] },
        { key: 'b', values: [menu.title] },
        { key: 'c', values: [`\r> ${menu.desc}`] },
        ...(menu.extend ? [{ key: 'd', values: [menu.extend] }] : [])
      ]
    }),
    menu.buttons.length > 0 ? segment.button(...menu.buttons) : ''
  ])
  return true
}

export class MenuButton extends plugin {
    constructor() {
        super({
            name: '菜单按钮',
            dsc: '菜单按钮',
            event: 'message',
            priority: 1,
            rule: [
                { reg: /^[#\/]?(菜单)$/, fnc: 'menuButton' },
                { reg: /^[#\/]?(米哈游菜单)$/, fnc: '米哈游菜单' },
                { reg: /^[#\/]?(TGC菜单)$/, fnc: 'TGC菜单' },
                { reg: /^[#\/]?(今日吃喝)$/, fnc: '今日吃喝' },
                { reg: /^[#\/]?(小游戏)$/, fnc: '小游戏' },
                { reg: /^[#\/]?(光遇功能)$/, fnc: '光遇功能' },
                { reg: /^[#\/]?(原神功能)$/, fnc: '原神功能' },
                { reg: /^[#\/]?(星铁功能)$/, fnc: '星铁功能' },
                { reg: /^[#\/]?(更多原神指令)$/, fnc: '更多原神指令' },
                { reg: /^[#\/]?(更多星铁指令)$/, fnc: '更多星铁指令' },
                { reg: /^[#\/]?(绝区零功能)$/, fnc: '绝区零功能' },
                { reg: /^[#\/]?(更多绝区零功能)$/, fnc: '更多绝区零功能' }
            ]
        })
    }

    async menuButton(e) { return sendMenu(e, 'menuButton') }
    async 米哈游菜单(e) { return sendMenu(e, '米哈游菜单') }
    async TGC菜单(e) { return sendMenu(e, 'TGC菜单') }
    async 光遇功能(e) { return sendMenu(e, '光遇功能') }
    async BEFORE功能(e) { return sendMenu(e, 'BEFORE功能') }
    async 原神功能(e) { return sendMenu(e, '原神功能') }
    async 更多原神指令(e) { return sendMenu(e, '更多原神指令') }
    async 星铁功能(e) { return sendMenu(e, '星铁功能') }
    async 更多星铁指令(e) { return sendMenu(e, '更多星铁指令') }
    async 小游戏(e) { return sendMenu(e, '小游戏') }
    async 今日吃喝(e) { return sendMenu(e, '今日吃喝') }
    async 绝区零功能(e) { return sendMenu(e, '绝区零功能') }
    async 更多绝区零功能(e) { return sendMenu(e, '更多绝区零功能') }
}