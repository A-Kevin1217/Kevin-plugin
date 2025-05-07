import axios from "axios";
import _ from "lodash";
import mysql from "mysql2/promise";
import { replyMarkdownButton } from '../components/CommonReplyUtil.js'
// 配置文件读取
const commandConfig = {
    "-1": {
        "key": "do",
        "images": 2,
        "keywords": "撅",
        "px": "#300px #300px"
    },
    "-2": {
        "key": "marriage",
        "images": 1,
        "keywords": "结婚登记",
        "px": "#300px #300px"
    },
    "-3": {
        "key": "always_like",
        "images": 1,
        "keywords": "我永远喜欢",
        "px": "#300px #221px"
    },
    "-4": {
        "key": "crawl",
        "images": 1,
        "keywords": "爬",
        "px": "#300px #300px"
    },
    "-5": {
        "key": "decent_kiss",
        "images": 1,
        "keywords": "像样的亲亲",
        "px": "#300px #300px"
    },
    "-6": {
        "key": "eat",
        "images": 1,
        "keywords": "吃",
        "px": "#100px #100px"
    },
    "-7": {
        "key": "jiujiu",
        "images": 1,
        "keywords": "啾啾",
        "px": "#150px #100px"
    },
    "-8": {
        "key": "kiss",
        "images": 2,
        "keywords": "亲",
        "px": "#300px #300px"
    },
    "-9": {
        "key": "hutao_bite",
        "images": 1,
        "keywords": "胡桃啃",
        "px": "#320px #388px"
    },
    "-10": {
        "key": "my_wife",
        "images": 1,
        "keywords": "我老婆",
        "px": "#325px #450px"
    },
    "-11": {
        "key": "perfect",
        "images": 1,
        "keywords": "完美",
        "px": "#326px #262px"
    },
    "-12": {
        "key": "play_together",
        "images": 1,
        "keywords": "一起玩",
        "px": "#300px #300px"
    },
    "-13": {
        "key": "prpr",
        "images": 1,
        "keywords": "舔",
        "px": "#308px #300px"
    },
    "-14": {
        "key": "roll",
        "images": 1,
        "keywords": "滚",
        "px": "#300px #300px"
    },
    "-15": {
        "key": "throw",
        "images": 1,
        "keywords": "丢",
        "px": "#300px #300px"
    },
    "-16": {
        "key": "twist",
        "images": 1,
        "keywords": "搓",
        "px": "#300px #300px"
    },
    "-17": {
        "key": "petpet",
        "images": 1,
        "keywords": "摸",
        "px": "#300px #300px"
    }
};

const connection = mysql.createPool({
    queueLimit: 0,
    host: 'localhost',
    user: 'yunzai',
    password: 'D7GxtmtHn32at87S',
    database: 'yunzai',
    waitForConnections: true,
    connectionLimit: 10
});

