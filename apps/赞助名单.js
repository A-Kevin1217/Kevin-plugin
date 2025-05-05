import puppeteer from 'puppeteer'
import crypto from 'crypto'
import fs from 'fs'

function getPluginMD5() {
  const filePath = decodeURIComponent(new URL(import.meta.url).pathname); // 获取当前文件的路径
  try {
    const code = fs.readFileSync(filePath, 'utf-8') // 获取当前文件的内容
    return crypto.createHash('md5').update(code).digest('hex')
  } catch (error) {
    console.error(`Error reading file at ${filePath}:`, error)
    throw error; // 重新抛出错误以便上层处理
  }
}

export class 赞助名单 extends plugin {
  constructor() {
    super({
      name: '赞助名单',
      dsc: '赞助名单',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: /^#?赞助名单$/,
          fnc: '赞助名单'
        }
      ]
    })
  }

  async 赞助名单(e) {
    e.reply('正在生成最新赞助名单...', false, { recallMsg: 10 })
    const currentMD5 = getPluginMD5() // 计算当前文件的 MD5
    const filePath = `${process.cwd()}/data/zzmd.json`
    let zzmdData = {}

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      zzmdData = JSON.parse(content)
    } else {
      console.warn(`File not found: ${filePath}. A new file will be created.`)
    }

    if (zzmdData.md5 === currentMD5) {
      // 如果 MD5 相同，直接使用缓存的数据
      const { imageUrl, pxValue } = zzmdData
      let md = segment.markdown(`![赞助 #${pxValue}](${imageUrl})\n`)
      await e.reply([md])
      return
    }

    const data = {
      bg: 'https://sky.res.netease.com/pc/gw/20221215171426/img/bg_0040d9d.jpg',
      colors: {
        person: '#FFD700',   // 人名
        info: '#00BFFF',     // 赞助信息
        account: '#90EE90'   // 账号
      },
      groups: [
        {
          name: '主要开发',
          members: [
            { person: '小丞', info: '功能开发主要人员', account: 'QQ：1354903463', showAccount: true }
          ]
        },
        {
          name: '技术支持',
          members: [
            { person: '傅卿何', info: '提供大量技术支持', account: 'QQ：3620060826', showAccount: false },
            { person: '浅巷墨黎_', info: '提供部分技术支持', account: 'QQ：2315823357', showAccount: false },
            { person: '冷曦', info: '功能优化提供帮助', account: 'QQ：2218872014', showAccount: true },
            { person: 'ZY.霆生', info: '提供部分技术指导', account: 'QQ：1918530969', showAccount: false },
            { person: '翅膀', info: '提供部分技术指导', account: 'QQ：2450785445', showAccount: false },
            { person: 'Броня Зайчик', info: '提供部分技术指导', account: 'QQ：2644266329', showAccount: false },
            { person: '为什么不玩原神', info: '提供部分技术支持', account: 'QQ：2173302144', showAccount: false }
          ]
        },
        {
          name: '赞助过我的人',
          members: [
            { person: '霜遇', info: '赞助¥100.00元', account: 'QQ：1417966938', showAccount: false },
            { person: '奕酒离', info: '赞助¥52.10元', account: 'QQ：1702049170', showAccount: false },
            { person: 'VVthirteeh', info: '赞助¥66.60元', account: 'QQ：2827805535', showAccount: false },
            { person: '墨白', info: '赞助¥100.00元', account: 'QQ：3206487094', showAccount: false },
            { person: '耀尘ˡᵒᵛᵉ', info: '赞助¥99.90元', account: 'QQ：1246663835', showAccount: false },
            { person: '池砚', info: '赞助¥100.00元', account: 'QQ：1071806052', showAccount: false }
          ]
        },
        {
          name: '其他赞助',
          members: [
            { person: '阿哈', info: '提供猫猫糕图库 435 张', account: 'QQ：1700286611', showAccount: false },
            { person: '奕酒离', info: '纯手工绘制橙子宠物系统小宠物', account: 'QQ：1702049170', showAccount: false }
          ]
        }
      ]
    }

    function maskQQ(account) {
      // 只处理以QQ开头的账号，如 QQ1354903463
      return account.replace(/(QQ：\d{2,3})\d{4}(\d+)/, '$1****$2');
    }

    const html = `
        <html>
        <head>
          <style>
            body {
              background: url('${data.bg}') no-repeat top center;
              background-size: cover;
              color: #fff;
              font-family: "微软雅黑", sans-serif;
              padding: 60px;
              width: 1280px;
              margin: 0 auto;
              position: relative;
              min-height: 100vh;
            }
            .group {
              margin-bottom: 60px;
              background: rgba(0,0,0,0.4);
              border-radius: 20px;
              padding: 30px 40px;
              backdrop-filter: blur(12px);
              -webkit-backdrop-filter: blur(12px);
            }
            .group-title {
              font-size: 48px;
              margin-bottom: 20px;
            }
            .divider {
              height: 2px;
              background: linear-gradient(90deg, #FFD700 0%, #00BFFF 100%);
              border: none;
              margin: 16px 0 24px 0;
              opacity: 0.7;
            }
            .member-line {
              font-size: 36px;
              line-height: 2.2;
              margin-bottom: 6px;
            }
            .person { color: ${data.colors.person}; }
            .info { color: ${data.colors.info}; margin-left: 10px; }
            .account { color: ${data.colors.account}; margin-left: 10px; }
            .avatar {
              width: 48px;
              height: 48px;
              border-radius: 50%;
              vertical-align: middle;
              margin-right: 16px;
              object-fit: cover;
              background: #fff2;
            }
          </style>
        </head>
        <body>
          ${data.groups.map(group => `
            <div class="group">
              <div class="group-title">${group.name}</div>
              <div class="divider"></div>
              <div class="group-list">
                ${group.members.map(m => `
                  <div class="member-line">
                    ${m.account ? `<img class="avatar" src="http://q.qlogo.cn/headimg_dl?dst_uin=${m.account.replace(/^QQ：/, '')}&spec=640&img_type=jpg" />` : ''}
                    <span class="person">${m.person}</span>：
                    <span class="info">${m.info}</span>
                    ${m.account ? `<span class="account">${m.showAccount ? m.account : maskQQ(m.account)}</span>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
          <div style="height: 80px;"></div>
          <div style="position: absolute; left: 0; right: 0; bottom: 60px; text-align: center; width: 100%; font-size: 28px; color: #fff; text-shadow: 0 2px 8px #000a;">
            <div>以上排名不分先后顺序</div>
          </div>
        </body>
        </html>
    `;

    // puppeteer渲染html为图片并发送
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1.2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const image = await page.screenshot({ type: 'png', fullPage: true });
    await browser.close();
    
    // 直接发送图片Buffer
    await e.reply(segment.image(image));

    // 保存当前 MD5 和生成的图片信息
    const imageUrl = ''; // 这里可以设置生成的图片 URL
    const pxValue = ''; // 这里可以设置图片的尺寸
    fs.writeFileSync(filePath, JSON.stringify({ md5: currentMD5, imageUrl, pxValue }, null, 2));
  }
}