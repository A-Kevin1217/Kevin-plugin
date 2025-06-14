import plugin from "../../../lib/plugins/plugin.js";;
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

// 添加黑名单文件路径
const blacklistPath = path.join(process.cwd(), 'plugins/example/data/blacklist.json');

// 统一读取config/config.yaml
const configPath = './plugins/Kevin-plugin/config/config.yaml'
let config = YAML.parse(fs.readFileSync(configPath, 'utf8'))
const group_map = config.group_map || {}
const group_whitelist = config.group_whitelist || []
const member_whitelist = config.member_whitelist || []
const wenti = config.wenti || ''
const ans = config.answer_list || []
const exactMatch = config.exact_match || false
const enableLevelCheck = config.level_check || false
const auditGroupMode = config.audit_group_mode || 'group_map';

// 根据模式获取需要审核的群列表
export function getAuditGroupList() {
  if (auditGroupMode === 'group_map') {
    return Object.keys(group_map);
  } else if (auditGroupMode === 'group_whitelist') {
    return group_whitelist.map(String);
  }
  return [];
}

// 检查是否重复加群
async function checkDuplicateJoin(groupId, userId) {
  const groupList = getAuditGroupList();
  if (!groupList.includes(String(groupId))) return { isDuplicate: false };
  if (member_whitelist.includes(Number(userId))) return { isDuplicate: false };

  for (const otherGroupId of groupList) {
    if (otherGroupId !== String(groupId)) {
      try {
        if (!Bot) continue;  // 检查 Bot 是否存在
        const group = Bot.pickGroup(Number(otherGroupId));
        if (!group) continue;  // 检查群组是否存在
        const members = await group.getMemberMap();
        if (members.has(userId)) {
          return {
            isDuplicate: true,
            existingGroup: group_map[otherGroupId] || otherGroupId
          };
        }
      } catch (error) {
        console.log(`检查群 ${otherGroupId} 失败: ${error.message}`);
      }
    }
  }
  return { isDuplicate: false };
}

async function getUserAvatar(user_id) {
  return segment.image(`https://q2.qlogo.cn/headimg_dl?dst_uin=${user_id}&spec=100`);
}

export class example2 extends plugin {
  constructor() {
    super({
      name: '加群申请处理',
      dsc: '',
      event: 'request.group.add',
      priority: -Infinity
    });
  }

  // 读取黑名单
  getBlacklist() {
    try {
      if (!fs.existsSync(blacklistPath)) {
        fs.writeFileSync(blacklistPath, JSON.stringify({ blacklist: [] }));
        return [];
      }
      const data = JSON.parse(fs.readFileSync(blacklistPath, 'utf8'));
      return data.blacklist || [];
    } catch (error) {
      console.error('读取黑名单失败:', error);
      return [];
    }
  }

  async accept(e) {
    let messages = [];
    const groupList = getAuditGroupList();
    // 判断当前群是否需要审核
    if (!groupList.includes(String(e.group_id))) {
      // 不需要审核，直接通过
      e.approve(true);
      return true;
    }
    const groupName = group_map[e.group_id] || e.group_id;
    
    try {
      const userInfo = await e.bot.pickUser(e.user_id).getInfo();
      const userName = userInfo?.nickname || String(e.user_id);
    
      // 检查是否在不需要检测的成员列表中
      if (member_whitelist.includes(Number(e.user_id))) {
        messages.push([
          `群聊：${groupName}`,
          segment.image(`https://q2.qlogo.cn/headimg_dl?dst_uin=${e.user_id}&spec=100`),
          `用户：${userName}(${e.user_id})\n该用户在白名单中，已自动同意申请`
        ]);
        e.approve(true);
        if (e.bot) {
          const auditGroup = e.bot.pickGroup(634644457);
          if (auditGroup) {
            await auditGroup.sendMsg(await makeForwardMsg(e, messages, '✅ 新成员加群审核通过'));
          }
        }
        return true;
      }

      // 新增代码：获取好友信息
      const selectedFriend = await Bot.pickFriend(e.user_id);
      if (!selectedFriend) {
        await e.reply('未找到该好友。');
        return;
      }

      const friendInfo = await this.e.friend.getInfo(selectedFriend);
      if (!friendInfo) {
        await e.reply('未找到该好友的信息。');
        return;
      }

      const qqLevel = friendInfo.qqLevel;
      const isHideQQLevel = friendInfo.isHideQQLevel;

      // 处理QQ等级显示
      let userLevel = isHideQQLevel === 1 ? '隐藏' : qqLevel;

      const duplicateCheck = await checkDuplicateJoin(e.group_id, e.user_id);
      if (duplicateCheck.isDuplicate) {
        messages.push([
          `群聊：${groupName}`,
          segment.image(`https://q2.qlogo.cn/headimg_dl?dst_uin=${e.user_id}&spec=100`),
          `用户：${userName}(${e.user_id})\n该用户已加入【${duplicateCheck.existingGroup}】，请管理员手动谨慎审核！`
        ]);
        e.approve(false);
        await Bot.pickGroup(634644457).sendMsg(await makeForwardMsg(e, messages, '⚠️ 重复加群警告！请管理员注意'));
        return false;
      }

      if (groupList.includes(String(e.group_id))) {
        const blacklist = this.getBlacklist();
        if (blacklist.includes(`${e.user_id}`)) {
          messages.push([
            `群聊：${groupName}`,
            segment.image(`https://q2.qlogo.cn/headimg_dl?dst_uin=${e.user_id}&spec=100`),
            `用户：${userName}(${e.user_id})\n该用户在黑名单中，已自动拒绝申请`
          ]);
          e.approve(false);
          await Bot.pickGroup(634644457).sendMsg(await makeForwardMsg(e, messages, '⛔ 黑名单用户加群提醒'));
          return false;
        }

        messages.push([
          `群聊：${groupName}`,
          segment.image(`https://q2.qlogo.cn/headimg_dl?dst_uin=${e.user_id}&spec=100`),
          `用户：${userName}(${e.user_id})\nQQ等级：${userLevel}\n${e.comment}`
        ]);

        // 新增代码：如果QQ等级被隐藏，提醒管理员处理
        if (isHideQQLevel === 1) {
          if (enableLevelCheck) {
            messages.push(`用户等级被隐藏，请管理员手动处理该用户的加群申请。`);
            await Bot.pickGroup(634644457).sendMsg(await makeForwardMsg(e, messages, '⚠️ 用户等级隐藏提醒'));
            return false;
          }
          messages.push(`注意：用户等级已隐藏`);
        }

        let levelPass = true;  // 默认等级验证通过
        if (enableLevelCheck) {  // 只在启用等级验证时检查
          levelPass = userLevel !== '隐藏' && userLevel >= 16;
          if (!levelPass) {
            messages.push(`用户等级不足，未通过等级验证。`);
            e.approve(false, '您的QQ等级不足。');
            await Bot.pickGroup(634644457).sendMsg(await makeForwardMsg(e, messages, '❌ 加群审核未通过提醒'));
            return false;
          }
        }

        // 答案验证部分保持不变
        const userAnswer = e.comment;
        const answerPass = ans.some(answer => exactMatch ? userAnswer.trim() === answer : userAnswer.includes(answer));
        if (answerPass) messages.push(`答案验证通过`);

        if (answerPass) {
          messages.push(`验证通过！已自动同意申请`);
          e.approve(true);
          await Bot.pickGroup(634644457).sendMsg(await makeForwardMsg(e, messages, '✅ 新成员加群审核通过'));
        } else {
          messages.push(`验证未通过！\n答案验证:${answerPass ? '通过' : '未通过'}`);
          e.approve(false, '答案验证未通过。');
          await Bot.pickGroup(634644457).sendMsg(await makeForwardMsg(e, messages, '❌ 加群审核未通过提醒'));
        }
      }
    } catch (error) {
      console.error('处理加群申请时发生错误:', error);
      e.approve(false, '处理加群申请时发生错误。');
    }
    return false;
  }
}

