import fetch from 'node-fetch'
import YAML from 'yaml'
import fs from 'fs'
import path from 'path'
import { isQQBot, replyMarkdownButton } from '../components/CommonReplyUtil.js'

// 存储用户搜索结果
const UserMusicResults = {};

// 配置文件路径
// const DATA_DIR = path.join(process.cwd(), 'plugins/example/musicShare/data')
// const CONFIG_PATH = path.join(DATA_DIR, 'config.yaml')
const CONFIG_PATH = path.join(process.cwd(), 'plugins/Kevin-plugin/config/config.yaml')

// 确保目录存在
if (!fs.existsSync(process.cwd())) {
  fs.mkdirSync(process.cwd(), { recursive: true })
}

// 确保配置文件存在
if (!fs.existsSync(CONFIG_PATH)) {
  fs.writeFileSync(CONFIG_PATH, YAML.stringify({
    wyck: '' // 网易云音乐cookie
  }))
}

export class MusicShare extends plugin {
  constructor() {
    super({
      name: '[小丞插件]点歌',
      dsc: '小丞点歌',
      event: 'message',
      priority: 140,
      rule: [
        {
          reg: '^#?点歌(.*)$',
          fnc: 'searchMusic'
        },
        {
          reg: '^#?听([0-9]+)$',
          fnc: 'playMusic'
        },
        {
          reg: "^#填写网易ck(.*)$",
          fnc: 'txck'
        }
      ]
    })
  }

  async txck(e) {
    if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }
    let config = YAML.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
    let ck = e.msg.replace(/#填写网易ck/g, "").trim()
    config.wyck = ck
    fs.writeFileSync(CONFIG_PATH, YAML.stringify(config))

    return replyMarkdownButton(e, [
      { key: 'a', values: [`<@${e.user_id?.slice(11)}>\r`] },
      { key: 'b', values: ['#'] },
      { key: 'c', values: [' 网易云音乐'] },
      { key: 'd', values: ['\r> Cookie设置成功\r\r'] }
    ])
  }

  async searchMusic(e) {
    if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }
    let msg = e.msg.replace(/\s*/g, "")
    let keyword = msg.replace(/^#?点歌/, "").trim()
    if (!keyword) {
      return replyMarkdownButton(e, [
        { key: 'a', values: [`<@${e.user_id?.slice(11)}>\r`] },
        { key: 'b', values: ['#'] },
        { key: 'c', values: [' 点歌'] },
        { key: 'd', values: ['\r> 请输入要搜索的歌曲名\r\r'] }
      ])
    }

    const urlList = {
      qq: 'http://datukuai.top:1450/djs/API/QQ_Music/api.php?msg=paramsSearch&limit=30',
      kugou: 'http://mobilecdn.kugou.com/api/v3/search/song?format=json&keyword=paramsSearch&page=1&pagesize=10&showtype=1',
      wangyiyun: 'http://datukuai.top:3000/search?keywords=paramsSearch'
    }

    let isQQ = msg.includes("qq") || msg.includes("QQ")
    let isKugou = msg.includes("酷狗")
    let isWangYiyun = !isQQ && !isKugou

    try {
      keyword = encodeURI(keyword)
      let apiName = isQQ ? "qq" : isKugou ? "kugou" : "wangyiyun"
      let url = urlList[apiName].replace("paramsSearch", keyword)
      let response = await fetch(url)
      const { data, result } = await response.json()

      let songs = []
      if (isKugou) {
        songs = data.info
      } else if (isQQ) {
        songs = data
      } else {
        songs = result.songs
      }

      // 保存搜索结果
      UserMusicResults[e.user_id] = {
        type: apiName,
        songs: songs
      }

      // 生成歌曲列表
      let songList = songs.map((song, index) => {
        let name = isKugou ? song.songname : isQQ ? song.song : song.name
        let artist = isKugou ? song.singername : isQQ ? song.singers : song.artists[0].name
        // 过滤掉可能包含的markdown字符
        name = name.replace(/[*_~`]/g, '')
        artist = artist.replace(/[*_~`]/g, '')
        return `${index + 1}. ${name} - ${artist}`
      }).slice(0, 20).join('\r')

      // 生成按钮数组
      let buttonArr = []
      let currentRow = []

      for (let i = 0; i < Math.min(songs.length, 20); i++) {
        currentRow.push({
          text: `听${i + 1}`,
          callback: `/听${i + 1}`,
          permission: e.isGroup ? e.user_id : undefined,
          clicked_text: `正在获取`
        })

        if (currentRow.length === 4 || i === Math.min(songs.length, 20) - 1) {
          buttonArr.push(currentRow)
          currentRow = []

          if (buttonArr.length === 5) break
        }
      }

      // 使用markdown模板回复
      let replyArr = [
        { key: 'a', values: [`<@${e.user_id?.slice(11)}>\r`] },
        { key: 'b', values: ['#'] },
        { key: 'c', values: [' 点歌结果'] },
        { key: 'd', values: ['\r> 以下是搜索到的歌曲\r\r'] },
        { key: 'e', values: ['***\r'] },
        { key: 'f', values: ['`'] },
        { key: 'g', values: [`\`\`\r${songList}\r`] },
        { key: 'h', values: ['``'] },
        { key: 'i', values: ['`'] }
      ]

      await replyMarkdownButton(e, replyArr, buttonArr)

    } catch (err) {
      console.log(err)
      await replyMarkdownButton(e, [
        { key: 'a', values: [`<@${e.user_id?.slice(11)}>\r`] },
        { key: 'b', values: ['#'] },
        { key: 'c', values: [' 搜索失败'] },
        { key: 'd', values: ['\r> 搜索歌曲时发生错误\r\r'] }
      ])
    }
  }

