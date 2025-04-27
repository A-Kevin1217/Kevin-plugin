import plugin from "../../../lib/plugins/plugin.js";
import fs from 'fs'
import { whitelist, loadGroupMembers, saveGroupMembers } from '../components/GroupMemberUtil.js'
import YAML from 'yaml'

// 存储群成员信息的文件夹路径
const groupDataFolder = './data/groupMembers'

// 确保文件夹存在
if (!fs.existsSync(groupDataFolder)) {
  fs.mkdirSync(groupDataFolder, { recursive: true })
}

// 统一读取config/config.yaml
const configPath = './plugins/Kevin-plugin/config/config.yaml'
let config = YAML.parse(fs.readFileSync(configPath, 'utf8'))
const group_map = config.group_map || {}
const member_whitelist = config.member_whitelist || []

// 替换onlyNotifyGroups为Object.keys(group_map).map(Number)
const onlyNotifyGroups = Object.keys(group_map).map(Number)

export class DuplicateJoinDetector extends plugin {
  constructor () {
    super({
      name: '光之子欢迎仪式&检测重复进群',
      dsc: '检测成员重复加入群聊',
      event: 'notice.group.increase',
      priority: -Infinity
    })
  }

  async accept (e) {
    if (!onlyNotifyGroups.includes(e.group_id)) return
    if (e.user_id == this.e.bot.uin) return

    const groupId = e.group_id
    const userId = e.user_id

    // 检查用户是否在白名单中（不需要检测的成员）
    if (member_whitelist.includes(userId)) {
      // 直接通过入群申请
      await this.e.bot.setGroupAddRequest(groupId, userId, 'approve')
      return
    }

    // 检查群是否在白名单中（需要检测的群）
    if (!Object.keys(group_map).includes(String(groupId))) return

    // 立即更新当前群的成员数据
    let members = loadGroupMembers(groupId)
    members.add(userId.toString())
    saveGroupMembers(groupId, members)

    // 检查用户在所有其他群的情况
    let duplicateGroups = [];
    for (const [otherGroupId, groupName] of Object.entries(group_map)) {
      if (otherGroupId !== String(groupId)) {
        const members = loadGroupMembers(otherGroupId)
        if (members.has(userId.toString())) {
          duplicateGroups.push({
            id: otherGroupId,
            name: groupName
          });
        }
      }
    }

    if (duplicateGroups.length > 0) {
      // 检测到重复加群，列出所有已加入的其他群
      let currentGroupName = group_map[String(groupId)];
      let groupList = duplicateGroups.map(g => `${g.name}(${g.id})`).join('\n');
      
      let msg = [
        `警告：检测到重复加入群聊！`,
        `当前加入的群：\n${currentGroupName}(${groupId})`,
        `已经加入的其他群：`,
        groupList,
        `\n请选择一个群去留，避免重复加群！`,
        `\n否则将由管理员手动清理`
      ].join('\n');

      // 发送警告消息
      await this.reply([
        segment.at(userId),
        msg
      ])

      // 同时通知审核群
      let auditMsg = [
        `检测到重复加群：`,
        `用户：${userId}`,
        `当前加入：${currentGroupName}(${groupId})`,
        `已加入的群：\n${groupList}`
      ].join('\n');
      await Bot.pickGroup(634644457).sendMsg(auditMsg);
    } else {
      // 发送欢迎消息
      const welcomeMsg = `加入光之子的聚集地！在和其他光之子把翼言欢前，请知悉以下群规，不然会收获退群飞机票一张
      1.尽量少讨论与光遇无关的内容，一定要讨论请注意言辞和程度
      2.请配合各位老师和管理们的工作，不要在线时固执己见干其他事情(如刷屏、玩机器人等)
      3.禁止讨论时/政、军/事、黄/赌/毒等敏感话题，一次警告两次踢出群处理
      4.非在校和工作时间不要潜水，管理会定时清理潜水群员
      更多群规内容请在群公告查看!

      进群之后记得一定要说一句话，不然一定会被清理！`

      // 新增提示信息
      const additionalMessage = `本群的头衔为自助头衔，头衔格式为:我要头衔xxx（头衔名）（不需要空格）
      头衔是自动的 直接发就好 不能超过六个字（头衔xian不是街jie）`;

      // 检查是否为第七个群
      if (groupId !== 640946244) {  // 640946244 是第七个群的 ID
        await this.reply(['欢迎',
          segment.at(userId),
          welcomeMsg
        ])
        await this.reply([
          additionalMessage
        ])
      } else {
        await this.reply(['欢迎',
          segment.at(userId),
          welcomeMsg
        ])
      }
    }
  }
}

export class outNotice extends plugin {
  constructor () {
    super({
      name: '光之子退群通知',
      dsc: 'xx退群了',
      event: 'notice.group.decrease'
    })

    /** 退群提示词 */
    this.tips = '退出聚集地了'
  }

  async accept () {
    if (!onlyNotifyGroups.includes(this.e.group_id)) return
    if (this.e.user_id == this.e.bot.uin) return

    const groupId = this.e.group_id
    const userId = this.e.user_id

    // 直接从JSON文件中删除退群成员，不需要重新初始化
    const members = loadGroupMembers(groupId)
    members.delete(userId.toString())
    saveGroupMembers(groupId, members)

    let name, msg
    if (this.e.member) {
      name = this.e.member.card || this.e.member.nickname
    }

    if (name) {
      msg = `${name}(${this.e.user_id}) ${this.tips}`
    } else {
      msg = `${this.e.user_id} ${this.tips}`
    }
    logger.mark(`[退出通知]${this.e.logText} ${msg}`)
    await this.reply(msg)
  }
}