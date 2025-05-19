import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const configDir = path.join(process.cwd(), 'plugins/Kevin-plugin/config');
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}
const dataPath = path.join(configDir, 'broadcast_data.json');

// 移除 defaultData 对象

// 修改 readData 函数
async function readData() {
  try {
    if (fs.existsSync(dataPath)) {
      const data = fs.readFileSync(dataPath, 'utf-8');
      const parsedData = JSON.parse(data);
      if (Object.keys(parsedData).length > 0) {
        return parsedData;
      }
    }
    // 如果文件不存在或为空，创建一个新的数据结构
    const newData = {
      sourceGroupId: null,
      destinationGroupIds: [],
      bloggers: [],
      admins: [],
      failedBroadcast: null
    };
    await writeData(newData);
    return newData;
  } catch (error) {
    console.error('读取数据时出错:', error);
    return null;
  }
}

// 写入数据到 JSON 文件
async function writeData(data) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('写入数据时出错:', error);
  }
}

export class example extends plugin {
  constructor() {
    super({
      name: '多群广播',
      dsc: '多群广播',
      event: 'message',
      priority: -50000000,
      rule: [
        {
          reg: '^(#)?广播([\\s\\S]*)',
          fnc: 'broadcastMessage'
        },
        {
          reg: '^(#)?重要广播([\\s\\S]*)',
          fnc: 'broadcastMessage'
        },
        {
          reg: '^(#)?重试广播$',
          fnc: 'retryBroadcast'
        },
        {
          reg: /^group chat off$/i, 
          fnc: 'toggleForwardOn',
          log: true
        },
        {
          reg: /^group chat on$/i, 
          fnc: 'toggleForwardOff',
          log: true
        },
        {
          reg: '^(#)?(添加|删除)(博主|管理员|广播群)(.*)$',
          fnc: 'manageEntities',
          log: true
        }
      ]
    })
  }

  async initializePlugin() {
    const data = await readData();
    if (!data) {
      console.log('初始化插件数据失败');
      return;
    }

    // 只预加载 sourceGroupId 的群成员列表
    if (data.sourceGroupId) {
      try {
        const memberList = await Bot.getGroupMemberList(data.sourceGroupId);
        if (!example.hasLogged) {
          console.log(`已预加载群 ${data.sourceGroupId} 的成员列表，共 ${memberList.size} 个成员`);
          example.hasLogged = true;
        }
      } catch (error) {
        console.error(`预加载群 ${data.sourceGroupId} 成员列表失败:`, error);
      }
    }
  }

