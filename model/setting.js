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
      const reserved = ['plugin_version', 'log_level', 'data_dir', 'enable_demon_roulette'];
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
      // --- 白名单同步 ---
      // 成员白名单同步到 groupAdmin.whiteQQ
      if (Array.isArray(result.config.member_whitelist)) {
        result.groupAdmin = result.groupAdmin || {};
        result.groupAdmin.whiteQQ = result.config.member_whitelist;
      }
      // 群白名单同步（GSelectGroup 需要数组）
      if (Array.isArray(result.config.group_whitelist)) {
        result.config.group_whitelist = result.config.group_whitelist;
      }
      // --- end ---
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
      // --- 白名单同步 ---
      // groupAdmin.whiteQQ -> member_whitelist
      if (data.groupAdmin && Array.isArray(data.groupAdmin.whiteQQ)) {
        if (!config.config) config.config = {};
        config.config.member_whitelist = data.groupAdmin.whiteQQ;
      }
      // config.group_whitelist -> group_whitelist
      if (data.config && Array.isArray(data.config.group_whitelist)) {
        if (!config.config) config.config = {};
        config.config.group_whitelist = data.config.group_whitelist;
      }
      // --- end ---
      // 自动拆分 config 字段
      if (config.config) {
        // 先过滤掉 config 对象里的 config.xxx 和 broadcast.xxx
        const configObj = config.config;
        Object.keys(configObj).forEach(key => {
          if (/^(config|broadcast)\./.test(key)) {
            delete configObj[key];
          }
        });
        config = { ...config, ...configObj };
        delete config.config;
      }
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
      fs.writeFileSync(`${path}${filename}.yaml`, YAML.stringify(data), 'utf8');
    } catch (error) {
      logger.error(`[${filename}] 写入失败 ${error}`)
      return false
    }
  }

  getdefSet (filename) {
    return this.defSet[filename] || {}
  }

  getConfig (filename) {
    return this.config[filename] || {}
  }

  setConfig (filename, config) {
    this.config[filename] = config
  }

  setYaml (filename, yaml) {
    this.defSet[filename] = yaml
  }

  getYaml (filename) {
    return this.defSet[filename] || {}
  }

  getFilePath (filename) {
    return `${this.defPath}${filename}.yaml`
  }

  watch (filename) {
    if (!this.watcher.defSet[filename]) {
      this.watcher.defSet[filename] = chokidar.watch(this.getFilePath(filename))
      this.watcher.defSet[filename].on('all', () => {
        this.defSet[filename] = this.getYaml(filename)
      })
    }
  }
}

export default new Setting()