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

  async manualCheck(e) {
    if (!e.isMaster) {
      await this.reply('只有主人才能执行此命令');
      return false;
    }

    await this.reply('开始初始化群成员数据并检测白名单群的重复加群情况，请稍候...')

    // 初始化所有群的成员数据
    await initAllGroupMembers(e.bot);

    let memberGroups = new Map();
    let duplicateMembers = [];

    // 将机器人自身添加到白名单
    const botId = this.e.bot.uin.toString();
    if (!member_whitelist.includes(Number(botId))) {
      member_whitelist.push(Number(botId));
    }

    for (const [groupId, groupName] of Object.entries(group_map)) {
      const members = loadGroupMembers(groupId);
      for (const memberId of members) {
        if (!member_whitelist.includes(Number(memberId))) {
          if (!memberGroups.has(memberId)) {
            memberGroups.set(memberId, []);
          }
          memberGroups.get(memberId).push({id: groupId, name: groupName});
        }
      }
    }

    for (const [memberId, groups] of memberGroups) {
      if (groups.length > 1) {
        duplicateMembers.push({
          userId: memberId,
          groups: groups
        });
      }
    }

    if (duplicateMembers.length > 0) {
      let messages = [`检测到 ${duplicateMembers.length} 名成员重复加群：`];
      for (const member of duplicateMembers) {
        let memberInfo = await this.e.bot.getStrangerInfo(member.userId);
        let nickname = memberInfo ? memberInfo.nickname : '未知昵称';
        let groupList = member.groups.map(g => `${g.name}(${g.id})`).join('\n');
        messages.push([
          `QQ：${member.userId}`,
          `昵称：${nickname}`,
          `加入的群：\n${groupList}`
        ].join('\n'));
      }
      await this.reply(await common.makeForwardMsg(e, [`检测到 ${duplicateMembers.length} 名成员重复加群：`, ...messages.slice(1)], '重复加群检测结果'));
    } else {
      await this.reply('未检测到重复加群的成员。');
    }

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
