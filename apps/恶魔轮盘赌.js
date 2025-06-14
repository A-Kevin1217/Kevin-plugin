import { isQQBot, replyMarkdownButton } from '../components/CommonReplyUtil.js'
const DemonGame = {};

// Redis游戏状态管理
class GameStateManager {
  static getRedisKey(groupId) {
    return `Yunzai:DemonRoulette:${groupId}`;
  }

  static async saveGameState(groupId, gameState) {
    if (!gameState) return;
    const redisKey = this.getRedisKey(groupId);
    await redis.set(redisKey, JSON.stringify(gameState));
  }

  static async loadGameState(groupId) {
    const redisKey = this.getRedisKey(groupId);
    const data = await redis.get(redisKey);
    return data ? JSON.parse(data) : null;
  }

  static async clearGameState(groupId) {
    const redisKey = this.getRedisKey(groupId);
    await redis.del(redisKey);
  }
}

export class DemonRoulette extends plugin {
  constructor() {
    super({
      name: '恶魔轮盘赌',
      dsc: '多人参与的恶魔轮盘赌游戏',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: '^(#|\/)?\s*恶魔轮盘赌\s*$',
          fnc: 'startGame'
        },
        {
          reg: '^(#|\/)?\s*加入轮盘赌\s*$',
          fnc: 'joinGame'
        },
        {
          reg: '^(#|\/)?\s*开始轮盘赌\s*$',
          fnc: 'beginGame'
        },
        {
          reg: '^(#|\/)?\s*轮盘赌规则\s*$',
          fnc: 'showRules'
        },
        {
          reg: '^(#|\/)?开枪(\s*(自己|对方))?',
          fnc: 'shoot'
        },
        {
          reg: '^(#|\/)?\s*道具\s*$',
          fnc: 'showItemButtons'
        },
        {
          reg: '^(#|\/)?\s*使用道具.*$',
          fnc: 'useItem'
        },
        {
          reg: '^(#|\/)?\s*选择道具.*$',
          fnc: 'selectItemToSteal'
        },
        {
          reg: '^(#|\/)?\s*认输\s*$',
          fnc: 'surrender'
        },
        {
          reg: '^(#|\/)?\s*结束游戏\s*$',
          fnc: 'requestEndGame'
        },
        {
          reg: '^(#|\/)?\s*同意结束\s*$',
          fnc: 'acceptEndGame'
        },
        {
          reg: '^(#|\/)?\s*拒绝结束\s*$',
          fnc: 'rejectEndGame'
        }
      ]
    });
    console.log('恶魔轮盘赌插件已加载');
  }

  // 初始化玩家道具
  initPlayerItems() {
    // 所有可用道具及其初始数量
    const allItems = {
      '香烟': 2,
      '放大镜': 3,
      '手铐': 1,
      '锯子': 1,
      '饮料': 2,
      '逆转器': 1,
      '肾上腺素': 1,
      '电话': 1,
      '过期药': 1
    };

    // 随机选择8个道具
    const items = {};
    const itemEntries = Object.entries(allItems);
    const selectedItems = itemEntries.sort(() => Math.random() - 0.5).slice(0, 8);

    selectedItems.forEach(([item, count]) => {
      items[item] = { count, used: false };
    });

    return items;
  }

  async startGame(e) {
    if (!isQQBot(e)) { await e.reply('请艾特六阶堂穗玉使用'); return false }

    const groupId = e.group_id;
    
    // 先从redis加载游戏状态
    const savedGame = await GameStateManager.loadGameState(groupId);
    if (savedGame) {
      DemonGame[groupId] = savedGame;
      return;
    }
    
    if (DemonGame[groupId]) {
      await e.reply('游戏已在进行中，无法重新创建。');
      return;
    }

    // 创建者自动加入
    const creatorId = e.user_id;
    DemonGame[groupId] = {
      players: [{
        id: creatorId,
        hp: 5,
        items: this.initPlayerItems(),
        usedMagnifier: false,
        selfEmptyShots: 0,
        deadItems: [] // 用于存储死亡时的道具
      }],
      status: 'waiting',
      chamber: this.generateChamber(),
      currentPlayer: 0, // 设置为0，确保创建者是第一个玩家
      turn: 0,
      creator: creatorId // 添加创建者标记
    };
    
    // 保存游戏状态到redis
    await GameStateManager.saveGameState(groupId, DemonGame[groupId]);

    await e.reply('⚠️ 恶魔轮盘赌为双人对战模式，已自动加入创建者，等待另一位玩家加入...');

    const creatorIdPart = String(creatorId).split(':').pop(); // 用于头像显示

    await replyMarkdownButton(e, [
      { key: 'a', values: ['#'] },
      { key: 'b', values: [' 恶魔轮盘赌\r'] },
      { key: 'c', values: ['> 已加入1/2玩家\r\r当前玩家：'] },
      { key: 'e', values: [`![玩家头像 #25px #25px](https://q.qlogo.cn/qqapp/102059511/${creatorIdPart}/640`] },
      { key: 'f', values: [') '] }
    ], [
      [
        { text: '加入轮盘赌', callback: '/加入轮盘赌', clicked_text: '正在加入轮盘赌' }
      ]
    ])
  }

  async joinGame(e) {
    if (!isQQBot(e)) { await e.reply('请艾特六阶堂穗玉使用'); return false }

    const groupId = e.group_id;
    const session = DemonGame[groupId];
    if (!session) {
      await e.reply('当前没有进行中的游戏，请先创建游戏。');
      return;
    }

    if (session.status !== 'waiting') {
      await e.reply('游戏已经开始，无法加入。');
      return;
    }

    const userId = e.user_id;
    const userIdStr = userId;
    const userIdPart = String(userId).split(':').pop(); // 仅用于头像

    // 检查是否是创建者
    if (userIdStr === session.creator) {
      await e.reply('创建者已自动加入游戏，无需重复加入');
      return;
    }

    if (session.players.some(p => p.id === userId)) {
      await e.reply('你已经加入游戏了！');
      return;
    }

    if (session.players.length >= 2) {
      await e.reply('游戏人数已满（最多2人）');
      return;
    }

    session.players.push({
      id: userIdStr,
      hp: 5,
      items: this.initPlayerItems(),
      usedMagnifier: false,
      selfEmptyShots: 0,
      deadItems: [] // 用于存储死亡时的道具
    });
    
    // 保存游戏状态到redis
    await GameStateManager.saveGameState(groupId, session);

    // 人满自动开始
    const playerAvatars = session.players.flatMap((player, index) => {
      const playerId = player.id;
      const playerIdPart = playerId.includes(':') ? playerId.split(':').pop() : playerId;

      return [
        { key: ['e', 'g'][index], values: [`![玩家头像 #25px #25px](https://q.qlogo.cn/qqapp/102059511/${playerIdPart}/640`] },
        { key: ['f', 'h'][index], values: [') '] }
      ];
    });

    if (session.players.length === 2) {
      session.status = 'playing';
      session.currentPlayer = 0;
      // 统计弹匣实弹和空弹数量
      const live = session.chamber.filter(x => x).length;
      const empty = session.chamber.length - live;
      
      // 保存游戏状态到redis
      await GameStateManager.saveGameState(groupId, session);
      await replyMarkdownButton(e, [
        { key: 'a', values: ['#'] },
        { key: 'b', values: ['恶魔轮盘赌\r> 游戏人数已满，游戏开始\r'] },
        { key: 'c', values: [`![${e.sender.card || e.sender.nickname} #25px #25px](https://q.qlogo.cn/qqapp/102059511/${userIdPart}/640`] },
        { key: 'd', values: [') 已加入轮盘赌！\r\r当前玩家：'] },
        ...playerAvatars,
        { key: 'i', values: [`\r本轮弹匣：${live}发实弹，${empty}发空弹`] }
      ]);
      // 保存游戏状态到redis
    await GameStateManager.saveGameState(groupId, session);
    await this.nextTurn(e);
      return;
    }

    // 更新加入后的显示
    await replyMarkdownButton(e, [
      { key: 'a', values: ['#'] },
      { key: 'b', values: [' 恶魔轮盘赌\r'] },
      { key: 'c', values: [`> ![${e.sender.card || e.sender.nickname} #25px #25px](https://q.qlogo.cn/qqapp/102059511/${userIdPart}/640`] },
      { key: 'd', values: [') 已加入轮盘赌！\r\r当前玩家：'] },
      ...playerAvatars
    ], [
      [
        { text: '加入轮盘赌', callback: '/加入轮盘赌', clicked_text: '正在加入轮盘赌' }
      ]
    ]);
  }

  async shoot(e) {
    if (!isQQBot(e)) { await e.reply('请艾特六阶堂穗玉使用'); return false }

    const groupId = e.group_id;
    const session = DemonGame[groupId];
    if (!session || session.status !== 'playing') {
      await e.reply('当前没有进行中的游戏。');
      return;
    }

    const currentPlayer = session.players[session.currentPlayer];
    if (e.user_id !== currentPlayer.id) {
      await e.reply('现在不是你的回合！');
      return;
    }

    // 从消息中提取目标类型
    const targetMatch = e.msg.match(/^(#|\/)?\s*开枪\s*(自己|对方)?/);
    if (!targetMatch || !targetMatch[2]) {
      await replyMarkdownButton(e, [
        { key: 'a', values: ['#'] },
        { key: 'b', values: ['恶魔轮盘赌\r> 🎯 选择开枪目标\r'] },
        { key: 'c', values: ['请选择要射击的目标：'] }
      ], [
        [
          { text: '朝自己开枪', callback: '/开枪 自己', clicked_text: '正在开枪...', permission: currentPlayer.id },
          { text: '朝对方开枪', callback: '/开枪 对方', clicked_text: '正在开枪...', permission: currentPlayer.id }
        ]
      ]);
      return;
    }

    const targetType = targetMatch[2];
    // 确定目标玩家
    const targetPlayer = targetType === '自己' ? currentPlayer :
      session.players.find(p => p.id !== currentPlayer.id);

    if (!targetPlayer) {
      await e.reply('目标玩家不存在！');
      return;
    }

    const isLive = session.chamber[session.turn];
    // 新增：记录本次射击是否打自己空弹或实弹
    let isSelf = targetType === '自己';
    let isSelfEmpty = isSelf && !isLive;
    let isSelfLive = isSelf && isLive;

    if (isLive) {
      let damage = 1;
      if (session.damageBoost) {
        damage = 2;
        session.damageBoost = false;
      }
      targetPlayer.hp -= damage;

      const targetId = String(targetPlayer.id).split(':').pop();
      await replyMarkdownButton(e, [
        { key: 'a', values: ['#'] },
        { key: 'b', values: ['恶魔轮盘赌\r> 💥 砰！实弹！\r'] },
        { key: 'c', values: [`💀 ${targetType === '自己' ? '自己' : '对方'} 受到${damage}点伤害！`] }
      ]);

      if (targetPlayer.hp <= 0) {
        // 保存死亡玩家的道具信息
        targetPlayer.deadItems = Object.entries(targetPlayer.items)
          .filter(([_, data]) => data.count > 0)
          .map(([item, data]) => ({ item, count: data.count }));

        session.players = session.players.filter(p => p.id !== targetPlayer.id);
      }

      if (session.players.length === 1) {
        const winnerId = String(session.players[0].id).split(':').pop();
        await replyMarkdownButton(e, [
          { key: 'a', values: ['#'] },
          { key: 'b', values: ['恶魔轮盘赌\r> 🎉 游戏结束！\r'] },
          { key: 'c', values: [`![胜利者 #25px #25px](https://q.qlogo.cn/qqapp/102059511/${winnerId}/640`] },
          { key: 'd', values: [') 是最后的幸存者！\r'] }
        ], [
          [
            { text: '再来一局', callback: '/恶魔轮盘赌', clicked_text: '正在重新开始' }
          ]
        ]);
        // 清除redis中的游戏状态
        await GameStateManager.clearGameState(groupId);
        DemonGame[groupId] = null;
        return;
      }
      
      // 保存游戏状态到redis
      await GameStateManager.saveGameState(groupId, session);
    } else {
      await replyMarkdownButton(e, [
        { key: 'a', values: ['#'] },
        { key: 'b', values: ['恶魔轮盘赌\r> 💨 咔哒...\r'] },
        { key: 'c', values: ['空弹！'] }
      ]);

      // 如果是打自己且是空枪，保持当前回合
      if (targetType === '自己') {
        if (!isLive) {
          // 增加连续空枪计数
          currentPlayer.selfEmptyShots++;

          // 如果连续三次空枪，奖励一根烟
          if (currentPlayer.selfEmptyShots >= 3) {
            currentPlayer.items['香烟'].count++;
            currentPlayer.selfEmptyShots = 0;
            await replyMarkdownButton(e, [
              { key: 'a', values: ['#'] },
              { key: 'b', values: ['恶魔轮盘赌\r> 🎁 获得奖励\r'] },
              { key: 'c', values: ['连续三次打自己空枪，奖励一根香烟！'] }
            ]);
          }
        } else {
          // 如果打中自己，重置连续空枪计数
          currentPlayer.selfEmptyShots = 0;
        }
        await replyMarkdownButton(e, [
          { key: 'a', values: ['#'] },
          { key: 'b', values: ['恶魔轮盘赌\r> 🎯 继续行动\r'] },
          { key: 'c', values: ['打自己空枪，继续你的回合！'] }
        ]);
        session.turn += 1;
        if (session.turn >= session.chamber.length) {
          session.chamber = this.generateChamber();
          session.turn = 0;
        }
        // 重置当前玩家的道具使用状态和放大镜标记
        Object.values(currentPlayer.items).forEach(item => item.used = false);
        currentPlayer.usedMagnifier = false;
        
        // 保存游戏状态到redis
        await GameStateManager.saveGameState(groupId, session);
        
        await replyMarkdownButton(e, [
          { key: 'a', values: ['#'] },
          { key: 'b', values: ['恶魔轮盘赌\r> 🎯 选择开枪目标\r'] },
          { key: 'c', values: ['请选择要射击的目标：'] }
        ], [
          [
            { text: '朝自己开枪', callback: '/开枪 自己', clicked_text: '正在开枪...', permission: currentPlayer.id },
            { text: '朝对方开枪', callback: '/开枪 对方', clicked_text: '正在开枪...', permission: currentPlayer.id }
          ]
        ]);
        return;
      }
    }

    session.turn += 1;
    if (session.turn >= session.chamber.length) {
      // 统计新弹匣实弹和空弹数量
      session.chamber = this.generateChamber();
      const live = session.chamber.filter(x => x).length;
      const empty = session.chamber.length - live;
      session.turn = 0;
      await replyMarkdownButton(e, [
        { key: 'a', values: ['#'] },
        { key: 'b', values: ['恶魔轮盘赌\r> 🔄 弹夹已更换\r'] },
        { key: 'c', values: ['弹夹已更换，继续你的回合！'] },
        { key: 'd', values: [`\r新弹匣：${live}发实弹，${empty}发空弹`] }
      ]);
      // 新增：根据规则决定是否切换回合
      if (isSelfLive) {
        session.currentPlayer = (session.currentPlayer + 1) % session.players.length;
      }
    }

    // 保存游戏状态到redis
    await GameStateManager.saveGameState(groupId, session);
    await this.nextTurn(e);
  }

  async useItem(e) {
    if (!isQQBot(e)) { await e.reply('请艾特六阶堂穗玉使用'); return false }

    const itemName = e.msg.replace(/^(#|\/)?\s*使用道具\s*/, '').trim();
    if (!itemName) {
      await e.reply('请指定要使用的道具！');
      return;
    }

    const groupId = e.group_id;
    const session = DemonGame[groupId];

    if (!session || session.status !== 'playing') {
      await e.reply('当前没有进行中的游戏！');
      return;
    }

    const currentPlayer = session.players[session.currentPlayer];
    if (e.user_id !== currentPlayer.id) {
      await e.reply('现在不是你的回合！');
      return;
    }

    if (!['香烟', '放大镜', '手铐', '锯子', '饮料', '逆转器', '肾上腺素', '电话', '过期药'].includes(itemName)) {
      await e.reply(`无效的道具名称：${itemName}`);
      return;
    }

    const item = currentPlayer.items[itemName];

    // 检查道具是否存在且数量大于0
    if (!item || item.count <= 0) {
      await e.reply(`你没有${itemName}！`);
      return;
    }

    // 检查道具是否已使用（香烟除外）
    if (itemName !== '香烟' && item.used) {
      await e.reply(`${itemName}在本回合已经使用过了！`);
      return;
    }

    // 检查放大镜互斥
    if ((itemName === '锯子' || itemName === '逆转器') && currentPlayer.usedMagnifier) {
      await e.reply('已经使用过放大镜，本回合无法使用锯子或逆转器！');
      return;
    }

    // 检查其他道具与放大镜的互斥
    if (itemName === '放大镜') {
      const hasUsedOtherItems = ['锯子', '逆转器', '饮料'].some(otherItem =>
        currentPlayer.items[otherItem] && currentPlayer.items[otherItem].used
      );
      if (hasUsedOtherItems) {
        await e.reply('已经使用过锯子、逆转器或饮料，本回合无法使用放大镜！');
        return;
      }
    }

    if (itemName === '饮料' && currentPlayer.usedMagnifier) {
      await e.reply('已经使用过放大镜，本回合无法使用饮料！');
      return;
    }

    // 所有道具都消耗使用次数
    item.count -= 1;
    // 除了香烟外的道具标记为已使用
    if (itemName !== '香烟') {
      item.used = true;
    }

    switch (itemName) {
      case '香烟':
        currentPlayer.hp = Math.min(8, currentPlayer.hp + 1);
        await e.reply('🚬 使用香烟，恢复1点生命值！');
        break;
      case '放大镜':
        currentPlayer.usedMagnifier = true;
        await e.reply('🔍 使用放大镜查看下一发子弹...');
        await replyMarkdownButton(e, [
          { key: 'a', values: ['#'] },
          { key: 'b', values: ['恶魔轮盘赌\r> 🔍 放大镜效果\r'] },
          { key: 'c', values: ['点击下方按钮查看下一发子弹'] }
        ], [
          [
            {
              text: '查看子弹',
              input: session.chamber[session.turn] ? '💣 下一发是实弹！' : '💨 下一发是空弹！',
              permission: e.user_id,
              clicked_text: '已查看'
            }
          ]
        ]);
        break;
      case '手铐':
        session.skipTurn = true;
        await e.reply('🔒 使用手铐，对方下一回合无法行动！');
        break;
      case '锯子':
        session.damageBoost = true;
        await e.reply('🪚 使用锯子，下一发实弹伤害+1！');
        break;
      case '饮料':
        session.turn += 1;
        await e.reply('🥤 使用饮料，弹出当前子弹！');

        // 如果是最后一发子弹
        if (session.turn >= session.chamber.length) {
          session.chamber = this.generateChamber();
          const live = session.chamber.filter(x => x).length;
          const empty = session.chamber.length - live;
          session.turn = 0;
          await replyMarkdownButton(e, [
            { key: 'a', values: ['#'] },
            { key: 'b', values: ['恶魔轮盘赌\r> 🔄 弹夹已更换\r'] },
            { key: 'c', values: ['弹夹已更换，继续你的回合！'] },
            { key: 'd', values: [`\r新弹匣：${live}发实弹，${empty}发空弹`] }
          ]);
        }
        // 继续当前回合
        await this.showShootTargets(e);
        return;
      case '逆转器':
        // 反转当前子弹类型
        session.chamber[session.turn] = !session.chamber[session.turn];
        await e.reply('🔄 使用逆转器，改变了当前子弹的类型！');
        break;
      case '肾上腺素':
        // 获取所有其他玩家（包括死亡玩家）的道具列表
        const otherPlayersItems = [];
        session.players.forEach(p => {
          if (p.id !== currentPlayer.id) {
            Object.entries(p.items).forEach(([itemName, data]) => {
              if (itemName !== '肾上腺素' && data.count > 0) {
                otherPlayersItems.push({ itemName, count: data.count });
              }
            });
          }
        });

        // 检查是否有可盗取的道具
        if (otherPlayersItems.length === 0) {
          await e.reply('没有可盗取的道具！');
          item.count++; // 返还道具
          item.used = false;
          return;
        }

        // 将按钮分成每行最多3个
        const rows = [];
        for (let i = 0; i < otherPlayersItems.length; i += 3) {
          const row = otherPlayersItems.slice(i, i + 3).map(({ itemName, count }) => ({
            text: `${itemName}×${count}`,
            input: `/选择道具 对方的${itemName}`,
            permission: currentPlayer.id
          }));
          rows.push(row);
        }

        await replyMarkdownButton(e, [
          { key: 'a', values: ['#'] },
          { key: 'b', values: ['恶魔轮盘赌\r> 🎯 选择要盗取的道具\r'] },
          { key: 'c', values: ['请选择要盗取的道具：'] }
        ], rows);
        return;

      case '电话':
        if (session.chamber.length - session.turn <= 2) {
          await e.reply('多么不幸......');
          break;
        }
        // 随机选择一个未来的子弹位置
        const futurePos = Math.floor(Math.random() * (session.chamber.length - session.turn - 2)) + session.turn + 1;
        const bulletType = session.chamber[futurePos];
        await replyMarkdownButton(e, [
          { key: 'a', values: ['#'] },
          { key: 'b', values: ['恶魔轮盘赌\r> 📱 电话情报\r'] },
          { key: 'c', values: [`第${futurePos - session.turn + 1}发是${bulletType ? '实弹' : '空弹'}！`] }
        ]);
        break;

      case '过期药':
        const isLucky = Math.random() < 0.5;
        if (isLucky) {
          currentPlayer.hp = Math.min(8, currentPlayer.hp + 2);
          await e.reply('💊 运气不错！恢复2点生命值！');
        } else {
          currentPlayer.hp = Math.max(0, currentPlayer.hp - 1);
          await e.reply('🤢 药过期了！损失1点生命值！');

          // 检查玩家是否死亡
          if (currentPlayer.hp <= 0) {
            // 保存死亡玩家的道具信息
            currentPlayer.deadItems = Object.entries(currentPlayer.items)
              .filter(([_, data]) => data.count > 0)
              .map(([item, data]) => ({ item, count: data.count }));

            session.players = session.players.filter(p => p.id !== currentPlayer.id);

            // 如果只剩一个玩家，游戏结束
            if (session.players.length === 1) {
              const winnerId = String(session.players[0].id).split(':').pop();
              await replyMarkdownButton(e, [
                { key: 'a', values: ['#'] },
                { key: 'b', values: ['恶魔轮盘赌\r> 🎉 游戏结束！\r'] },
                { key: 'c', values: [`![胜利者 #25px #25px](https://q.qlogo.cn/qqapp/102059511/${winnerId}/640`] },
                { key: 'd', values: [') 是最后的幸存者！\r'] }
              ], [
                [
                  { text: '再来一局', callback: '/恶魔轮盘赌', clicked_text: '正在重新开始' }
                ]
              ]);
              // 清除redis中的游戏状态
              await GameStateManager.clearGameState(groupId);
              DemonGame[groupId] = null;
              return;
            }
          }
        }
        break;
    }

    // 保存游戏状态到redis
    await GameStateManager.saveGameState(groupId, session);

    // 只有手铐和饮料会跳过回合，其他道具使用后继续当前回合
    if (!['手铐', '饮料'].includes(itemName)) {
      await this.showItemButtons(e);
    }
  }

  async nextTurn(e) {
    const groupId = e.group_id;
    const session = DemonGame[groupId];

    // 如果是游戏刚开始，确保创建者先手
    if (session.turn === 0 && session.status === 'playing') {
      // 找到创建者的索引
      const creatorIndex = session.players.findIndex(p => p.id === session.creator);
      session.currentPlayer = creatorIndex;
    } else {
      // 如果当前回合被跳过，先切换玩家
      if (session.skipTurn) {
        session.skipTurn = false;
        session.currentPlayer = (session.currentPlayer + 1) % session.players.length;
        session.currentPlayer = (session.currentPlayer + 1) % session.players.length;
      } else {
        session.currentPlayer = (session.currentPlayer + 1) % session.players.length;
      }
    }

    const currentPlayer = session.players[session.currentPlayer];
    const currentPlayerId = String(currentPlayer.id).split(':').pop();

    // 重置当前玩家的道具使用状态和放大镜标记
    Object.values(currentPlayer.items).forEach(item => item.used = false);
    currentPlayer.usedMagnifier = false;
    
    // 保存游戏状态到redis
    await GameStateManager.saveGameState(groupId, session);

    // 生成所有玩家的头像和状态
    const playerAvatars = session.players.map((p, index) => {
      const playerId = String(p.id).split(':').pop();
      return [
        { key: ['e', 'g'][index], values: [`![玩家 #25px #25px](https://q.qlogo.cn/qqapp/102059511/${playerId}/640`] },
        { key: ['f', 'h'][index], values: [`) (${p.hp}❤️)`] }
      ];
    }).flat();

    // 获取所有玩家的ID用于权限设置
    const playerIds = session.players.map(p => p.id);

    await replyMarkdownButton(e, [
      { key: 'a', values: ['#'] },
      { key: 'b', values: [`恶魔轮盘赌\r> 轮到 <@${currentPlayerId}> 的回合\r`] },
      { key: 'c', values: ['当前玩家：'] },
      ...playerAvatars
    ], [
      [
        { text: '开枪', callback: '/开枪', clicked_text: '正在选择目标...' },
        { text: '使用道具', input: '/使用道具', clicked_text: '正在选择道具' },
        {
          text: '查看道具',
          input: [
            '⚠️ 请勿直接发送此消息！如果你非要发我也不拦着',
            '使用道具请点击对应道具按钮',
            '------------------------',
            ...Object.entries(currentPlayer.items)
              .filter(([_, data]) => data.count > 0)
              .map(([item, data]) => `${item}×${data.count}：${this.getItemDescription(item)}`)
          ].join('\n'),
          clicked_text: '正在查看道具',
          permission: currentPlayer.id
        }
      ],
      [
        {
          text: '结束游戏',
          callback: '/结束游戏',
          clicked_text: '已申请结束游戏',
          permission: playerIds
        }
      ]
    ]);
  }

  generateChamber() {
    const total = 6;
    const chamber = new Array(total).fill(false);
    // 每发子弹都有50%的概率是实弹
    return chamber.map(() => Math.random() < 0.5);
  }

  getItemDescription(item) {
    const descriptions = {
      '香烟': '恢复1点生命值',
      '放大镜': '查看下一发子弹',
      '手铐': '跳过对方回合',
      '锯子': '实弹伤害+1',
      '饮料': '弹出当前子弹',
      '逆转器': '改变当前子弹类型',
      '肾上腺素': '盗取并使用其他玩家的道具',
      '电话': '查看随机一发剩余子弹',
      '过期药': '50%概率回2血，50%概率掉1血'
    };
    return descriptions[item] || '未知道具';
  }

  async showItemButtons(e) {
    if (!isQQBot(e)) { await e.reply('请艾特六阶堂穗玉使用'); return false }

    const groupId = e.group_id;
    const session = DemonGame[groupId];

    if (!session || session.status !== 'playing') {
      await e.reply('当前没有进行中的游戏');
      return;
    }

    const currentPlayer = session.players[session.currentPlayer];
    if (e.user_id !== currentPlayer.id) {
      await e.reply('现在不是你的回合！');
      return;
    }

    // 所有可能的道具
    const allItems = [
      ['香烟', '🚬'],
      ['放大镜', '🔍'],
      ['手铐', '🔒'],
      ['锯子', '🪚'],
      ['饮料', '🥤'],
      ['逆转器', '🔄'],
      ['肾上腺素', '💉'],
      ['电话', '📱'],
      ['过期药', '💊']
    ];

    // 生成道具详情字符串
    const itemDetails = Object.entries(currentPlayer.items)
      .filter(([_, data]) => data.count > 0)
      .map(([item, data]) => {
        const emoji = allItems.find(([name]) => name === item)?.[1] || '';
        return `${emoji} ${item}×${data.count}：${this.getItemDescription(item)}`;
      })
      .join('\n');

    // 生成道具按钮
    const buttons = [{
      text: '查看道具详情',
      input: [
        '⚠️ 请勿直接发送此消息！如果你非要发我也不拦着',
        '使用道具请点击对应道具按钮',
        '------------------------',
        itemDetails || '当前没有可用道具'
      ].join('\n'),
      clicked_text: '正在查看道具',
      permission: currentPlayer.id
    }];

    await replyMarkdownButton(e, [
      { key: 'a', values: ['#'] },
      { key: 'b', values: ['恶魔轮盘赌\r> 🎒 道具栏\r'] },
      { key: 'c', values: ['点击下方按钮使用道具'] }
    ], [
      [
        {
          text: '查看道具详情',
          input: [
            '⚠️ 请勿直接发送此消息！如果你非要发我也不拦着',
            '使用道具请点击对应道具按钮',
            '------------------------',
            itemDetails || '当前没有可用道具'
          ].join('\n'),
          clicked_text: '正在查看道具',
          permission: currentPlayer.id
        }
      ]
    ]);
  }

  async selectItemToSteal(e) {
    if (!isQQBot(e)) { await e.reply('请艾特六阶堂穗玉使用'); return false }

    const groupId = e.group_id;
    const session = DemonGame[groupId];

    if (!session || session.status !== 'playing') {
      await e.reply('当前没有进行中的游戏');
      return;
    }

    const currentPlayer = session.players[session.currentPlayer];
    if (e.user_id !== currentPlayer.id) {
      await e.reply('现在不是你的回合！');
      return;
    }

    const itemName = e.msg.replace(/^(#|\/)?\s*选择道具\s*对方的/, '').trim();
    if (!itemName) {
      await e.reply('请选择要盗取的道具！');
      return;
    }

    // 验证道具名称
    if (!['香烟', '放大镜', '手铐', '锯子', '饮料', '逆转器', '肾上腺素', '电话', '过期药'].includes(itemName)) {
      await e.reply('无效的道具名称');
      return;
    }

    // 找到对方玩家
    const targetPlayer = session.players.find(p => p.id !== currentPlayer.id);

    if (!targetPlayer || !targetPlayer.items[itemName] || targetPlayer.items[itemName].count <= 0) {
      await e.reply(`对方没有${itemName}！`);
      return;
    }

    // 转移道具
    targetPlayer.items[itemName].count--;
    currentPlayer.items[itemName] = currentPlayer.items[itemName] || { count: 0, used: false };
    currentPlayer.items[itemName].count++;

    // 保存游戏状态到redis
    await GameStateManager.saveGameState(groupId, session);

    await replyMarkdownButton(e, [
      { key: 'a', values: ['#'] },
      { key: 'b', values: ['恶魔轮盘赌\r> 🎯 盗取成功\r'] },
      { key: 'c', values: [`成功盗取了 ${itemName}！\r道具已存入背包`] }
    ]);

    // 显示道具按钮
    await this.showItemButtons(e);
  }

  async surrender(e) {
    if (!isQQBot(e)) { await e.reply('请艾特六阶堂穗玉使用'); return false }

    const groupId = e.group_id;
    const session = DemonGame[groupId];

    if (!session || session.status !== 'playing') {
      await e.reply('当前没有进行中的游戏');
      return;
    }

    const currentPlayer = session.players.find(p => p.id === e.user_id);
    if (!currentPlayer) {
      await e.reply('你不是游戏参与者！');
      return;
    }

    // 找到获胜者（非认输方）
    const winner = session.players.find(p => p.id !== e.user_id);
    const winnerId = String(winner.id).split(':').pop();

    await replyMarkdownButton(e, [
      { key: 'a', values: ['#'] },
      { key: 'b', values: ['恶魔轮盘赌\r> 🏳️ 游戏结束\r'] },
      { key: 'c', values: [`玩家认输！\r\r![胜利者 #25px #25px](https://q.qlogo.cn/qqapp/102059511/${winnerId}/640`] },
      { key: 'd', values: [') 获得胜利！'] }
    ], [
      [
        { text: '再来一局', callback: '/恶魔轮盘赌', clicked_text: '正在重新开始' }
      ]
    ]);

    // 清除redis中的游戏状态
    await GameStateManager.clearGameState(groupId);
    DemonGame[groupId] = null;
  }

  async requestEndGame(e) {
    if (!isQQBot(e)) { await e.reply('请艾特六阶堂穗玉使用'); return false }

    const groupId = e.group_id;
    const session = DemonGame[groupId];

    if (!session || session.status !== 'playing') {
      await e.reply('当前没有进行中的游戏');
      return;
    }

    const currentPlayer = session.players.find(p => p.id === e.user_id);
    if (!currentPlayer) {
      await e.reply('你不是游戏参与者！');
      return;
    }

    // 设置请求结束游戏的状态
    session.endGameRequest = {
      requesterId: e.user_id,
      status: 'pending'
    };

    // 找到对手
    const opponent = session.players.find(p => p.id !== e.user_id);
    const opponentId = String(opponent.id).split(':').pop();

    const playerIds = session.players.map(p => p.id);

    await replyMarkdownButton(e, [
      { key: 'a', values: ['#'] },
      { key: 'b', values: ['恶魔轮盘赌\r> ⚠️ 结束请求\r'] },
      { key: 'c', values: [`<@${opponentId}> 对方请求结束游戏\r是否同意？`] }
    ], [
      [
        { text: '轮盘赌认输', callback: '/认输', permission: playerIds, clicked_text: '已认输' },
        { text: '同意结束轮盘赌', callback: '/同意结束', permission: opponent.id, clicked_text: '已同意结束' }
      ]
    ]);
  }

  async acceptEndGame(e) {
    if (!isQQBot(e)) { await e.reply('请艾特六阶堂穗玉使用'); return false }

    const groupId = e.group_id;
    const session = DemonGame[groupId];

    if (!session || session.status !== 'playing') {
      await e.reply([
        replyMarkdownButton(e, [
          { key: 'a', values: ['#'] },
          { key: 'b', values: ['恶魔轮盘赌\r> ❌ 错误\r'] },
          { key: 'c', values: ['当前没有进行中的游戏'] }
        ])
      ]);
      return;
    }

    if (!session.endGameRequest || session.endGameRequest.status !== 'pending') {
      await e.reply([
        replyMarkdownButton(e, [
          { key: 'a', values: ['#'] },
          { key: 'b', values: ['恶魔轮盘赌\r> ❌ 错误\r'] },
          { key: 'c', values: ['当前没有待处理的结束游戏请求'] }
        ])
      ]);
      return;
    }

    if (e.user_id === session.endGameRequest.requesterId) {
      await e.reply([
        replyMarkdownButton(e, [
          { key: 'a', values: ['#'] },
          { key: 'b', values: ['恶魔轮盘赌\r> ❌ 错误\r'] },
          { key: 'c', values: ['你不能同意自己的请求！'] }
        ])
      ]);
      return;
    }

    // 生成玩家状态显示
    const playerAvatars = session.players.map((p, index) => {
      const playerId = String(p.id).split(':').pop();
      return [
        { key: ['e', 'g'][index], values: [`![玩家 #25px #25px](https://q.qlogo.cn/qqapp/102059511/${playerId}/640`] },
        { key: ['f', 'h'][index], values: [`)(${p.hp}❤️)`] }
      ];
    }).flat();

    await replyMarkdownButton(e, [
      { key: 'a', values: ['#'] },
      { key: 'b', values: ['恶魔轮盘赌\r> 🤝 游戏和平结束\r'] },
      { key: 'c', values: ['最终状态：'] },
      ...playerAvatars
    ], [
      [
        { text: '再来一局', callback: '/恶魔轮盘赌', clicked_text: '正在重新开始' }
      ]
    ]);

    // 清除redis中的游戏状态
    await GameStateManager.clearGameState(groupId);
    DemonGame[groupId] = null;
  }

  async rejectEndGame(e) {
    if (!isQQBot(e)) { await e.reply('请艾特六阶堂穗玉使用'); return false }

    const groupId = e.group_id;
    const session = DemonGame[groupId];

    if (!session || session.status !== 'playing') {
      await e.reply('当前没有进行中的游戏');
      return;
    }

    if (!session.endGameRequest || session.endGameRequest.status !== 'pending') {
      await e.reply('当前没有待处理的结束游戏请求');
      return;
    }

    if (e.user_id === session.endGameRequest.requesterId) {
      await e.reply('你不能拒绝自己的请求！');
      return;
    }

    // 清除结束游戏请求
    session.endGameRequest = null;

    // 不显示拒绝消息，如果对方不点击同意就继续游戏
  }

  async showRules(e) {
    if (!isQQBot(e)) { await e.reply('请艾特六阶堂穗玉使用'); return false }

    const rules = [
      '🎯 游戏规则',
      '1. 这是一个双人对战游戏，每位玩家初始有5点生命值',
      '2. 游戏开始时，每位玩家随机获得8种道具',
      '3. 每个回合玩家可以选择开枪或使用道具',
      '4. 开枪可以选择射击自己或对方',
      '5. 实弹造成1点伤害，空弹无伤害',
      '6. 连续3次对自己空枪可获得香烟奖励',
      '7. 生命值归零或主动认输即被淘汰',
      '',
      '🎁 道具说明',
      '• 香烟：恢复1点生命值（可无限使用）',
      '• 放大镜：查看下一发子弹',
      '• 手铐：跳过对方回合',
      '• 锯子：下一发实弹伤害+1',
      '• 饮料：弹出当前子弹',
      '• 逆转器：改变当前子弹类型',
      '• 肾上腺素：盗取并使用对方道具',
      '• 电话：查看随机一发剩余子弹',
      '• 过期药：50%概率回2血，50%概率掉1血',
      '',
      '⚠️ 道具使用规则',
      '1. 除香烟外，每种道具每回合限用一次',
      '2. 放大镜与锯子、逆转器、饮料互斥',
      '3. 道具效果立即生效',
      '',
      '🎮 基本指令',
      '• /恶魔轮盘赌 - 创建游戏',
      '• /加入轮盘赌 - 加入游戏',
      '• /开枪 - 选择开枪目标',
      '• /道具 - 查看/使用道具',
      '• /认输 - 主动认输',
      '• /结束游戏 - 申请结束游戏'
    ].join('\r');

    await replyMarkdownButton(e, [
      { key: 'a', values: ['#'] },
      { key: 'b', values: ['恶魔轮盘赌\r> 📖 游戏规则说明\r\r'] },
      { key: 'c', values: [rules] }
    ], [
      [
        { text: '开始游戏', callback: '/恶魔轮盘赌', clicked_text: '正在创建游戏' }
      ]
    ]);
  }
}