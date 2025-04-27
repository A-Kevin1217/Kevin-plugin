import { Data, Version } from './components/index.js'
import fs from 'node:fs'
import chalk from 'chalk'

if (!global.segment) {
  global.segment = (await import("oicq")).segment
}

if (!global.core) {
  try {
    global.core = (await import("oicq")).core
  } catch (err) { }
}

if (!global.uploadRecord) {
  try {
    global.uploadRecord = (await import("./model/uploadRecord.js")).default
  } catch (err) {
    global.uploadRecord = segment.record
  }
}

let ret = []

logger.info(chalk.rgb(120, 255, 108)(`---------=.=---------`))
logger.info(chalk.rgb(120, 255, 108)(`小丞插件 ${Version.version} 载入成功`))
logger.info(chalk.rgb(120, 255, 108)(`作者：小丞`))
logger.info(chalk.rgb(120, 255, 108)(`---------------------`));

const appsDir = './plugins/Kevin-plugin/apps'
const files = fs
  .readdirSync(appsDir)
  .filter((file) => file.endsWith('.js'))

files.forEach((file) => {
  ret.push(import(`./apps/${file}`))
})

ret = await Promise.allSettled(ret)

let apps = {}
for (let i in files) {
  let name = files[i].replace('.js', '')
  if (ret[i].status != 'fulfilled') {
    logger.error(`载入插件错误：${logger.red(name)}`)
    logger.error(ret[i].reason)
    continue
  }
  apps[name] = ret[i].value[Object.keys(ret[i].value)[0]]
}
export { apps }
