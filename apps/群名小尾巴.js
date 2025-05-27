import fs from 'fs';
import path from 'path';
import { isQQBot, replyMarkdownButton } from '../components/CommonReplyUtil.js'

export class example extends plugin {
  constructor() {
    super({
      name: 'example',
      dsc: 'example',
      event: 'message',
      priority: -9999999999999,
      rule: [
        {
          reg: /^#?制作群名小尾巴$/,
          fnc: '开始制作群名小尾巴'
        },
        {
          reg: /^我的(用户名|小尾巴)是：(.*)$/,
          fnc: '设置用户名和小尾巴'
        }
      ]
    });
    this.userCacheFile = path.join(path.dirname(new URL(import.meta.url).pathname), 'userCache.json');
    this.userCache = this.loadUserCache();
  }

  loadUserCache() {
    if (fs.existsSync(this.userCacheFile)) {
      const data = fs.readFileSync(this.userCacheFile, 'utf8');
      return JSON.parse(data);
    }
    return {};
  }

  saveUserCache() {
    fs.writeFileSync(this.userCacheFile, JSON.stringify(this.userCache, null, 2), 'utf8');
  }

  async 开始制作群名小尾巴(e) {
    if (!isQQBot(e)) {
      await e.reply('请艾特橙子BOT使用');
      return false;
    }
    await replyMarkdownButton(e, [
      { key: 'a', values: ['用户名：[点击此处输入]'] },
      { key: 'b', values: ['(mqqapi://aio/inlinecmd?command=我的用户名是：&reply=true&enter=true)'] },
      { key: 'c', values: ['\r小尾巴：[点击此处输入]'] },
      { key: 'd', values: ['(mqqapi://aio/inlinecmd?command=我的小尾巴是：&reply=true&enter=true)'] }
    ]);
  }

  async 设置用户名和小尾巴(e) {
    if (!isQQBot(e)) {
      await e.reply('请艾特橙子BOT使用');
      return false;
    }
    const userId = e.user_id; // 假设 e 对象中有 user_id 属性
    if (!this.userCache[userId]) {
      this.userCache[userId] = { username: '', tail: '' };
    }

    let { username, tail } = this.userCache[userId];

    if (e.msg.startsWith('我的用户名是：')) {
      username = e.msg.replace(/^我的用户名是：/, '').replace(/\s+/g, '').trim();
      if (!username) {
        await e.reply("请先输入有效的用户名。");
        return;
      }
      this.userCache[userId].username = username;
      this.saveUserCache(); // 保存到文件
    } else if (e.msg.startsWith('我的小尾巴是：')) {
      if (!this.userCache[userId].username) {
        await e.reply("请按照顺序输入：先输入用户名，再输入小尾巴。");
        return;
      }
      tail = e.msg.replace(/^我的小尾巴是：/, '').replace(/\s+/g, '').trim();
      if (!tail) {
        await e.reply("请先输入有效的小尾巴。");
        return;
      }
      this.userCache[userId].tail = tail;
      this.saveUserCache(); // 保存到文件
    } else {
      await e.reply("请按照顺序输入：先输入用户名，再输入小尾巴。");
      return;
    }

    // 检查 JSON 文件中是否两个值都有内容
    if (!(this.userCache[userId].username && this.userCache[userId].tail)) {
      const usernameDisplay = username || '用户名：[点击此处输入](mqqapi://aio/inlinecmd?command=我的用户名是：&reply=false&enter=true';
      const tailDisplay = tail || '小尾巴：[点击此处输入](mqqapi://aio/inlinecmd?command=我的小尾巴是：&reply=false&enter=true';

      await replyMarkdownButton(e, [
        { key: 'a', values: [`昵称：${usernameDisplay}`] },
        { key: 'b', values: [username ? '\r' : ')'] },
        { key: 'c', values: [`${tailDisplay}`] },
        { key: 'd', values: [')'] }
      ]);
    }

    if (username && tail) {
      const unicodeUsername = this.toUnicode(username);
      const unicodeTail = this.toUnicode(tail);
      const combinedTail = `\\u2067${unicodeTail}\\u2067`;
      const result = this.fromUnicode(unicodeUsername + combinedTail);

      await e.reply(result);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await e.reply("请直接复制以上结果");

      // 删除用户数据并更新缓存文件
      delete this.userCache[userId];
      this.saveUserCache();
    }
  }

  toUnicode(str) {
    return str.split('').map(char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  }

  fromUnicode(str) {
    return str.replace(/\\u[\dA-F]{4}/gi, match => String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16)));
  }
}
