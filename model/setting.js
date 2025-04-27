import YAML from 'yaml'
import chokidar from 'chokidar'
import fs from 'node:fs'
import { _path } from "./path.js";
import path from 'path';
import lodash from 'lodash';
import YamlReader from './YamlReader.js'

class Setting {
  constructor () {
    /** 默认设置 */
    this.defPath = `${_path}/plugins/Kevin-plugin/defSet/`
    this.defSet = {}

    /** 用户设置 */
    this.configPath = `${_path}/plugins/Kevin-plugin/config/`
    this.config = {}

    this.dataPath = `${_path}/plugins/Kevin-plugin/data/`
    this.data = {}

    /** 监听文件 */
    this.watcher = { config: {}, defSet: {} }

    // ====== 以下为锅巴配置专用方法 ======
    const configYamlPath = path.join(_path, 'plugins/Kevin-plugin/config/config.yaml');
    const broadcastJsonPath = path.join(_path, 'plugins/Kevin-plugin/config/broadcast_data.json');

    /**
     * 获取锅巴配置数据，自动将平铺字段包进 config 对象，使用 YamlReader 保留注释
     */
    this.getConfigData = function () {
      let config = {};
      if (fs.existsSync(configYamlPath)) {
        const y = new YamlReader(configYamlPath)
        config = y.jsonData || {};
      }
      // 需要平铺字段名（只保留这些不包进config）
      const reserved = ['plugin_version', 'log_level', 'data_dir', 'enable_demon_roulette'];
      // 自动包裹
      let configObj = {};
      for (const [k, v] of Object.entries(config)) {
        if (!reserved.includes(k)) configObj[k] = v;
      }
      let result = { ...lodash.pick(config, reserved), config: configObj };
      // group_map 对象转数组
      if (result.config.group_map && typeof result.config.group_map === 'object' && !Array.isArray(result.config.group_map)) {
        result.config.group_map = Object.entries(result.config.group_map).map(([group_id, group_name]) => ({
          group_id,
          group_name
        }));
      }
      // 读取 broadcast_data.json
      if (fs.existsSync(broadcastJsonPath)) {
        const broadcast = JSON.parse(fs.readFileSync(broadcastJsonPath, 'utf8')) || {};
        if (broadcast.destinationGroupIds && Array.isArray(broadcast.destinationGroupIds)) {
          broadcast.destinationGroupIds = broadcast.destinationGroupIds.map(id => ({ group_id: id }));
        }
        if (broadcast.bloggers && Array.isArray(broadcast.bloggers)) {
          broadcast.bloggers = broadcast.bloggers.map(qq => ({ qq }));
        }
        if (broadcast.admins && Array.isArray(broadcast.admins)) {
          broadcast.admins = broadcast.admins.map(qq => ({ qq }));
        }
        result.broadcast = broadcast;
      }
      return result;
    }

    /**
     * 保存锅巴配置数据，自动将 config 字段拆分为平铺，使用 YamlReader 保留注释
     */
    this.setConfigData = function (data, { Result }) {
      let config = JSON.parse(JSON.stringify(data));
      let broadcast = config.broadcast || {};
      // 确保 broadcast 字段不会写入 config.yaml
      delete config.broadcast;

      // 保存 config.xxx 中的有效字段
      const validConfigFields = {};
      Object.keys(config).forEach(key => {
        if (key.startsWith('config.')) {
          const realKey = key.replace('config.', '');
          validConfigFields[realKey] = config[key];
        }
      });

      // 彻底过滤所有 config.xxx 和 broadcast.xxx 字段
      Object.keys(config).forEach(key => {
        if (/^(config|broadcast)\./.test(key)) {
          delete config[key];
        }
      });

      // group_map 数组转对象
      if (config.config && Array.isArray(config.config.group_map)) {
        config.config.group_map = Object.fromEntries(
          config.config.group_map.map(item => [item.group_id, item.group_name])
        );
      }

      // 合并有效的配置字段
      config = {
        ...config,
        ...(config.config || {}),
        ...validConfigFields
      };
      delete config.config;

      // 最后再检查一遍，确保没有 config.xxx 和 broadcast.xxx
      Object.keys(config).forEach(key => {
        if (/^(config|broadcast)\./.test(key)) {
          delete config[key];
        }
      });

      // 类型修正
      if (!Array.isArray(config.group_whitelist)) config.group_whitelist = [];
      if (!Array.isArray(config.member_whitelist)) config.member_whitelist = [];
      if (typeof config.group_map !== 'object' || config.group_map === null || Array.isArray(config.group_map)) config.group_map = {};
      // 确保 audit_group_mode 有值
      if (!config.audit_group_mode) config.audit_group_mode = 'group_map';

      // 用 YamlReader 写入，保留注释
      const y = new YamlReader(configYamlPath)
      y.setData(config)

      // 多群广播相关：对象数组转纯数组
      if (broadcast.destinationGroupIds && Array.isArray(broadcast.destinationGroupIds)) {
        broadcast.destinationGroupIds = broadcast.destinationGroupIds.map(item => Number(item.group_id));
      }
      if (broadcast.bloggers && Array.isArray(broadcast.bloggers)) {
        broadcast.bloggers = broadcast.bloggers.map(item => Number(item.qq));
      }
      if (broadcast.admins && Array.isArray(broadcast.admins)) {
        broadcast.admins = broadcast.admins.map(item => Number(item.qq));
      }
      // 只在 data.broadcast 存在且有内容时才写入 broadcast_data.json
      if (data.broadcast !== undefined && Object.keys(broadcast).length > 0) {
        try {
          fs.writeFileSync(broadcastJsonPath, JSON.stringify(broadcast, null, 2), 'utf8');
        } catch (e) {
          return Result.err('保存broadcast_data.json失败: ' + e.message);
        }
      }
      return Result.ok({}, '保存成功~');
    }
  }

