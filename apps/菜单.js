import lodash from 'lodash'
import fs from 'fs'
import { Common } from '../components/index.js'
import Theme from './help/theme.js'

const _path = process.cwd()
const helpPath = `${_path}/config`

export class Help extends plugin {
  constructor() {
    super({
      name: '小丞插件帮助',
      dsc: '小丞插件帮助',
      event: 'message',
      priority: 1146,
      rule: [
        {
          reg: "^#?(小丞|丞|帮助|菜单|help|说明|功能|指令|使用说明)$",
          fnc: 'help'
        },
        {
          reg: "^#?小丞版本$",
          fnc: 'versionInfo'
        }
      ]
    })
  }

  async help(e) {
    // 只响应小丞相关关键词
    if (!/(小丞|丞|帮助|菜单|help|说明|功能|指令|使用说明)/.test(e.msg)) {
      return false
    }

    let help = {}
    // 优先读取config/help.js自定义帮助
    if (fs.existsSync(`${helpPath}/help.js`)) {
      help = await import(`file://${helpPath}/help.js?version=${new Date().getTime()}`)
    } else {
      // 否则读取默认帮助
      help = await import(`file://${helpPath}/help_default.js?version=${new Date().getTime()}`)
    }

    let helpList = help.helpList || []
    let helpCfg = help.helpCfg || {}

    let helpGroup = []
    lodash.forEach(helpList, (group) => {
      if (group.auth && group.auth === 'master' && !e.isMaster) {
        return true
      }
      lodash.forEach(group.list, (item) => {
        let icon = item.icon * 1
        if (!icon) {
          item.css = 'display:none'
        } else {
          let x = (icon - 1) % 10
          let y = (icon - x - 1) / 10
          item.css = `background-position:-${x * 50}px -${y * 50}px`
        }
      })
      helpGroup.push(group)
    })
    let themeData = await Theme.getThemeData(helpCfg || {}, {})
    return await Common.render('help/index', {
      helpCfg,
      helpGroup,
      ...themeData,
      element: 'default'
    }, { e, scale: 1.2 })
  }

  async versionInfo(e) {
    // 版本信息可根据实际情况自定义
    return await Common.render('help/version-info', {
      currentVersion: '1.0',
      changelogs: [
        '小丞插件 1.0 发布：多群管理、自动审核、吃喝推荐、点歌、娱乐等功能上线'
      ],
      elem: 'dendro'
    }, { e, scale: 1.2 })
  }
}