  async broadcastMessage(e) {
    const data = await readData();
    if (!data.sourceGroupId) {
      e.reply('源群未设置，请检查配置。');
      return;
    }
    const { sourceGroupId, destinationGroupIds, bloggers, admins } = data;

    if (e.group_id === sourceGroupId && (bloggers.includes(e.user_id) || admins.includes(e.user_id))) {
      const senderName = e.sender.card || e.sender.nickname || '未知用户';
      const isAtAll = e.msg.startsWith('#重要广播') || e.msg.startsWith('重要广播');
      const contentToForward = e.msg.replace(/^(#)?(重要广播|广播)/, '').trim();
      
      let forwardMsg = [];
      if (bloggers.includes(e.user_id)) {
        forwardMsg.push(`📣『${senderName}』`);
        if (isAtAll) {
          forwardMsg.push(segment.at('all'));
        }
        forwardMsg.push(`：${contentToForward}`);
      } else if (admins.includes(e.user_id)) {
        if (isAtAll) {
          forwardMsg.push(segment.at('all'));
        }
        forwardMsg.push(`‼️${contentToForward} —『${senderName}』`);
      }

      if (e.message) {
        for (const msg of e.message) {
          if (msg.type === 'image') {
            forwardMsg.push(segment.image(msg.url || msg.file));
          }
        }
      }

      // 记录成功和失败的群
      let successGroups = [];
      let failedGroups = [];
      let failedGroupNames = [];

      // 发送消息到所有目标群
      const sendToGroup = async (groupId, retryCount = 0) => {
        try {
          const group = Bot[207327108].pickGroup(groupId);
          await group.sendMsg(forwardMsg);
          return true;
        } catch (error) {
          console.error(`向群 ${groupId} 发送消息失败 (重试 ${retryCount}/2):`, error);
          if (retryCount < 2) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
            return sendToGroup(groupId, retryCount + 1);
          }
          return false;
        }
      };

      // 发送消息并处理结果
      for (const groupId of destinationGroupIds) {
        const success = await sendToGroup(groupId);
        if (success) {
          successGroups.push(groupId);
        } else {
          failedGroups.push(groupId);
          try {
            const groupInfo = Bot.gl.get(groupId);
            failedGroupNames.push(groupInfo ? groupInfo.group_name : groupId.toString());
          } catch (e) {
            failedGroupNames.push(groupId.toString());
          }
        }
      }

      // 根据结果发送不同的回复
      if (failedGroups.length === 0) {
        e.reply('消息已成功广播到所有目标群。', true);
      } else {
        // 保存失败的广播信息到 JSON 文件
        const failedBroadcastInfo = {
          groups: failedGroups,
          groupNames: failedGroupNames,
          message: forwardMsg,
          time: Date.now()
        };
        
        const data = await readData();
        data.failedBroadcast = failedBroadcastInfo;
        await writeData(data);

        if (successGroups.length === 0) {
          e.reply('消息广播失败，所有群都发送失败。\n发送 #重试广播 可以重新尝试发送失败的群。', true);
        } else {
          e.reply(`消息广播部分成功。\n` +
            `失败群：${failedGroupNames.join('、')}\n` +
            `发送 #重试广播 可以重新尝试发送失败的群。`, true);
        }
      }
    }
  }

  // 添加重试广播的方法
  async retryBroadcast(e) {
    const data = await readData();
    const failedBroadcast = data.failedBroadcast;

    if (!failedBroadcast || Date.now() - failedBroadcast.time > 300000) { // 5分钟内有效
      e.reply('没有最近失败的广播记录或重试已超时（5分钟）。', true);
      if (failedBroadcast) {
        // 清除过期的失败记录
        data.failedBroadcast = null;
        await writeData(data);
      }
      return;
    }

    const { groups, message } = failedBroadcast;
    let successGroups = [];
    let failedGroups = [];
    let failedGroupNames = [];

    // 重试发送
    for (const groupId of groups) {
      try {
        const group = Bot[207327108].pickGroup(groupId);
        await group.sendMsg(message);
        successGroups.push(groupId);
      } catch (error) {
        console.error(`重试向群 ${groupId} 发送消息失败:`, error);
        failedGroups.push(groupId);
        try {
          const groupInfo = Bot.gl.get(groupId);
          failedGroupNames.push(groupInfo ? groupInfo.group_name : groupId.toString());
        } catch (e) {
          failedGroupNames.push(groupId.toString());
        }
      }
    }

    // 更新失败记录
    if (failedGroups.length > 0) {
      data.failedBroadcast = {
        groups: failedGroups,
        groupNames: failedGroupNames,
        message: message,
        time: Date.now() // 更新时间
      };
    } else {
      data.failedBroadcast = null; // 全部成功则清除记录
    }
    await writeData(data);

    // 发送重试结果
    if (failedGroups.length === 0) {
      e.reply('重试成功：所有失败的群都已重新发送成功。', true);
    } else if (successGroups.length === 0) {
      e.reply('重试失败：所有群依然发送失败。', true);
    } else {
      e.reply(`重试部分成功。\n剩余失败群：${failedGroupNames.join('、')}`, true);
    }
  }

  async toggleForwardOn(e) {
    const data = await readData();
    if (!data.sourceGroupId) {
      e.reply('源群未设置，请检查配置。');
      return;
    }
    const { destinationGroupIds } = data;
    for (const groupId of destinationGroupIds) {
      await Bot[207327108].pickGroup(groupId).muteAll(true);  // 开启全员禁言
    }
    for (const groupId of destinationGroupIds) {
      await Bot[207327108].pickGroup(groupId).sendMsg('狂欢结束~ 大家保持安静🤫');
    }
  }

  async toggleForwardOff(e) {
    const data = await readData();
    if (!data.sourceGroupId) {
      e.reply('源群未设置，请检查配置。');
      return;
    }
    const { destinationGroupIds } = data;
    for (const groupId of destinationGroupIds) {
      await Bot.pickGroup(groupId).muteAll(false);  // 关闭全员禁言
    }
    for (const groupId of destinationGroupIds) {
      await Bot[207327108].pickGroup(groupId).sendMsg('❗欢呼吧！在接下来的时间里，聚集地的所有人都能无限制的发布且能看到你发的信息');
    }
  }

  async manageEntities(e) {
    if (!await checkAuth(e)) return;
    const data = await readData();
    if (!data.sourceGroupId) {
      e.reply('源群未设置，请检查配置。');
      return;
    }

    const match = e.msg.match(/^(#)?(添加|删除)(博主|管理员|广播群)(.*)$/);
    const [, , action, entityType, idString] = match;
    let id = e.at || parseInt(idString.trim(), 10);

    if (!id || isNaN(id)) {
      e.reply(`请输入有效的${entityType}ID或艾特要${action}的${entityType}。`);
      return;
    }

    let targetArray;
    switch (entityType) {
      case '博主':
        targetArray = data.bloggers;
        break;
      case '管理员':
        targetArray = data.admins;
        break;
      case '广播群':
        targetArray = data.destinationGroupIds;
        break;
    }

    if (action === '添加') {
      if (!targetArray.includes(id)) {
        targetArray.push(id);
        await writeData(data);
        e.reply(`${entityType} ${id} 添加成功。`);
      } else {
        e.reply(`${entityType} ${id} 已存在。`);
      }
    } else if (action === '删除') {
      const index = targetArray.indexOf(id);
      if (index !== -1) {
        targetArray.splice(index, 1);
        await writeData(data);
        e.reply(`${entityType} ${id} 删除成功。`);
      } else {
        e.reply(`${entityType} ${id} 不存在。`);
      }
    }
  }
}

const checkAuth = async function (e) {
  if (!e.isMaster) {
    e.reply(`你也配？`);
    return false;
  }
  return true;
}