  // 配置对象化 用于锅巴插件界面填充
  merge () {
    let sets = {}
    let appsConfig = fs.readdirSync(this.defPath).filter(file => file.endsWith(".yaml"));
    for (let appConfig of appsConfig) {
      // 依次将每个文本填入键
      let filename = appConfig.replace(/.yaml/g, '').trim()
      sets[filename] = this.getConfig(filename)
    }
    return sets
  }

  // 配置对象分析 用于锅巴插件界面设置
  analysis(config) {
    for (let key of Object.keys(config)){
      this.setConfig(key, config[key])
    }
  }

  // 获取对应模块数据文件
  getData (path, filename) {
    path = `${this.dataPath}${path}/`
    try {
      if (!fs.existsSync(`${path}${filename}.yaml`)){ return false}
      return YAML.parse(fs.readFileSync(`${path}${filename}.yaml`, 'utf8'))
    } catch (error) {
      logger.error(`[${filename}] 读取失败 ${error}`)
      return false
    }
  }

  // 写入对应模块数据文件
  setData (path, filename, data) {
    path = `${this.dataPath}${path}/`
    try {
      if (!fs.existsSync(path)){
        // 递归创建目录
        fs.mkdirSync(path, { recursive: true });
      }
      fs.writeFileSync(`${path}${filename}.yaml`, YAML.stringify(data),'utf8')
    } catch (error) {
      logger.error(`[${filename}] 写入失败 ${error}`)
      return false
    }
  }

  // 获取对应模块默认配置
  getdefSet (app) {
    return this.getYaml(app, 'defSet')
  }

  // 获取对应模块用户配置
  getConfig (app) {
    return { ...this.getdefSet(app), ...this.getYaml(app, 'config') }
  }

  // 设置对应模块用户配置
  setConfig (app, Object) {
    return this.setYaml(app, 'config', { ...this.getdefSet(app), ...Object})
  }

  // 将对象写入YAML文件
  setYaml (app, type, Object){
    let file = this.getFilePath(app, type)
    try {
      fs.writeFileSync(file, YAML.stringify(Object),'utf8')
    } catch (error) {
      logger.error(`[${app}] 写入失败 ${error}`)
      return false
    }
  }

  // 读取YAML文件 返回对象
  getYaml (app, type) {
    let file = this.getFilePath(app, type)
    if (this[type][app]) return this[type][app]

    try {
      this[type][app] = YAML.parse(fs.readFileSync(file, 'utf8'))
    } catch (error) {
      logger.error(`[${app}] 格式错误 ${error}`)
      return false
    }
    this.watch(file, app, type)
    return this[type][app]
  }

  // 获取YAML文件目录
  getFilePath (app, type) {
    if (type === 'defSet') return `${this.defPath}${app}.yaml`
    else {
      try {
        if (!fs.existsSync(`${this.configPath}${app}.yaml`)) {
          fs.copyFileSync(`${this.defPath}${app}.yaml`, `${this.configPath}${app}.yaml`)
        }
      } catch (error) {
        logger.error(`拓展插件缺失默认文件[${app}]${error}`)
      }
      return `${this.configPath}${app}.yaml`
    }
  }


  // 监听配置文件
  watch (file, app, type = 'defSet') {
    if (this.watcher[type][app]) return

    const watcher = chokidar.watch(file)
    watcher.on('change', path => {
      delete this[type][app]
      logger.mark(`[拓展插件][修改配置文件][${type}][${app}]`)
      if (this[`change_${app}`]) {
        this[`change_${app}`]()
      }
    })
    this.watcher[type][app] = watcher
  }
}

export default new Setting()