  async playMusic(e) {
    if (!UserMusicResults[e.user_id]) {
      if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }
      return replyMarkdownButton(e, [
        { key: 'a', values: ['#'] },
        { key: 'b', values: [` <@${e.user_id?.slice(11)}>\r`] },
        { key: 'c', values: ['播放失败'] },
        { key: 'd', values: ['，请先搜索歌曲\r\r'] }
      ])
    }

    let index = parseInt(e.msg.replace(/^#?听/, "")) - 1
    let { type, songs } = UserMusicResults[e.user_id]

    if (index < 0 || index >= songs.length) {
      if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }
      return replyMarkdownButton(e, [
        { key: 'a', values: [`<@${e.user_id?.slice(11)}>\r`] },
        { key: 'b', values: ['#'] },
        { key: 'c', values: [' 播放失败'] },
        { key: 'd', values: ['\r> 无效的序号\r\r'] }
      ])
    }

    let song = songs[index]
    let songName = type === 'kugou' ? song.songname : type === 'qq' ? song.song : song.name
    let artist = type === 'kugou' ? song.singername : type === 'qq' ? song.singers : song.artists[0].name

    // 发送正在获取音乐的提示
    if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }
    
    // 初始化回复内容
    let replyContent = [
      { key: 'a', values: [`<@${e.user_id?.slice(11)}>\r`] },
      { key: 'b', values: ['#'] },
      { key: 'c', values: ['正在获取音乐'] },
      { key: 'd', values: [`\r> ${songName} - ${artist}\r\r`] },
      { key: 'e', values: ['***\r'] },
      { key: 'f', values: ['\r请稍候...'] }
    ]
    
    // 如果是网易云音乐，尝试获取封面
    if (type === 'wangyiyun') {
      try {
        let ids = String(song.id)
        let coverResponse = await fetch(`https://163music.kevcore.cn/song/detail?ids=${ids}`)
        let coverData = await coverResponse.json()
        
        if (coverData.songs && coverData.songs[0] && coverData.songs[0].al && coverData.songs[0].al.picUrl) {
          // 如果获取到封面，替换"请稍候..."
          replyContent[5] = { key: 'f', values: [`\r![封面 #100px #100px]`] }
          replyContent.push({ key: 'g', values: [`(${coverData.songs[0].al.picUrl})`] })
        }
      } catch (err) {
        console.log('获取封面失败:', err)
        // 获取封面失败，保持原样
      }
    }
    
    await replyMarkdownButton(e, replyContent)

