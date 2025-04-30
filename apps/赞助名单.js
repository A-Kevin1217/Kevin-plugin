import puppeteer from 'puppeteer'

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
            { person: '小丞', info: '功能开发主要人员', account: 'QQ1354903463', showAccount: true }
          ]
        },
        {
          name: '技术支持',
          members: [
            { person: '傅卿何', info: '提供大量技术支持', account: 'QQ3620060826', showAccount: false },
            { person: '浅巷墨黎_', info: '提供部分技术支持', account: 'QQ2315823357', showAccount: false },
            { person: 'ZY.霆生', info: '提供部分技术指导', account: 'QQ1918530969', showAccount: false },
            { person: '为什么不玩原神', info: '提供部分技术支持', account: 'QQ2173302144', showAccount: false }

          ]
        },
        {
          name: '赞助过我的人',
          members: [
            { person: '霜遇', info: '赞助100元', account: 'QQ1417966938', showAccount: false },
            { person: '奕酒离', info: '赞助521元', account: 'QQ1702049170', showAccount: false },
            { person: 'VVthirteeh', info: '赞助666元', account: 'QQ2827805535', showAccount: false },
            { person: '墨白', info: '赞助1000元', account: 'QQ3206487094', showAccount: false },
            { person: '耀尘ˡᵒᵛᵉ', info: '赞助99元', account: 'QQ1246663835', showAccount: false },
            { person: '池砚', info: '赞助100元', account: 'QQ1071806052', showAccount: false }
          ]
        },
        {
          name: '提供图库',
          members: [
            { person: '阿哈', info: '提供猫猫糕图库', account: 'QQ1700286611', showAccount: false }
          ]
        }
      ]
    }

    function maskQQ(account) {
      // 只处理以QQ开头的账号，如 QQ1354903463
      return account.replace(/(QQ\d{2,4})\d{4}(\d+)/, '$1****$2');
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
                    ${m.account ? `<img class="avatar" src="http://q.qlogo.cn/headimg_dl?dst_uin=${m.account.replace(/^QQ/, '')}&spec=640&img_type=jpg" />` : ''}
                    <span class="person">${m.person}</span>：
                    <span class="info">${m.info}</span>
                    ${m.account ? `<span class="account">${m.showAccount ? m.account : maskQQ(m.account)}</span>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </body>
        </html>
        `

    // puppeteer渲染html为图片并发送
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    const page = await browser.newPage()
    await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1.2 })
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const image = await page.screenshot({ type: 'png', fullPage: true })
    await browser.close()
    // 直接发送图片Buffer
    await e.reply([segment.image(image), segment.button([
      {
        text: '赞助橙子',
        link: 'https://afdian.com/a/kevin1217',
        style: 4,
        clicked_text: '正在跳转'
      },
      {
        text: '菜单',
        callback: '/菜单',
        style: 4,
        clicked_text: '正在打开菜单'
      }
    ])
    ])
  }
}