import fetch from 'node-fetch';
import fs from 'fs';
import { isQQBot, replyMarkdownButton } from '../components/CommonReplyUtil.js'

const base = 'https://191800.xyz/bot'
const loginurl = `${base}/get_login.php`
const get_login = `${base}/robot.php`
const message = `${base}/message.php`
const botlist = `${base}/bot_list.php`
const botdata = `${base}/bot_data.php`
const tpl_list = `${base}/msg_tpl_list.php`
const file = `${process.cwd().replace(/\\/g, '/')}/data/robot.json`

const commonButtons = [
  [
    { text: '通知', callback: 'bot通知', clicked_text: '正在获取通知' },
    { text: '数据', callback: 'bot数据', clicked_text: '正在获取数据' },
    { text: '列表', callback: 'bot列表', clicked_text: '正在获取列表' }
  ]
];

export class robot_data extends plugin {
  constructor() {
    super({
      name: '查询QQbot数据',
      dsc: '？？？',
      event: 'message',
      priority: 5000,
      rule: [
        { reg: "^(#|\/)?管理登录$", fnc: 'login' },
        { reg: "^(#|\/)?bot通知$", fnc: 'get_message' },
        { reg: "^(#|\/)?bot列表$", fnc: 'get_botlist' },
        { reg: "^(#|\/)?bot数据(\\d*)?$", fnc: 'get_botdata' },
        { reg: "^(#|\/)?bot模板$", fnc: 'get_bottpl' },
      ]
    });
    this.user = {}
  }

