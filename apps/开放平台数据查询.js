import fetch from 'node-fetch';
import fs from 'fs';
import { isQQBot, replyMarkdownButton } from '../components/CommonReplyUtil.js'

const base = 'https://i.elaina.vin/bot'
const loginurl = `${base}/get_login.php`
const get_login = `${base}/robot.php`
const message = `${base}/message.php`
const botlist = `${base}/bot_list.php`
const botdata = `${base}/bot_data.php`
const file = `${process.cwd().replace(/\\/g, '/')}/data/robot.json`

const commonButtons = [
  [
    { text: '通知', callback: 'bot通知' },
    { text: '数据', callback: 'bot数据' },
    { text: '列表', callback: 'bot列表' }
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
        { reg: "^(#|\/)?bot数据$", fnc: 'get_botdata' },
      ]
    });
    this.user = {}
  }

  async login(e) {
    if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }
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
      { key: 'f', values: [`\r## 当你选择登录，代表你已经同意将数据托管给橙子BOT。`] }
    ];
    let buttonArr = [
      [
        {
          text: '点击登录',
          link: url,
          clicked_text: '已登录',
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
            key: 'f', values: [`\r## 登录类型：${((appType) => {
              if (appType == "0") return '小程序'
              else if (appType == "2") return 'QQ机器人'
              else return '未知'
            })(data.appType)}`]
          },
          { key: 'g', values: [`\r## AppId：${data.appId}`] }
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
    if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }
    let user = e.user_id
    try { this.user = JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { }
    if (!this.user[user]) {
      return replyMarkdownButton(e, [
        { key: 'a', values: [`未查询到你的登录信息`] }
      ], [
        [
          { text: '登录', callback: '管理登录' }
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
          { text: '登录', callback: '管理登录' }
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
    if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }
    let user = e.user_id
    try { this.user = JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { }
    if (!this.user[user]) {
      return replyMarkdownButton(e, [
        { key: 'a', values: [`未查询到你的登录信息`] }
      ], [
        [
          { text: '登录', callback: '管理登录' }
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
          { text: '登录', callback: '管理登录' }
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
      { key: 'g', values: [`\`\`${botContent.join('\r')}`] },
      { key: 'h', values: ['``'] },
      { key: 'i', values: ['`'] }
    ], commonButtons)
  }

  async get_botdata(e) {
    if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }
    let user = e.user_id
    try { this.user = JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { }
    if (!this.user[user]) {
      return replyMarkdownButton(e, [
        { key: 'a', values: [`未查询到你的登录信息`] }
      ], [
        [
          { text: '登录', callback: '管理登录' }
        ]
      ])
    }

    let data = this.user[user]
    let data1 = await (await fetch(`${botdata}?appid=${data.appId}&uin=${data.uin}&ticket=${data.ticket}&developerId=${data.developerId}&type=1`)).json()
    let data2 = await (await fetch(`${botdata}?appid=${data.appId}&uin=${data.uin}&ticket=${data.ticket}&developerId=${data.developerId}&type=2`)).json()
    let data3 = await (await fetch(`${botdata}?appid=${data.appId}&uin=${data.uin}&ticket=${data.ticket}&developerId=${data.developerId}&type=3`)).json()

    console.log('API Response:', { data1, data2, data3 });

    if ([data1.retcode, data2.retcode, data3.retcode].some(code => code !== 0)) {
      return replyMarkdownButton(e, [
        { key: 'a', values: [`登录状态失效`] }
      ], [
        [
          { text: '登录', callback: '管理登录' }
        ]
      ])
    }

    try {
      let day1 = formatDayData(data1.data.msg_data, data2.data.group_data, data3.data.friend_data, 0)
      let day2 = formatDayData(data1.data.msg_data, data2.data.group_data, data3.data.friend_data, 1)
      let day3 = formatDayData(data1.data.msg_data, data2.data.group_data, data3.data.friend_data, 2)

      return replyMarkdownButton(e, [
        { key: 'a', values: [`<@${user?.slice(11)}>\r`] },
        { key: 'b', values: ['#'] },
        { key: 'c', values: ['机器人数据'] },
        { key: 'd', values: [`\r> 最近三日汇总如下\r\r`] },
        { key: 'e', values: [`***`] },
        { key: 'f', values: ['\r\r``'] },
        { key: 'g', values: [`\`${day1}\r\r——————`] },
        { key: 'h', values: [`\r${day2}\r\r——————\r${day3}\`\``] },
        { key: 'i', values: ['`'] }
      ], commonButtons)
    } catch (e) {
      console.error('Error in get_botdata:', e);
      return replyMarkdownButton(e, [
        { key: 'a', values: [`数据处理出错，请稍后再试`] }
      ], commonButtons)
    }
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}