async function makeForwardMsg(e, message, dec) {
  try {
    if (!e.bot) {
      logger.error('Bot 对象未定义');
      return null;
    }
    
    let bot = e.bot;
    let qq = bot.uin;
    let group = bot.gl ? bot.gl.keys().next().value : null;
    
    if (group) logger.info(group);
    
    if (!Array.isArray(message)) message = [message];
    let info = {
      user_id: qq || 88888888,
      nickname: bot.nickname || "未知昵称"
    }
    message = message.map(i => {
      if (!message)
        return
      else
        if (!(typeof i == "object" && i.user_id && i.nickname))
          return {
            ...info,
            message: !Array.isArray(i) ? [i] : i
          }
        else return i
    })
    
    let forward;
    try {
      if (e.group_id && e.bot) {
        const group = e.bot.pickGroup(e.group_id);
        if (group?.raw?.makeForwardMsg) {
          forward = await group.raw.makeForwardMsg(message);
        }
      } else if (e.bot) {
        const friend = e.bot.pickFriend(1354903463);
        if (friend?.raw?.makeForwardMsg) {
          forward = await friend.raw.makeForwardMsg(message);
        }
      }
    } catch (err) {
      logger.error('创建转发消息失败：', err);
      return null;
    }
    
    if (dec) {
      // 生成详细的标题信息，只取群聊和用户信息两行
      const firstLine = message[0]?.message?.[0] || '';  // 群聊信息
      const secondLine = message[0]?.message?.[2]?.split('\n')?.[0] || '';  // 用户信息第一行
      const detailTitle = `${firstLine}\n${secondLine}`;
      
      if (typeof forward.data == "object") {
        if (forward.data?.meta?.detail) {
          forward.data.meta.detail.news = [{ text: detailTitle }]  // 使用详细信息作为标题
          forward.data.meta.detail.source = dec  // 使用传入的dec作为来源
          forward.data.meta.detail.summary = "点击查看审核详情"
          forward.data.meta.detail.prompt = "[聚集地成员审核日志]"
          forward.data.meta.detail.desc = "[聚集地成员审核日志]"
          forward.data.prompt = "[聚集地成员审核日志]"
        }
      } else {
        forward.data = forward.data
          .replace('<?xml version="1.0" encoding="utf-8"?>', '<?xml version="1.0" encoding="utf-8" ?>')
          .replace(/\n/g, '')
          .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, '___')
          .replace(/___+/, `<title color="#777777" size="26">${detailTitle}</title>`)  // 使用详细信息作为标题
          .replace(/source="[^"]*"/, `source="${dec}"`)  // 使用传入的dec作为来源
          .replace(/summary="[^"]*"/, `summary="点击查看审核详情"`)
          .replace(/prompt="[^"]*"/, `prompt="[聚集地成员审核日志]"`)
      }
    }
    
    return forward;
  } catch (e) {
    logger.error(e)
    return {
      type: "node", data: [{
        message: [{ type: "text", text: e.message.toString() }]
      }]
    }
  }
}