import lodash from 'lodash'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const _path = process.cwd()
// 自动获取当前插件目录名
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PLUGIN_NAME = __dirname.split('/').slice(-2, -1)[0] || '小丞插件'

const getRoot = (root = '') => {
  if (root === 'root' || root === 'yunzai') {
    return `${_path}/`
  }
  if (!root) {
    return `${_path}/plugins/${PLUGIN_NAME}/`
  }
  return root
}

let Data = {
  // 递归创建目录
  createDir (path = '', root = '', includeFile = false) {
    root = getRoot(root)
    let pathList = path.split('/')
    let nowPath = root
    pathList.forEach((name, idx) => {
      name = name.trim()
      if (!includeFile && idx <= pathList.length - 1) {
        nowPath += name + '/'
        if (name) {
          if (!fs.existsSync(nowPath)) {
            fs.mkdirSync(nowPath, { recursive: true })
          }
        }
      }
    })
  },

  // 读取JSON文件
  readJSON (file = '', root = '') {
    root = getRoot(root)
    if (fs.existsSync(`${root}/${file}`)) {
      try {
        return JSON.parse(fs.readFileSync(`${root}/${file}`, 'utf8'))
      } catch (e) {
        console.log(e)
      }
    }
    return {}
  },

  // 写入JSON文件
  writeJSON (file, data, space = '\t', root = '') {
    Data.createDir(file, root, true)
    root = getRoot(root)
    delete data._res
    return fs.writeFileSync(`${root}/${file}`, JSON.stringify(data, null, space))
  },

  async getCacheJSON (key) {
    try {
      let txt = await redis.get(key)
      if (txt) {
        return JSON.parse(txt)
      }
    } catch (e) {
      console.log(e)
    }
    return {}
  },

  async setCacheJSON (key, data, EX = 3600 * 24 * 90) {
    await redis.set(key, JSON.stringify(data), { EX })
  },

  async importModule (file, root = '') {
    root = getRoot(root)
    if (!/\.js$/.test(file)) {
      file = file + '.js'
    }
    if (fs.existsSync(`${root}/${file}`)) {
      try {
        let data = await import(`file://${root}/${file}?t=${new Date() * 1}`)
        return data || {}
      } catch (e) {
        console.log(e)
      }
    }
    return {}
  },

  async importDefault (file, root) {
    let ret = await Data.importModule(file, root)
    return ret.default || {}
  },

  async import (name) {
    return await Data.importModule(`components/optional-lib/${name}.js`)
  },

  async importCfg (key) {
    let sysCfg = {}
    let diyCfg = {}
    
    try {
      sysCfg = await Data.importModule(`defSet/system/${key}_system.js`)
    } catch (e) {
      // 系统配置读取失败，记录错误但继续执行
      console.error(`defSet/system/${key}_system.js 读取失败`, e)
    }

    try {
      diyCfg = await Data.importModule(`config/${key}.js`)
    } catch (e) {
      // 用户配置读取失败，使用系统默认
      return sysCfg
    }

    if (diyCfg.isSys) {
      console.error(`小丞插件: config/${key}.js无效，已忽略`)
      console.error(`如需配置请复制config/${key}_default.js为config/${key}.js，请勿复制defSet/system下的系统文件`)
      return sysCfg
    }

    return { ...sysCfg, ...diyCfg }
  },

  // 获取对象指定字段
  getData (target, keyList = '', cfg = {}) {
    target = target || {}
    let defaultData = cfg.defaultData || {}
    let ret = {}
    if (typeof (keyList) === 'string') {
      keyList = keyList.split(',')
    }
    lodash.forEach(keyList, (keyCfg) => {
      let _keyCfg = keyCfg.split(':')
      let keyTo = _keyCfg[0].trim()
      let keyFrom = (_keyCfg[1] || _keyCfg[0]).trim()
      let keyRet = keyTo
      if (cfg.lowerFirstKey) {
        keyRet = lodash.lowerFirst(keyRet)
      }
      if (cfg.keyPrefix) {
        keyRet = cfg.keyPrefix + keyRet
      }
      ret[keyRet] = Data.getVal(target, keyFrom, defaultData[keyTo], cfg)
    })
    return ret
  },

  getVal (target, keyFrom, defaultValue) {
    return lodash.get(target, keyFrom, defaultValue)
  },

  // 异步池
  async asyncPool (poolLimit, array, iteratorFn) {
    const ret = []
    const executing = []
    for (const item of array) {
      const p = Promise.resolve().then(() => iteratorFn(item, array))
      ret.push(p)
      if (poolLimit <= array.length) {
        const e = p.then(() => executing.splice(executing.indexOf(e), 1))
        executing.push(e)
        if (executing.length >= poolLimit) {
          await Promise.race(executing)
        }
      }
    }
    return Promise.all(ret)
  },

  sleep (ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  },

  def () {
    for (let idx in arguments) {
      if (!lodash.isUndefined(arguments[idx])) {
        return arguments[idx]
      }
    }
  },

  eachStr: (arr, fn) => {
    if (lodash.isString(arr)) {
      arr = arr.replace(/\s*(;|；|、|，)\s*/, ',')
      arr = arr.split(',')
    } else if (lodash.isNumber(arr)) {
      arr = [arr.toString()]
    }
    lodash.forEach(arr, (str, idx) => {
      if (!lodash.isUndefined(str)) {
        fn(str.trim ? str.trim() : str, idx)
      }
    })
  },

  regRet (reg, txt, idx) {
    if (reg && txt) {
      let ret = reg.exec(txt)
      if (ret && ret[idx]) {
        return ret[idx]
      }
    }
    return false
  }
}

export default Data