  async login(e) {
    if (!isQQBot(e)) { await e.reply('请艾特六阶堂穗玉使用'); return false }
    let user = e.user_id
    this.user[user] = { type: 'login' }
    let data = await (await fetch(loginurl)).json()
    let url = data.url
    let qr = data.qr

    let replyArr = [
      { key: 'a', values: [`<@${user?.slice(11)}>\r`] },
      { key: 'b', values: ['#'] },
      { key: 'c', values: ['QQ开发平台管理端登录'] },
      { key: 'd', values: [`\r> 登录具有时效性，请尽快登录\r\r`] },
      { key: 'e', values: [`***`] },
      { key: 'f', values: [`\r> 当你选择登录，代表你已经同意将数据托管给六阶堂穗玉。`] }
    ];
    let buttonArr = [
      [
        {
          text: '点击登录',
          link: url,
          clicked_text: '正在跳转登录',
          style: 4,
          ...(e.isGroup ? {
            permission: user,
            unsupport_tips: '仅限指定用户使用'
          } : {}),
          click_limit: 1
        }
      ]
    ];
    await replyMarkdownButton(e, replyArr, buttonArr);
    let i = 0;
    while (i < 20) {
      let res = await (await fetch(`${get_login}?qrcode=${qr}`)).json();
      if (res.code == 0) {
        let data = res.data.data
        try { this.user = JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { }
        this.user[user] = { type: 'ok', ...data }
        fs.writeFileSync(file, JSON.stringify(this.user, null, 2))
        return replyMarkdownButton(e, [
          { key: 'a', values: [`<@${user?.slice(11)}>\r`] },
          { key: 'b', values: ['#'] },
          { key: 'c', values: ['登录成功'] },
          { key: 'd', values: [`\r> ${data.uin}\r\r`] },
          { key: 'e', values: [`***`] },
          {
            key: 'f', values: [`\r> 登录类型：${((appType) => {
              if (appType == "0") return '小程序'
              else if (appType == "2") return 'QQ机器人'
              else return '未知'
            })(data.appType)}`]
          },
          { key: 'g', values: [`\rAppId：${data.appId}`] }
        ], commonButtons)
      }
      i++;
      await sleep(3000);
    }
    return replyMarkdownButton(e, [
      { key: 'a', values: [`登录失效`] }
    ])
  }

  async get_message(e) {
    if (!isQQBot(e)) { await e.reply('请艾特六阶堂穗玉使用'); return false }
    let user = e.user_id
    try { this.user = JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { }
    if (!this.user[user]) {
      return replyMarkdownButton(e, [
        { key: 'a', values: [`未查询到你的登录信息`] }
      ], [
        [
          { text: '登录', callback: '管理登录', clicked_text: '正在登录' }
        ]
      ])
    }

    let data = this.user[user]
    let res = await (await fetch(`${message}?uin=${data.uin}&ticket=${data.ticket}&developerId=${data.developerId}`)).json()
    if (res.code != 0) {
      return replyMarkdownButton(e, [
        { key: 'a', values: [`登录状态失效`] }
      ], [
        [
          { text: '登录', callback: '管理登录', clicked_text: '正在登录' }
        ]
      ])
    }

    let msgContent = []
    for (let j = 0; j < Math.min(res.messages.length, 8); j++) {
      if (j > 0) msgContent.push('——————')
      let content = res.messages[j].content.split("\n\n")[0].trim().replace(/\n/g, '\r')
      msgContent.push(content)
      msgContent.push(res.messages[j].send_time)
    }

    return replyMarkdownButton(e, [
      { key: 'a', values: [`<@${user?.slice(11)}>\r`] },
      { key: 'b', values: [`\rUin:${data.uin}\rAppid:${data.appId}\r\r`] },
      { key: 'c', values: [`***\r`] },
      { key: 'd', values: [`\r> 以下是最近的通知\r\r`] },
      { key: 'e', values: ['`'] },
      { key: 'f', values: [`\`\`\r${msgContent.join('\r')}`] },
      { key: 'g', values: ['``'] },
      { key: 'h', values: ['`'] }
    ], commonButtons)
  }

  async get_botlist(e) {
    if (!isQQBot(e)) { await e.reply('请艾特六阶堂穗玉使用'); return false }
    let user = e.user_id
    try { this.user = JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { }
    if (!this.user[user]) {
      return replyMarkdownButton(e, [
        { key: 'a', values: [`未查询到你的登录信息`] }
      ], [
        [
          { text: '登录', callback: '管理登录', clicked_text: '正在登录' }
        ]
      ])
    }

    let data = this.user[user]
    let res = await (await fetch(`${botlist}?uin=${data.uin}&ticket=${data.ticket}&developerId=${data.developerId}`)).json()
    if (res.code != 0) {
      return replyMarkdownButton(e, [
        { key: 'a', values: [`登录状态失效`] }
      ], [
        [
          { text: '登录', callback: '管理登录', clicked_text: '正在登录' }
        ]
      ])
    }

    let botContent = []
    for (let j = 0; j < res.data.apps.length; j++) {
      if (j > 0) botContent.push('——————')
      botContent.push(`Bot:${res.data.apps[j].app_name.replace(/\n/g, '\r')}`)
      botContent.push(`AppId:${res.data.apps[j].app_id}`)
      botContent.push(`介绍:${res.data.apps[j].app_desc.replace(/\n/g, '\r')}`)
    }

    return replyMarkdownButton(e, [
      { key: 'a', values: [`<@${user?.slice(11)}>\r`] },
      { key: 'b', values: ['#'] },
      { key: 'c', values: [' Bot列表'] },
      { key: 'd', values: [`\r> 当前账户绑定的Bot如下\r\r`] },
      { key: 'e', values: [`***\r`] },
      { key: 'f', values: ['`'] },
      { key: 'g', values: [`\`\`\r${botContent.join('\r')}`] },
      { key: 'h', values: ['``'] },
      { key: 'i', values: ['`'] }
    ], commonButtons)
  }

  async get_botdata(e) {
    if (!isQQBot(e)) { await e.reply('请艾特六阶堂穗玉使用'); return false }
    let user = e.user_id
    try { this.user = JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { }
    if (!this.user[user]) {
      return replyMarkdownButton(e, [
        { key: 'a', values: [`未查询到你的登录信息`] }
      ], [
        [
          { text: '登录', callback: '管理登录', clicked_text: '正在登录' }
        ]
      ])
    }

    let data = this.user[user]
    let data1 = await (await fetch(`${botdata}?appid=${data.appId}&uin=${data.uin}&ticket=${data.ticket}&developerId=${data.developerId}&type=1`)).json()
    let data2 = await (await fetch(`${botdata}?appid=${data.appId}&uin=${data.uin}&ticket=${data.ticket}&developerId=${data.developerId}&type=2`)).json()
    let data3 = await (await fetch(`${botdata}?appid=${data.appId}&uin=${data.uin}&ticket=${data.ticket}&developerId=${data.developerId}&type=3`)).json()

    if ([data1.retcode, data2.retcode, data3.retcode].some(code => code !== 0)) {
      return replyMarkdownButton(e, [
        { key: 'a', values: [`登录状态失效`] }
      ], [
        [
          { text: '登录', callback: '管理登录', clicked_text: '正在登录' }
        ]
      ])
    }

    try {
      // 获取展示天数
      let match = e.msg?.match(/bot数据(\d*)/);
      let showDays = 4; // Default to 4 days if no valid number is provided

      if (match && match[1] !== undefined) {
        let parsedDays = parseInt(match[1], 10);
        if (!isNaN(parsedDays)) {
          showDays = parsedDays;
        }
        // If parsedDays is NaN (e.g., bot数据abc or bot数据), showDays remains the default 4
      }
      // If match or match[1] is undefined (e.g., bot数据), showDays remains the default 4

      let msgDataArr = data1.data.msg_data || [];
      let groupDataArr = data2.data.group_data || [];
      let friendDataArr = data3.data.friend_data || [];
      let totalDAU = 0, dauCount = 0;
      for (let item of msgDataArr) {
        let val = Number(item['上行消息人数'] || 0);
        totalDAU += val;
        dauCount++;
      }
      let avgDAU = dauCount ? Math.round(totalDAU / dauCount) : 0;
      
      let resultArr = [];
      let contentText = '';
      let titleText = '';
      
      if (showDays === 0) {
        contentText = `没办法啊，你自己要显示0天的`;
        titleText = `最近${resultArr.length}日汇总如下\r${msgDataArr.length}日平均DAU：${avgDAU}`;
      } else {
        for (let i = 0; i < Math.min(showDays, msgDataArr.length); i++) {
          resultArr.push(formatDayDataV2(msgDataArr, groupDataArr, friendDataArr, i));
        }
        contentText = resultArr.join('\r\r——————\r');
        titleText = `最近${resultArr.length}日汇总如下\r${msgDataArr.length}日平均DAU：${avgDAU}`;
      }
      
      return replyMarkdownButton(e, [
        { key: 'a', values: [`<@${user?.slice(11)}>\r`] },
        { key: 'b', values: ['#'] },
        { key: 'c', values: ['Bot数据'] },
        { key: 'd', values: [`\r> ${titleText}\r`] },
        { key: 'e', values: ['***'] },
        { key: 'f', values: ['\r\r``'] },
        { key: 'g', values: [`\`\r${contentText}\r`] },
        { key: 'h', values: ['``'] },
        { key: 'i', values: ['`'] }
      ], commonButtons)
    } catch (e) {
      console.error('Error in get_botdata:', e);
      return replyMarkdownButton(e, [
        { key: 'a', values: [`数据处理出错，请稍后再试`] }
      ], commonButtons)
    }
  }

  async get_bottpl(e) {
    if (!isQQBot(e)) { await e.reply('请艾特六阶堂穗玉使用'); return false }
    let user = e.user_id
    try { this.user = JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { }
    if (!this.user[user]) {
      return replyMarkdownButton(e, [
        { key: 'a', values: [`未查询到你的登录信息`] }
      ], [
        [
          { text: '登录', callback: '管理登录', clicked_text: '正在登录' }
        ]
      ])
    }

    let data = this.user[user]
    let appId = e.msg.replace('bot模板', '') || data.appId
    let res = await (await fetch(`${tpl_list}?appid=${appId}&uin=${data.uin}&ticket=${data.ticket}&developerId=${data.developerId}`)).json()
    
    if (res.retcode != 0) {
      return replyMarkdownButton(e, [
        { key: 'a', values: [`登录状态失效`] }
      ], [
        [
          { text: '登录', callback: '管理登录', clicked_text: '正在登录' }
        ]
      ])
    }

    let apps = res.data.list
    let max = res.data.max_msg_tpl_count
    let tplContent = []
    
    tplContent.push(`模板使用：${apps.length}/${max}`)
    
    for (let j = 0; j < apps.length; j++) {
      if (j > 0) tplContent.push('——————')
      let t = ['', '按钮', 'Markdown']
      let s = ['', '未提审', '审核中', '已通过', '未通过']
      tplContent.push(`模板ID：${apps[j].tpl_id}`)
      tplContent.push(`模板名字：${apps[j].tpl_name}`)
      tplContent.push(`模板类型：${t[apps[j].tpl_type]}`)
      tplContent.push(`状态：${s[apps[j].status]}`)
    }

    console.log('Template Content:', tplContent)
    
    let replyArr = [
      { key: 'a', values: ['\r\r#Bot模板列表'] },
      { key: 'b', values: [`\r账号：${data.uin}\rAppId：${appId}\r\r> 当前账户的模板列表如下\r\r`] },
      { key: 'c', values: [`***\r`] },
      { key: 'd', values: ['`'] },
      { key: 'e', values: [`\`\`\r${tplContent.join('\r')}`] },
      { key: 'f', values: ['``'] },
      { key: 'g', values: ['`'] }
    ]
    
    console.log('Reply Array:', replyArr)
    
    return replyMarkdownButton(e, replyArr, commonButtons)
  }
}

function formatDayData(msg_data, group_data, friend_data, index) {
  const formatData = (data, idx) => {
    try {
      const item = data[idx] || {};
      console.log('Raw item:', item); // 打印原始数据
      const toString = val => {
        if (val === undefined || val === null) return '0';
        return String(val).replace(/\n/g, '\r');
      };
      return {
        报告日期: toString(item['报告日期']),
        上行消息量: toString(item['上行消息量']),
        上行消息人数: toString(item['上行消息人数']),
        下行消息量: toString(item['下行消息量']),
        总消息量: toString(item['总消息量']),
        现有群组: toString(item['现有群组']),
        已使用群组: toString(item['已使用群组']),
        新增群组: toString(item['新增群组']),
        移除群组: toString(item['移除群组']),
        现有好友数: toString(item['现有好友数']),
        已使用好友数: toString(item['已使用好友数']),
        新增好友数: toString(item['新增好友数']),
        移除好友数: toString(item['移除好友数']),
      };
    } catch (e) {
      console.error('Error in formatData:', e);
      // 返回默认值
      return {
        报告日期: '0',
        上行消息量: '0',
        上行消息人数: '0',
        下行消息量: '0',
        总消息量: '0',
        现有群组: '0',
        已使用群组: '0',
        新增群组: '0',
        移除群组: '0',
        现有好友数: '0',
        已使用好友数: '0',
        新增好友数: '0',
        移除好友数: '0',
      };
    }
  }

  try {
    console.log('Input data:', { msg_data, group_data, friend_data, index }); // 打印输入数据
    const data = formatData(msg_data, index);
    const group = formatData(group_data, index);
    const friend = formatData(friend_data, index);

    return `【${data.报告日期}】\r消息统计：\r上行：${data.上行消息量} (${data.上行消息人数}人)\r下行：${data.下行消息量}\r总量：${data.总消息量}\r群组统计：\r现有：${group.现有群组} 已用：${group.已使用群组}\r新增：${group.新增群组} 减少：${group.移除群组}\r好友统计：\r现有：${friend.现有好友数} 已用：${friend.已使用好友数}\r新增：${friend.新增好友数} 减少：${friend.移除好友数}`
  } catch (e) {
    console.error('Error in formatDayData:', e);
    return '数据格式化错误';
  }
}

function formatDayDataV2(msg_data, group_data, friend_data, index) {
  const getVal = (arr, idx, key) => {
    if (!arr || !arr[idx] || arr[idx][key] === undefined || arr[idx][key] === null) return '0';
    return String(arr[idx][key]).replace(/\n/g, '\r');
  };
  const date = getVal(msg_data, index, '报告日期');
  const upMsg = getVal(msg_data, index, '上行消息量');
  const upUser = getVal(msg_data, index, '上行消息人数');
  const downMsg = getVal(msg_data, index, '下行消息量');
  const totalMsg = getVal(msg_data, index, '总消息量');
  const groupNew = getVal(group_data, index, '新增群组');
  const groupDel = getVal(group_data, index, '移除群组');
  const groupNow = getVal(group_data, index, '现有群组');
  const groupUsed = getVal(group_data, index, '已使用群组');
  const friendNew = getVal(friend_data, index, '新增好友数');
  const friendDel = getVal(friend_data, index, '移除好友数');
  const friendNow = getVal(friend_data, index, '现有好友数');
  const friendUsed = getVal(friend_data, index, '已使用好友数');
  return `【日期：${date}】\r消息统计:\r上行：${upMsg}  人数：${upUser}\r总量：${totalMsg}  下行：${downMsg}\r群组统计：\r新增：${groupNew}  减少：${groupDel}\r已有：${groupNow}  使用：${groupUsed}\r好友统计：\r新增：${friendNew}  减少：${friendDel}\r已有：${friendNow}  使用：${friendUsed}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}