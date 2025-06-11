import { Version } from '../index.js'
import Cfg from '../Cfg.js'

export default async function (path, params, cfg) {
  let { e } = cfg
  if (!e.runtime) {
    console.log('未找到e.runtime，请升级至最新版Yunzai')
  }
  const image = await e.runtime.render('Kevin-plugin', path, params, {
    retType: 'base64',
    beforeRender ({ data }) {
      let resPath = data.pluResPath
      const layoutPath = process.cwd() + '/plugins/Kevin-plugin/resources/common/layout/'
      return {
        ...data,
        _res_path: resPath,
        _layout_path: layoutPath,
        _tpl_path: process.cwd() + '/plugins/Kevin-plugin/resources/common/tpl/',
        defaultLayout: layoutPath + 'default.html',
        elemLayout: layoutPath + 'elem.html',
        sys: {
          scale: Cfg.scale(cfg.scale || 1),
          copyright: `Created By Yunzai-Bot<span class="version">${Version.yunzai}</span> & Kevin-plugin<span class="version">${Version.version}</span>`
        }
      }
    }
  })

  const message = [image]
  
  if (cfg.button) {
    message.push(cfg.button)
  }

  return e.reply(message)
}