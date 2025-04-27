import plugin from "../../../lib/plugins/plugin.js";
import fs from 'fs'
import path from 'path'
import { isQQBot, replyMarkdownButton } from '../components/CommonReplyUtil.js'

const dataDir = path.join(process.cwd(), 'plugins/Kevin-plugin/data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dataFile = path.join(dataDir, 'food_drink_data.json')
const pendingFile = path.join(dataDir, 'pending_items.json')

const pluginName = '今天的吃喝'

// 默认数据
const defaultData = {
  foods: [
    "火锅", "烤肉", "炒面", "炒饭", "盖浇饭", "水饺", 
    "牛肉面", "兰州拉面", "麻辣烫", "肯德基", "麦当劳",
    "汉堡王", "寿司", "生煎", "小笼包", "煎饼果子",
    "沙县小吃", "黄焖鸡米饭", "酸菜鱼", "烧烤"
  ],
  drinks: [
    "可乐", "雪碧", "果粒橙", "芬达", "奶茶",
    "咖啡", "柠檬茶", "绿茶", "矿泉水", "果汁",
    "酸奶", "豆浆", "椰汁", "蜂蜜水", "冰红茶",
    "珍珠奶茶", "柚子茶", "苏打水", "热牛奶"
  ]
}

const defaultPending = {
  foods: [],
  drinks: []
}

export class example extends plugin {
  constructor() {
    super({
      name: '吃&喝什么',
      dsc: '吃&喝什么',
      event: 'message',
      priority: -50000000,
      rule: [
        {
          reg: '^[#\/]?今天(吃什么|喝什么)(\\?|？)?$',
          fnc: 'randomFood'
        },
        {
          reg: '^[#\/]?添加(食物|饮品)(.+)$',
          fnc: 'addItem'
        },
        {
          reg: '^[#\/]?查看(食物|饮品)列表(\\s*\\d+)?$',
          fnc: 'listItems'
        },
        {
          reg: '^[#\/]?查看待审核(食物|饮品)$',
          fnc: 'listPending',
          permission: 'master'  // 只有主人可以查看待审核列表
        },
        {
          reg: '^[#\/]?通过(食物|饮品)(.+)$',
          fnc: 'approveItem',
          permission: 'master'  // 只有主人可以审核
        },
        {
          reg: '^[#\/]?拒绝(食物|饮品)(.+)$',
          fnc: 'rejectItem',
          permission: 'master'  // 只有主人可以审核
        },
        {
          reg: '^[#\/]?删除(食物|饮品)(.+)$',
          fnc: 'deleteItem'
        },
        {
          reg: '^[#\/]?查重$',
          fnc: 'checkAllDuplicates'
        },
        {
          reg: '^[#\/]?(吃喝帮助|食饮帮助)$',
          fnc: 'help'
        }
      ]
    })
    
    this.initializeData()
  }

  initializeData() {
    // 只初始化待审核文件，主数据文件由全局统一管理
    if (!fs.existsSync(path.dirname(pendingFile))) {
      fs.mkdirSync(path.dirname(pendingFile), { recursive: true })
    }
    if (!fs.existsSync(pendingFile)) {
      this.savePending(defaultPending)
    }
  }

  loadData() {
    try {
      const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
      return {
        foods: data.foods || defaultData.foods,
        drinks: data.drinks || defaultData.drinks
      }
    } catch (error) {
      return defaultData
    }
  }

  loadPending() {
    try {
      const data = JSON.parse(fs.readFileSync(pendingFile, 'utf8'))
      return {
        foods: data.foods || [],
        drinks: data.drinks || []
      }
    } catch (error) {
      return defaultPending
    }
  }

  saveData(data) {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2))
  }

  savePending(data) {
    fs.writeFileSync(pendingFile, JSON.stringify(data, null, 2))
  }

  async randomFood(e) {
    if (!isQQBot(e)) {
      await e.reply('请艾特橙子BOT使用')
      return false
    }
    const isFood = e.msg.includes('吃什么')
    const type = isFood ? 'foods' : 'drinks'
    const data = this.loadData()
    const list = data[type]
    
    if (list.length === 0) {
      await e.reply(`暂时没有${isFood ? '食物' : '饮品'}数据`)
      return true
    }

    const randomItem = list[Math.floor(Math.random() * list.length)]
    let prefix = isFood ? '那么今天就吃……' : '那么今天就喝……'
    let message = `${prefix}${randomItem}吧！`
    
    // 检查是否是周四且抽到了肯德基
    if (isFood && randomItem === '肯德基' && new Date().getDay() === 4) {
      message = '今天肯定得吃肯德基啊！'
    }
    
    const buttonText = `换一个${isFood ? '食物' : '饮品'}`
    const callback = isFood ? '今天吃什么' : '今天喝什么'
    
    return replyMarkdownButton(e, [
      { key: 'a', values: ['#'] },
      { key: 'b', values: [isFood ? '今日吃什么' : '今日喝什么'] },
      { key: 'c', values: [`\r> ${message}`] }
    ], [
      [{ text: buttonText, callback: callback }]
    ])
  }

  async addItem(e) {
    if (!isQQBot(e)) {
      await e.reply('请艾特橙子BOT使用')
      return false
    }
    const isFood = e.msg.includes('食物')
    const type = isFood ? 'foods' : 'drinks'
    
    const newItem = e.msg.replace(/^添加(食物|饮品)/, '').trim()
    
    if (!newItem) {
      await e.reply('请指定要添加的内容')
      return true
    }

    const data = this.loadData()
    
    // 检查是否已在正式列表中
    if (data[type].includes(newItem)) {
      await e.reply(`该${isFood ? '食物' : '饮品'}已存在`)
      return true
    }

    // 判断是否为主人
    if (this.e.isMaster) {
      // 主人直接添加到正式列表
      data[type].push(newItem)
      this.saveData(data)
      await e.reply(`已添加${isFood ? '食物' : '饮品'}：${newItem}`)
    } else {
      // 非主人添加到待审核列表
      const pending = this.loadPending()
      // 检查是否已在待审核列表中
      if (pending[type].includes(newItem)) {
        await e.reply(`该${isFood ? '食物' : '饮品'}已在待审核列表中`)
        return true
      }
      pending[type].push(newItem)
      this.savePending(pending)
      await e.reply(`已将${isFood ? '食物' : '饮品'}：${newItem} 添加到待审核列表`)
    }
    
    return true
  }

  async listItems(e) {
    if (!isQQBot(e)) {
      await e.reply('请艾特橙子BOT使用')
      return false
    }
    const isFood = e.msg.includes('食物')
    const type = isFood ? 'foods' : 'drinks'
    const data = this.loadData()
    const list = data[type]
    
    if (list.length === 0) {
      await e.reply(`暂时没有${isFood ? '食物' : '饮品'}数据`)
      return true
    }

    // 获取页码，默认为第1页
    const pageMatch = e.msg.match(/\d+/)
    const currentPage = pageMatch ? parseInt(pageMatch[0]) : 1
    const pageSize = 40
    const totalPages = Math.ceil(list.length / pageSize)

    // 确保页码在有效范围内
    if (currentPage < 1 || currentPage > totalPages) {
      await e.reply(`页码无效，总共${totalPages}页`)
      return true
    }

    // 计算当前页的数据
    const start = (currentPage - 1) * pageSize
    const end = Math.min(start + pageSize, list.length)
    const currentPageItems = list.slice(start, end)

    // 构建消息
    let replyArr = [
      { key: 'a', values: ['#'] },
      { key: 'b', values: [` ${isFood ? '食物' : '饮品'}列表`] },
      { key: 'c', values: [`\r> 第${currentPage}页/共${totalPages}页\r\r`] },
      { key: 'd', values: ['`'] },
      { key: 'e', values: [`\`\`${currentPageItems.join('、')}`] },
      { key: 'f', values: ['``'] },
      { key: 'g', values: ['`'] }
    ]
    let buttonArr = []
    if (currentPage > 1 || currentPage < totalPages) {
      let buttons = []
      if (currentPage > 1) {
        buttons.push({ text: '上一页', callback: `查看${isFood ? '食物' : '饮品'}列表 ${currentPage - 1}` })
      }
      if (currentPage < totalPages) {
        buttons.push({ text: '下一页', callback: `查看${isFood ? '食物' : '饮品'}列表 ${currentPage + 1}` })
      }
      buttonArr.push(buttons)
    }
    await replyMarkdownButton(e, replyArr, buttonArr)
    return true
  }

  async listPending(e) {
    if (!isQQBot(e)) {
      await e.reply('请艾特橙子BOT使用')
      return false
    }
    const isFood = e.msg.includes('食物')
    const type = isFood ? 'foods' : 'drinks'
    const pending = this.loadPending()
    const list = pending[type]
    
    if (list.length === 0) {
      await e.reply(`暂时没有待审核的${isFood ? '食物' : '饮品'}`)
      return true
    }

    const message = `待审核的${isFood ? '食物' : '饮品'}列表：\n${list.join('、')}`
    await e.reply(message)
    return true
  }

  async approveItem(e) {
    if (!isQQBot(e)) {
      await e.reply('请艾特橙子BOT使用')
      return false
    }
    const isFood = e.msg.includes('食物')
    const type = isFood ? 'foods' : 'drinks'
    const itemName = e.msg.replace(/^通过(食物|饮品)/, '').trim()
    
    const data = this.loadData()
    const pending = this.loadPending()
    
    if (!pending[type].includes(itemName)) {
      await e.reply(`待审核列表中没有找到该${isFood ? '食物' : '饮品'}`)
      await this.reply(`待审核列表中没有找到该${isFood ? '食物' : '饮品'}`)
      return true
    }

    // 从待审核列表中移除
    pending[type] = pending[type].filter(item => item !== itemName)
    this.savePending(pending)
    
    // 添加到正式列表
    data[type].push(itemName)
    this.saveData(data)
    
    await this.reply(`已通过${isFood ? '食物' : '饮品'}：${itemName}`)
    return true
  }

  async rejectItem(e) {
    const isFood = e.msg.includes('食物')
    const type = isFood ? 'foods' : 'drinks'
    const itemName = e.msg.replace(/^拒绝(食物|饮品)/, '').trim()
    
    const pending = this.loadPending()
    
    if (!pending[type].includes(itemName)) {
      await this.reply(`待审核列表中没有找到该${isFood ? '食物' : '饮品'}`)
      return true
    }

    // 从待审核列表中移除
    pending[type] = pending[type].filter(item => item !== itemName)
    this.savePending(pending)
    
    await this.reply(`已拒绝${isFood ? '食物' : '饮品'}：${itemName}`)
    return true
  }

  async deleteItem(e) {
    if (!isQQBot(e)) {
      await e.reply('请艾特橙子BOT使用')
      return false
    }
    const isFood = e.msg.includes('食物')
    const type = isFood ? 'foods' : 'drinks'
    const item = e.msg.replace(/^删除(食物|饮品)/, '').trim()
    if (!item) {
      await e.reply('请指定要删除的内容')
      return true
    }
    const data = this.loadData()
    const pending = this.loadPending()
    // 主人可直接删除正式列表
    if (this.e.isMaster) {
      if (!data[type].includes(item)) {
        await e.reply(`正式列表中没有该${isFood ? '食物' : '饮品'}`)
        return true
      }
      data[type] = data[type].filter(i => i !== item)
      this.saveData(data)
      await e.reply(`已从正式列表删除${isFood ? '食物' : '饮品'}：${item}`)
      return true
    }
    // 普通用户只能删除自己添加且未审核的内容
    if (!pending[type].includes(item)) {
      await e.reply(`待审核列表中没有该${isFood ? '食物' : '饮品'}，或你无权删除`)
      return true
    }
    pending[type] = pending[type].filter(i => i !== item)
    this.savePending(pending)
    await e.reply(`已从待审核列表删除${isFood ? '食物' : '饮品'}：${item}`)
    return true
  }

  async checkAllDuplicates(e) {
    if (!isQQBot(e)) {
      await e.reply('请艾特橙子BOT使用')
      return false
    }
    const data = this.loadData()
    const pending = this.loadPending()
    // 合并正式和待审核食物
    const allFoods = [...data.foods, ...pending.foods]
    const foodCountMap = {}
    for (const food of allFoods) {
      foodCountMap[food] = (foodCountMap[food] || 0) + 1
    }
    const foodDuplicates = Object.entries(foodCountMap).filter(([food, count]) => count > 1)
    // 合并正式和待审核饮品
    const allDrinks = [...data.drinks, ...pending.drinks]
    const drinkCountMap = {}
    for (const drink of allDrinks) {
      drinkCountMap[drink] = (drinkCountMap[drink] || 0) + 1
    }
    const drinkDuplicates = Object.entries(drinkCountMap).filter(([drink, count]) => count > 1)
    if (foodDuplicates.length === 0 && drinkDuplicates.length === 0) {
      await e.reply('未发现重复的食物或饮品。')
      return true
    }
    let msg = ''
    if (foodDuplicates.length > 0) {
      msg += '发现以下重复食物：\n'
      msg += foodDuplicates.map(([food, count]) => `${food}（共${count}次）`).join('\n') + '\n'
    }
    if (drinkDuplicates.length > 0) {
      msg += '发现以下重复饮品：\n'
      msg += drinkDuplicates.map(([drink, count]) => `${drink}（共${count}次）`).join('\n')
    }
    await e.reply(msg.trim())
    return true
  }

  async help(e) {
    const helpText = `食饮插件指令说明：
    
1、随机推荐：
  今天吃什么   今天喝什么

2、查看列表：
  查看食物列表  查看饮品列表

3、添加新项目：
  添加食物xxx  添加饮品xxx


4、管理员指令：
  查看待审核食物  查看待审核饮品
  通过食物xxx     通过饮品xxx
  拒绝食物xxx     拒绝饮品xxx`


    await this.reply(helpText)
    return true
  }
}