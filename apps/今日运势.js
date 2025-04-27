import fs from "fs";
import path from 'path';
import { isQQBot, replyMarkdownButton } from '../components/CommonReplyUtil.js'

const pluginName = '今日运势'
const dataDir = path.join(process.cwd(), 'plugins/Kevin-plugin/data')
const jrysFile = path.join(dataDir, 'jrys.json')

// 添加白名单配置
const whiteList = [
    "92A60A81F30F562AB54A6A8F05278B43",  // 这里填写允许无限悔签的QQ号
    "2854215268:717A436D0432E1D87BF5CE7923770A83",   // 可以添加多个QQ号
    "717A436D0432E1D87BF5CE7923770A83",
    "2854215268:92A60A81F30F562AB54A6A8F05278B43"
];

export class example extends plugin {
    constructor() {
        super({
            name: '今日运势', // 插件名称
            dsc: '今日运势', // 插件描述
            event: 'message', // 更多监听事件请参考下方的 Events
            priority: -5000, // 插件优先度，数字越小优先度越高
            rule: [
                {
                    reg: '^#?(今日运势|运势)$', // 正则表达式,有关正则表达式请自行百度
                    fnc: 'fortune' // 执行方法
                },
                {
                    reg: '^#?(悔签|重新抽取运势)$', // 正则表达式,有关正则表达式请自行百度
                    fnc: '悔签' // 执行方法
                }
            ]
        })
        this.ensureDataDir()
    }

    ensureDataDir() {
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true })
        }
    }

    async fortune(e) {
        if (!isQQBot(e)) {
            await e.reply('请艾特橙子BOT使用')
            return false
        }
        try {
            let jrys = await readAndParseJSON()
            let now = new Date().toLocaleDateString('zh-CN')
            let data = await redis.get(`Yunzai:Fortune:${e.user_id?.slice(11)}_jrys`)
            let replymessage = '正在为您测算今日的运势……'
            let isFirstTime = false
            if (data) {
                data = JSON.parse(data)
                if (now === data.time) {
                    logger.info('[今日运势]今日已抽取运势，读取保存的数据')
                    replymessage = '今日已抽取运势，让我帮你找找签……'
                } else {
                    logger.info('[今日运势]日期已改变，重新抽取运势')
                    isFirstTime = true
                }
            } else {
                logger.info('未读取到运势数据，首次抽取')
                isFirstTime = true
            }
            if (isFirstTime) {
                data = {
                    fortune: jrys[Math.floor(Math.random() * jrys.length)],
                    time: now,
                    isRe: false
                }
                replymessage = '正在为您抽取今日运势……'
            }
            await e.reply(replymessage, true, { recallMsg: 10 })
            await redis.set(`Yunzai:Fortune:${e.user_id?.slice(11)}_jrys`, JSON.stringify(data))
            await generateFortune(e)
            return true
        } catch (error) {
            logger.error(`[今日运势]发生错误: ${error.message}`);
            logger.error(`[今日运势]错误堆栈: ${error.stack}`);
            await e.reply('发生错误，请稍后再试');
            return false;
        }
    }

    async 悔签(e) {
        let jrys = await readAndParseJSON()
        let now = new Date().toLocaleDateString('zh-CN')
        let data = await redis.get(`Yunzai:Fortune:${e.user_id?.slice(11)}_jrys`)
        let replymessage = '正在为您测算今日的运势……'
        if (data) {
            data = JSON.parse(data)
        } else {
            logger.info('[今日运势]未读取到运势数据，悔签转为重新抽取运势')
            data = {
                fortune: jrys[Math.floor(Math.random() * jrys.length)],
                time: now,
                isRe: false
            }
        }
        if (now !== data.time) {
            logger.info('[今日运势]日期变更，重新抽取运势')
            data = {
                fortune: jrys[Math.floor(Math.random() * jrys.length)],
                time: now,
                isRe: false
            }
        } else if (data.isRe && !whiteList.includes(e.user_id?.slice(11))) {
            logger.info('[今日运势]今日已悔签，不重新抽取')
            replymessage = '今天已经悔过签了,再给你看一眼吧……'
        } else {
            logger.info('[今日运势]悔签')
            replymessage = '异象骤生，运势竟然改变了……'
            data = {
                fortune: jrys[Math.floor(Math.random() * jrys.length)],
                time: now,
                isRe: true
            }
        }
        await e.reply(replymessage, true, { recallMsg: 10 })
        await redis.set(`Yunzai:Fortune:${e.user_id?.slice(11)}_jrys`, JSON.stringify(data))
        await generateFortune(e)
        return true
    }
}

async function generateFortune(e) {
    let data = await redis.get(`Yunzai:Fortune:${e.user_id?.slice(11)}_jrys`);
    const fortune = JSON.parse(data).fortune;
    let fortuneSummary = fortune.fortuneSummary;
    let luckyStar = fortune.luckyStar;
    let signText = fortune.signText;
    let unSignText = fortune.unSignText;
    let msg = `运势：${fortuneSummary}\r星级：${luckyStar}\r点评：${signText}\r解读：${unSignText}\r`;
    await new Promise(resolve => setTimeout(resolve, 1000));
    await replyMarkdownButton(e, [
        { key: 'a', values: [`<@${e.user_id?.slice(11)}>\r`] },
        { key: 'b', values: ['#'] },
        { key: 'c', values: [' 今日运势'] },
        { key: 'd', values: [`\r> 我没有迷信！我就是想看看~\r\r`] },
        { key: 'e', values: [`***`] },
        { key: 'f', values: [`\r## ${msg}`] }
    ], [
        [{ text: '看看我的', callback: '今日运势', visited_label: '正在获取今日运势' },
        { text: '重抽', callback: '重新抽取运势', visited_label: '正在重新抽取运势' },
        { text: '菜单', callback: '菜单', visited_label: '正在获取菜单' }]
    ])
}

async function readAndParseJSON() {
    try {
        const fullPath = jrysFile;
        logger.info(`[今日运势]尝试读取文件: ${fullPath}`);
        const fileContent = await fs.promises.readFile(fullPath, 'utf8');
        const parsedData = JSON.parse(fileContent);
        logger.info(`[今日运势]成功读取并解析JSON文件`);
        return parsedData;
    } catch (e) {
        logger.error(`[今日运势]JSON读取或解析失败: ${e.message}`);
        logger.error(`[今日运势]错误堆栈: ${e.stack}`);
        return [];
    }
}
