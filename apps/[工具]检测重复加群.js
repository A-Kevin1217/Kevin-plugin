import plugin from "../../../lib/plugins/plugin.js";
import fs from 'fs'
import path from 'path'
import common from '../../../lib/common/common.js'
import YAML from 'yaml'
import { whitelist, loadGroupMembers, saveGroupMembers } from '../components/GroupMemberUtil.js'

// 存储群成员信息的文件夹路径
const groupDataFolder = './data/groupMembers'

// 统一读取config/config.yaml
const configPath = './plugins/Kevin-plugin/config/config.yaml'
let config = YAML.parse(fs.readFileSync(configPath, 'utf8'))
const group_map = config.group_map || {}
const member_whitelist = config.member_whitelist || []

// 确保文件夹存在
if (!fs.existsSync(groupDataFolder)) {
  fs.mkdirSync(groupDataFolder, { recursive: true })
}

async function getGroupMembers(bot, groupId) {
  try {
    // 尝试不同的方法获取群成员列表
    if (Bot?.pickGroup) {
      // Yunzai-Bot v3
      const group = await Bot.pickGroup(Number(groupId))
      if (!group) {
        throw new Error('群组不存在')
      }
      const members = await group.getMemberList()
      
      // 调试输出
      console.log(`群 ${groupId} 成员数据:`, JSON.stringify(members).slice(0, 200))
      
      // 直接返回成员ID列表
      return members.map(String)
    }
    
    throw new Error('无法获取群成员列表，不支持的机器人API')
  } catch (error) {
    console.error(`获取群 ${groupId} 成员列表失败:`, error)
    throw error
  }
}

async function initAllGroupMembers(bot) {
  for (const [groupId, groupName] of Object.entries(group_map)) {
    try {
      const memberIds = new Set(await getGroupMembers(bot, groupId))
      saveGroupMembers(groupId, memberIds)
      console.log(`群 ${groupName}(${groupId}) 成员数据已初始化，共 ${memberIds.size} 人`)
    } catch (error) {
      console.log(`初始化群 ${groupName}(${groupId}) 成员数据失败: ${error.message}`)
    }
  }
}

export class DuplicateJoinDetector extends plugin {
  constructor () {
    super({
      name: '重复加群检测',
      dsc: '检测成员重复加入群聊',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: '^#?检测重复(加|进|入)群$',
          fnc: 'manualCheck',
          permission: 'master'
        },
        {
          reg: '^#?重新初始化群成员$',
          fnc: 'reinitialize',
          permission: 'master'
        }
      ]
    })
    this._initialized = false;
  }

  async init() {
    // 移除自动初始化逻辑
    return;
  }

  async getBot() {
    return Bot?.uin ? Bot : null
  }

  async initGroupMembers(bot, force = false, silent = true) {
    if (!bot) {
      if (!silent) console.log('Bot 对象不可用，无法初始化群成员数据');
      return;
    }
    if (!silent) console.log('开始初始化群成员数据...')
    for (const groupId of Object.keys(group_map)) {
      try {
        const memberIds = new Set(await getGroupMembers(bot, groupId))
        if (force || !fs.existsSync(path.join(groupDataFolder, `${groupId}.json`))) {
          saveGroupMembers(groupId, memberIds)
        }
        if (!silent) console.log(`群 ${group_map[groupId]}(${groupId}) 成员数据已更新，共 ${memberIds.size} 人`)
      } catch (error) {
        if (!silent) console.log(`获取群 ${group_map[groupId]}(${groupId}) 成员列表失败: ${error.message}`)
      }
    }
    if (!silent) console.log('群成员数据初始化完成')
    this._initialized = true;
  }

  async getAllGroupMembers() {
    const result = new Map();
    
    for (const [groupId, groupName] of Object.entries(group_map)) {
      try {
        const group = await this.e.bot.pickGroup(Number(groupId));
        const members = await group.getMemberMap();
        result.set(groupId, {
          name: groupName,
          members: Array.from(members.keys())
        });
      } catch (e) {
        logger.error(`获取群 ${groupId} 成员列表失败`, e);
      }
    }
    
    return result;
  }

  analyzeDuplicates(groupMembers) {
    const memberGroups = {};
    
    // 将机器人自身添加到白名单
    const botId = this.e.bot.uin.toString();
    if (!member_whitelist.includes(Number(botId))) {
      member_whitelist.push(Number(botId));
    }
    
    for (const [groupId, data] of groupMembers) {
      for (const memberId of data.members) {
        // 跳过白名单成员
        if (member_whitelist.includes(Number(memberId))) {
          continue;
        }
        
        if (!memberGroups[memberId]) {
          memberGroups[memberId] = [];
        }
        memberGroups[memberId].push({
          id: groupId,
          name: data.name
        });
      }
    }
    
    return memberGroups;
  }

  async manualCheck() {
    if (!this.e.isMaster) {
      await this.reply('只有主人才能执行此命令');
      return false;
    }

    await this.reply('开始检测重复加群情况，请稍候...');
    
    // 获取所有群的成员数据
    const groupMembers = await this.getAllGroupMembers();
    
    // 分析重复加群情况
    const duplicates = this.analyzeDuplicates(groupMembers);
    
    // 生成报告
    let report = ['重复加群检测结果：\n'];
    
    for (const [qq, groups] of Object.entries(duplicates)) {
      if (groups.length > 1) {
        let userInfo;
        try {
          userInfo = await this.e.bot.pickUser(Number(qq)).getSimpleInfo();
        } catch (e) {
          userInfo = { nickname: qq };
        }
        const groupNames = groups.map(g => g.name).join('、');
        report.push(`${userInfo.nickname}(${qq}) 加入了 ${groups.length} 个群：${groupNames}`);
      }
    }
    
    if (report.length === 1) {
      report.push('未发现重复加群情况');
    }
    
    // 使用 makeForwardMsg 发送
    await this.reply(await common.makeForwardMsg(this.e, report, '重复加群检测结果'));
    return true;
  }

  async reinitialize(e) {
    if (!e.isMaster) {
      await this.reply('只有主人才能执行此命令');
      return false;
    }
    await this.initGroupMembers(e.bot, true, false);
    await this.reply('群成员数据已重新初始化');
    return true;
  }
}
