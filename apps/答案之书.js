import fetch from "node-fetch";
import { isQQBot, replyMarkdownButton } from '../components/CommonReplyUtil.js'

// 假设 plugin 类已在你的环境中定义
export class example extends plugin {
    constructor() {
        super({
            name: '答案之书',
            dsc: '答案之书',
            event: 'message',
            priority: 1,
            rule: [
                {
                    reg: /^(#|\/)?答案之书$/,
                    fnc: 'AnswersBook'
                }
            ]
        });
    }

    async AnswersBook(e) {
        if (!isQQBot(e)) {
            await e.reply('请艾特橙子BOT使用')
            return false
        }
        try {
            const FETCH_DATA = await fetch('https://oiapi.net/API/BOfA');
            if (!FETCH_DATA.ok) throw new Error('Network response was not ok');
            const DATA_JSON = await FETCH_DATA.json();
            const zhAnswer = DATA_JSON.data.zh;
            const enAnswer = DATA_JSON.data.en;
            return replyMarkdownButton(e, [
                { key: 'a', values: [`<@${e.user_id?.slice(11)}>\r`] },
                { key: 'b', values: ['#'] },
                { key: 'c', values: [' 答案之书'] },
                { key: 'd', values: [`\r> 让答案之书为你解答吧\r\r`] },
                { key: 'e', values: [`***`] },
                { key: 'f', values: [`\r${zhAnswer}`] },
                { key: 'g', values: [`\r${enAnswer}`] }
            ], [
                [
                    { text: '再看一次', callback: '答案之书', clicked_text: '正在再看一次' },
                    { text: '菜单', callback: '菜单', clicked_text: '正在获取菜单' }]
            ])
        } catch (error) {
            console.error('Fetch error:', error);
            return replyMarkdownButton(e, [
                { key: 'a', values: ['获取数据失败，请稍后再试'] }
            ])
        }
    }
}