    try {
      if (type === 'wangyiyun') {
        // 网易云音乐
        let config = YAML.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
        let wyck = config.wyck
        let ids = String(song.id)
        let url = 'http://music.163.com/song/media/outer/url?id=' + ids

        let options = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 12; MI Build/SKQ1.211230.001)',
            'Cookie': 'versioncode=8008070; os=android; channel=xiaomi; ;appver=8.8.70; ' + "MUSIC_U=" + wyck
          },
          body: `ids=${JSON.stringify([ids])}&level=standard&encodeType=mp3`
        }
        let response = await fetch('https://music.163.com/api/song/enhance/player/url/v1', options)
        let res = await response.json()
        if (res.code == 200) {
          url = res.data[0]?.url || url
        }

        try {
          let msg = await segment.record(url)
          await e.reply(msg)
        } catch (err) {
          if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }
          return replyMarkdownButton(e, [
            { key: 'a', values: [`<@${e.user_id?.slice(11)}>\r`] },
            { key: 'b', values: ['#'] },
            { key: 'c', values: [' 播放失败'] },
            { key: 'd', values: ['\r> 歌曲文件太大，无法发送\r\r'] }
          ])
        }

        await this.sendMusicShare(e, {
          source: 'netease',
          name: song.name,
          artist: song.artists[0].name,
          pic: song.artists[0].img1v1Url,
          link: 'https://music.163.com/#/song?id=' + ids,
          url: url
        })

      } else if (type === 'qq') {
        // QQ音乐
        let url = `http://datukuai.top:1450/djs/API/QQ_Music/api.php?msg=${encodeURI(song.song)}&n=1&q=7`
        let response = await fetch(url)
        let data = await response.json()

        try {
          let msg = await segment.record(data.data.music)
          await e.reply(msg)
        } catch (err) {
          if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }
          return replyMarkdownButton(e, [
            { key: 'a', values: [`<@${e.user_id?.slice(11)}>\r`] },
            { key: 'b', values: ['#'] },
            { key: 'c', values: [' 播放失败'] },
            { key: 'd', values: ['\r> 歌曲文件太大，无法发送\r\r'] }
          ])
        }

        await this.sendMusicShare(e, {
          name: song.song,
          artist: song.singers,
          pic: song.picture,
          link: "https://y.qq.com/n/ryqq/songDetail/",
          url: data.data.music
        })

      } else if (type === 'kugou') {
        // 酷狗音乐
        let url = `https://wenxin110.top/api/kugou_music?msg=${encodeURI(song.songname)}&n=1`
        let response = await fetch(url)
        let result = await response.text()

        result = result.replace(/±/g, "")
          .replace(/\\/g, "")
          .replace(/img=/g, "")
          .replace(/播放地址：/g, "")

        let data = result.split('n')

        try {
          let msg = await segment.record(data[3])
          await e.reply(msg)
        } catch (err) {
          if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }
          return replyMarkdownButton(e, [
            { key: 'a', values: [`<@${e.user_id?.slice(11)}>\r`] },
            { key: 'b', values: ['#'] },
            { key: 'c', values: [' 播放失败'] },
            { key: 'd', values: ['\r> 歌曲文件太大，无法发送\r\r'] }
          ])
        }

        await this.sendMusicShare(e, {
          source: 'kugou',
          name: data[1],
          artist: data[2],
          pic: data[0],
          link: "http://www.kugou.com/song",
          url: data[3]
        })
      }

    } catch (err) {
      console.log(err)
      if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }
      return replyMarkdownButton(e, [
        { key: 'a', values: [`<@${e.user_id?.slice(11)}>\r`] },
        { key: 'b', values: ['#'] },
        { key: 'c', values: [' 播放失败'] },
        { key: 'd', values: ['\r> 播放歌曲时发生错误\r\r'] }
      ])
    }
  }

  async sendMusicShare(e, data) {
    if (!e.bot.sendOidb) return false

    let appid, appname, appsign, style = 4
    switch (data.source) {
      case 'netease':
        appid = 100495085
        appname = "com.netease.cloudmusic"
        appsign = "da6b069da1e2982db3e386233f68d76d"
        break
      case 'kugou':
        appid = 205141
        appname = "com.kugou.android"
        appsign = "fe4a24d80fcf253a00676a808f62c2c6"
        break
      default:
        appid = 100497308
        appname = "com.tencent.qqmusic"
        appsign = "cbd27cd7c861227d013a25b2d10f0799"
        break
    }

    let body = {
      1: appid,
      2: 1,
      3: style,
      5: {
        1: 1,
        2: "0.0.0",
        3: appname,
        4: appsign,
      },
      10: e.isGroup ? 1 : 0,
      11: e.isGroup ? e.group.gid : e.friend.uid,
      12: {
        10: data.name,
        11: data.artist,
        12: '[分享]' + data.name + '-' + data.artist,
        13: data.link,
        14: data.pic,
        16: data.url,
      }
    }

    let payload = await e.bot.sendOidb("OidbSvc.0xb77_9", core.pb.encode(body))
    let result = core.pb.decode(payload)

    if (result[3] != 0) {
      if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }
      return replyMarkdownButton(e, [
        { key: 'a', values: [`<@${e.user_id?.slice(11)}>\r`] },
        { key: 'b', values: ['#'] },
        { key: 'c', values: [' 分享失败'] },
        { key: 'd', values: [`\r> 歌曲分享失败：${result[3]}\r\r`] }
      ])
    }
  }
} 