export class zifuhua extends plugin {
    constructor() {
        super({
            name: '图片转字符画及动态表情',
            dsc: '用图片生成字符画或动态表情',
            event: 'message',
            priority: -1145,
            rule: [{
                reg: /^(#|\/)?更多表情meme/,
                fnc: 'zfh1'
            }, {
                reg: /^(#|\/)?(meme)(-?\d+)/,
                fnc: 'zfh'
            }
            ]
        });
    }
    async zfh1(e) {
        const userId = String(e.user_id);
        let params = [
            { key: 'a', values: [`<@${userId?.slice(11)}>`] },
            { key: 'b', values: ['可以为今日的群友老婆作图哦'] },
            { key: 'd', values: ['\n---\n>您使用该作图功能代表您的头像无任何违法违规内容，如有违反则上报安全。'] }
        ];
        let buttons = [
            [
                { text: '爬', callback: 'meme-4', clicked_text: '爬' },
                { text: '吃', callback: 'meme-6', clicked_text: '吃' },
                { text: '摸头', callback: 'meme-17', clicked_text: '摸头' }
            ],
            [
                { text: '结婚登记', callback: 'meme-2', clicked_text: '结婚登记' },
                { text: '亲亲', callback: 'meme-8', clicked_text: '亲亲' },
                { text: '给我亲亲', callback: 'meme-5', clicked_text: '给我亲亲' }
            ]
        ];
        await replyMarkdownButton(e, params, buttons);
        return true;
    }
    async zfh(e) {
        let params1 = [
            { key: 'a', values: [''] },
            { key: 'b', values: ['开始制作meme表情，请等待约7秒。'] }
        ];
        let buttons1 = [];
        await replyMarkdownButton(e, params1, buttons1);
        const groupId = String(e.group_id);
        const userId = String(e.user_id);
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const today = `${year}${month}${day}`;
        const match = e.msg.match(/^(#|\/)?(meme)(-?\d+)/);
        const commandParam = match[3];
        const config = commandConfig[commandParam];

        try {
            const [rows] = await connection.query(
                `SELECT * FROM \`user${today}\` WHERE groupid =? AND (userid =? OR wifeid =?)`,
                [groupId, userId, userId]
            );

            if (rows.length > 0) {
                const row = rows[0];
                let targetId;
                if (row.userid === userId) {
                    targetId = row.wifeid;
                } else {
                    targetId = row.userid;
                }
                const qqAppId = "102134274";
                const idPart = targetId.substring(11);
                const fixedImageUrl = `https://q.qlogo.cn/qqapp/${qqAppId}/${idPart}/640`;

                const formData = new FormData();
                if (config.images === 2) {
                    const selfImgRes = await axios.get(`https://q.qlogo.cn/qqapp/${qqAppId}/${userId?.slice(11)}/640`, {
                        responseType: 'arraybuffer'
                    });
                    const selfBuffer = Buffer.from(selfImgRes.data);
                    formData.append("images", new Blob([selfBuffer]));

                    const targetImgRes = await axios.get(fixedImageUrl, {
                        responseType: 'arraybuffer'
                    });
                    const targetBuffer = Buffer.from(targetImgRes.data);
                    formData.append("images", new Blob([targetBuffer]));
                } else {
                    const imgRes = await axios.get(fixedImageUrl, {
                        responseType: 'arraybuffer'
                    });
                    const buffer = Buffer.from(imgRes.data);
                    formData.append("images", new Blob([buffer]));
                }

                const url = `http://datukuai.top:2233/memes/${config.key}`;
                let args;
                args = handleArgs([{
                    text: "",
                    gender: "unknown"
                }]);
                formData.set("args", args);

                const res = await axios.post(url, formData, {
                    responseType: 'arraybuffer'
                });
                const resultBuffer = Buffer.from(res.data);
                let buttons = [
                    [
                        { text: '爬', callback: 'meme-4', clicked_text: '爬' },
                        { text: '吃', callback: 'meme-6', clicked_text: '吃' },
                        { text: '摸头', callback: 'meme-17', clicked_text: '摸头' }
                    ],
                    [
                        { text: '结婚登记', callback: 'meme-2', clicked_text: '结婚登记' },
                        { text: '亲亲', callback: 'meme-8', clicked_text: '亲亲' },
                        { text: '给我亲亲', callback: 'meme-5', clicked_text: '给我亲亲' }
                    ]
                ];
                await e.reply([
                    segment.at(e.user_id),
                    segment.image(resultBuffer),
                    segment.button(buttons)
                ]);
            } else {
                const userId = String(e.user_id);
                let params = [
                    { key: 'a', values: [`<@${userId?.slice(11)}>`] },
                    { key: 'b', values: ['你还未获取群友老婆呢！来点击按钮获取一个吧！'] }
                ];
                let buttons = [
                    [
                        { text: '💞群友老婆', callback: '群友老婆', clicked_text: '正在获取群友老婆' },
                        { text: '🐾猫猫糕', callback: '/今日猫猫糕', clicked_text: '正在获取猫猫糕' }
                    ]
                ];
                await replyMarkdownButton(e, params, buttons);
            }
        } catch (error) {
            console.error('图片处理出错:');
            await e.reply('❎ 图片处理线程过高导致生成报错，请稍后重试');
        }
    }
}

function handleArgs(userInfos) {
    let argsObj = {};
    argsObj.user_infos = userInfos.map(u => {
        return {
            name: _.trim(u.text, "@"),
            gender: u.gender
        }
    });
    return JSON.stringify(argsObj);
}