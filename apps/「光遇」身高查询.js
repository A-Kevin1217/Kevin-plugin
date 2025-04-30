import fetch from "node-fetch";
import COS from 'cos-nodejs-sdk-v5';
import skyHeightConfig from '../config/skyHeightConfig.js'
import { isQQBot, replyMarkdownButton } from '../components/CommonReplyUtil.js'

const { KEY_1, KEY_2, COS_ENDPOINT, COS_SECRET_ID, COS_SECRET_KEY, COS_BUCKET, COS_REGION, API_GUO_FU, API_GUO_FU_FRIEND, API_GUO_FU_TIMES, API_GUO_JI } = skyHeightConfig

// 文件路径配置
const USER_FILE = '用户.json'
const GFCODE_FILE = '国服兑换码.json'
const OPEN_GROUP_FILE = '开放群聊.json'

const GFBINDING_REGEX = /^(#|\/)?国服绑定(.*)$/i
const HYBINDING_REGEX = /^(#|\/)?国服好友码绑定(.*)$/i
const GJFBINDING_REGEX = /^(#|\/)?国际服绑定(.*)$/i
const FRIEND_CODE_RESULT = /^(#|\/)?好友码查询(.*)$/i
const USE_CDKEY_REGEX = /^(#|\/)?兑换次数(.*)/
const USE_GFCDKEY_REGEX = /^(#|\/)?兑换国服次数(.*)/

// COS 实例
const cos = new COS({
    SecretId: COS_SECRET_ID,
    SecretKey: COS_SECRET_KEY
});

/** 存储 */
async function SAVE(filename, data) {
    return new Promise((resolve, reject) => {
        cos.putObject({
            Bucket: COS_BUCKET,
            Region: COS_REGION,
            Key: filename,
            Body: JSON.stringify(data, null, 4)
        }, (err, data) => {
            if (err) {
                logger.error(`[光遇身高查询] 保存文件到 COS 失败 ${filename}: ${err}`);
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

async function GD(filename) {
    return new Promise((resolve, reject) => {
        cos.getObject({
            Bucket: COS_BUCKET,
            Region: COS_REGION,
            Key: filename
        }, (err, data) => {
            if (err) {
                if (err.code === 'NoSuchKey') {
                    resolve({});
                } else {
                    logger.error(`[光遇身高查询] 从 COS 读取文件失败 ${filename}: ${err}`);
                    resolve({});
                }
            } else {
                try {
                    const jsonData = JSON.parse(data.Body.toString());
                    resolve(jsonData);
                } catch (parseErr) {
                    logger.error(`[光遇身高查询] 解析 JSON 失败 ${filename}: ${parseErr}`);
                    resolve({});
                }
            }
        });
    });
}

export class 光遇_身高查询 extends plugin {
    constructor() {
        super({
            name: '光遇_身高查询',
            dsc: '光遇_身高查询',
            event: 'message',
            priority: -5000,
            rule: [{
                reg: GFBINDING_REGEX,
                fnc: 'GFBINDING'
            }, {
                reg: HYBINDING_REGEX,
                fnc: 'HYBINDING'
            }, {
                reg: GJFBINDING_REGEX,
                fnc: 'GJFBINDING'
            }, {
                reg: /^(#|\/)?(国服)?(身高查询|查询身高)$/,
                fnc: 'QUERY_GF'
            }, {
                reg: FRIEND_CODE_RESULT,
                fnc: 'FRIEND_CODE_RESULT'
            }, {
                reg: /^(#|\/)?(国际服)?(身高查询|查询身高)$/,
                fnc: 'QUERY_GJF'
            }, {
                reg: /^(#|\/)?(查询(绑定)?(id|ID)(.*)?|查询个人次数)$/,
                fnc: 'QUERY_ID'
            }, {
                reg: /^(#|\/)?生成国服次数\*(.*)$/,
                fnc: 'GENERATE_GFREDEMPTION_CODE'
            }, {
                reg: USE_GFCDKEY_REGEX,
                fnc: 'USE_GFCDKEY'
            }, {
                reg: /^(#|\/)?开放该群$/,
                fnc: 'OPEN_GROUP'
            }, {
                reg: /^(#|\/)?(购买次数|次数购买)$/,
                fnc: 'BUY_TIMES'
            }, {
                reg: /^(#|\/)?(总剩余次数|查看总次数|剩余总次数)$/,
                fnc: 'CHECK_TOTAL_TIMES'
            }]
        });
    }

    async init() {
        logger.info('[光遇身高查询] 插件初始化中...');
        try {
            await GD(USER_FILE);
            logger.info('[光遇身高查询] 初始化成功');
        } catch (error) {
            logger.error(`[光遇身高查询] 初始化失败: ${error}`);
        }
    }

    async QUERY_ID(e) {
        if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }

        const USER_ID = e.user_id?.slice(11);
        const USER_FILE_DATA = await GD(USER_FILE);
        const userData = USER_FILE_DATA[USER_ID] || {};

        const {
            SKY_UID = '未绑定',
            SKY_CODE = '未绑定',
            GJFSKY_UID = '未绑定',
            times = '无'
        } = userData;

        function maskUID(uid) {
            if (!uid || uid === '未绑定' || uid === '未找到用户') return '未绑定';
            return uid.replace(/-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-/, '-xxxxxxx-');
        }

        return replyMarkdownButton(e, [
            { key: 'a', values: [`##`] },
            { key: 'b', values: [` 小丞三服身高查询\r`] },
            { key: 'c', values: [`***`] },
            { key: 'd', values: [`\r\r>`] },
            { key: 'e', values: [` <@${USER_ID}>`] },
            {
                key: 'f', values: [
                    `绑定的id信息如下：\r` +
                    `🍊国服：**${maskUID(SKY_UID)}**\r` +
                    `🍊国服邀请码：**${SKY_CODE}**\r` +
                    `🍊国际服：**${maskUID(GJFSKY_UID)}**\r` +
                    `🍊国服次数：${times}\r`
                ]
            },
        ], [
            [
                { text: '再次查看', callback: '查询绑定id' }
            ],
            [
                { text: '查国服身高', callback: '国服身高查询', clicked_text: '正在查询国服身高' },
                { text: '绑定好友码', input: '国服好友码绑定', clicked_text: '正在绑定好友码' },
                { text: '国际服身高', callback: '国际服身高查询', clicked_text: '正在查询国际服身高' }
            ]
        ]);
    }

    async GFBINDING(e) {
        if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }

        if (await this.WF(e) !== 0) return

        const USER_ID = e.user_id?.slice(11)
        const GROUP_ID = e.group_id

        const FREE_GROUP_ID = await GD(OPEN_GROUP_FILE)

        const SKY_UID = ((e.msg.match(GFBINDING_REGEX))[2]).replace(/[\u4e00-\u9fa5()]/g, '').replace(/\s/g, '')

        if (SKY_UID.length !== 36) {
            return e.reply([
                { key: 'a', values: [`##`] },
                { key: 'b', values: [` ID错误，请检查绑定ID长度是否合理`] },
                { key: 'c', values: [`\r> 国服绑定xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx`] },
            ], [
                [
                    { text: '重新绑定', input: '国服绑定xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx', clicked_text: '正在重新绑定' },
                ]
            ]);
        }

        const USER_FILE_DATA = await GD(USER_FILE)

        let SKY_CODE = ""
        let GJFSKY_UID = ""
        let times = 0
        let live_times = 0

        if (USER_FILE_DATA[USER_ID]) times = USER_FILE_DATA[USER_ID]['times']
        if (USER_FILE_DATA[USER_ID]) live_times = USER_FILE_DATA[USER_ID]['live_times']
        if (USER_FILE_DATA[USER_ID]) SKY_CODE = USER_FILE_DATA[USER_ID]['SKY_CODE']
        if (USER_FILE_DATA[USER_ID]) GJFSKY_UID = USER_FILE_DATA[USER_ID]['GJFSKY_UID']
        USER_FILE_DATA[USER_ID] = { SKY_UID: SKY_UID, SKY_CODE: SKY_CODE, GJFSKY_UID: GJFSKY_UID, times: times, live_times: live_times }

        await SAVE(USER_FILE, USER_FILE_DATA)

        return replyMarkdownButton(e, [
            { key: 'a', values: [`##`] },
            { key: 'b', values: [` 绑定成功`] },
            { key: 'c', values: [`\r> 记得及时撤回您的ID，以防被坏人拿去干坏事`] },
        ], [
            [
                { text: '再次查看', callback: '查询绑定id' }
            ],
            [
                { text: '查国服身高', callback: '国服身高查询', clicked_text: '正在查询国服身高' },
                { text: '绑定好友码', input: '国服好友码绑定xxxx-xxxx-xxxx', clicked_text: '正在绑定好友码' },
                { text: '国际服身高', callback: '国际服身高查询', clicked_text: '正在查询国际服身高' }
            ]
        ]);
    }
    async HYBINDING(e) {
        if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }

        if (await this.WF(e) !== 0) return

        const USER_ID = e.user_id?.slice(11)
        const GROUP_ID = e.group_id

        const FREE_GROUP_ID = await GD(OPEN_GROUP_FILE)

        const SKY_CODE = ((e.msg.match(HYBINDING_REGEX))[2]).replace(/[\u4e00-\u9fa5()]/g, '').replace(/\s/g, '')

        if (SKY_CODE.length !== 14) {
            return e.reply([
                { key: 'a', values: [`##`] },
                { key: 'b', values: [` 绑定错误，请检查好友码长度是否合理`] },
                { key: 'c', values: [`\r> 国服好友码绑定xxxx-xxxx-xxxx`] },
            ], [
                [
                    { text: '重新绑定', input: '国服好友码绑定xxxx-xxxx-xxxx', clicked_text: '正在重新绑定' },
                ]
            ]);
        }

        const USER_FILE_DATA = await GD(USER_FILE)

        let SKY_UID = ""
        let GJFSKY_UID = ""
        let times = 0
        let live_times = 0

        if (USER_FILE_DATA[USER_ID]) times = USER_FILE_DATA[USER_ID]['times']
        if (USER_FILE_DATA[USER_ID]) live_times = USER_FILE_DATA[USER_ID]['live_times']
        if (USER_FILE_DATA[USER_ID]) SKY_UID = USER_FILE_DATA[USER_ID]['SKY_UID']
        if (USER_FILE_DATA[USER_ID]) GJFSKY_UID = USER_FILE_DATA[USER_ID]['GJFSKY_UID']
        USER_FILE_DATA[USER_ID] = { SKY_UID: SKY_UID, SKY_CODE: SKY_CODE, GJFSKY_UID: GJFSKY_UID, times: times, live_times: live_times }

        await SAVE(USER_FILE, USER_FILE_DATA)

        return replyMarkdownButton(e, [
            { key: 'a', values: [`##`] },
            { key: 'b', values: [` 绑定成功！现在可以尝试查询你的身高了`] },
            { key: 'c', values: [`\r> 记得不要拉黑加上的好友\r否则下次查身高时数值不会变。`] },
        ], [
            [
                { text: '查询国服身高', callback: '国服身高查询', clicked_text: '正在查询国服身高' },
                { text: '重新绑定好友码', input: '国服好友码绑定xxxx-xxxx-xxxx', clicked_text: '正在重新绑定好友码' },
                { text: '查看绑定id及次数', callback: '查询绑定id', clicked_text: '正在查询绑定id及次数' },
            ]
        ]);
    }

    async GJFBINDING(e) {
        if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }

        if (await this.WF(e) !== 0) return

        const USER_ID = e.user_id?.slice(11)
        const GROUP_ID = e.group_id

        const FREE_GROUP_ID = await GD(OPEN_GROUP_FILE)

        const GJFSKY_UID = ((e.msg.match(GJFBINDING_REGEX))[2]).replace(/[\u4e00-\u9fa5()]/g, '').replace(/\s/g, '')

        if (GJFSKY_UID.length !== 36) {
            return e.reply([
                { key: 'a', values: [`##`] },
                { key: 'b', values: [` ID错误，请检查绑定ID长度是否合理`] },
                { key: 'c', values: [`\r> 国际服绑定xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx`] },
            ], [
                { text: '重新绑定', input: '国际服绑定xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx', clicked_text: '正在重新绑定' },
                { text: '如何获取ID', link: 'https://pan.t1qq.com/view.php/70256ea206338d7268a43ab682d9bdf7.jpg' },
            ]);
        }

        const USER_FILE_DATA = await GD(USER_FILE)
        let SKY_UID = ""
        let SKY_CODE = ""
        let times = 0
        let live_times = 0

        if (USER_FILE_DATA[USER_ID]) times = USER_FILE_DATA[USER_ID]['times']
        if (USER_FILE_DATA[USER_ID]) live_times = USER_FILE_DATA[USER_ID]['live_times']
        if (USER_FILE_DATA[USER_ID]) SKY_UID = USER_FILE_DATA[USER_ID]['SKY_UID']
        if (USER_FILE_DATA[USER_ID]) SKY_CODE = USER_FILE_DATA[USER_ID]['SKY_CODE']
        USER_FILE_DATA[USER_ID] = { SKY_UID: SKY_UID, SKY_CODE: SKY_CODE, GJFSKY_UID: GJFSKY_UID, times: times, live_times: live_times }

        await SAVE(USER_FILE, USER_FILE_DATA)

        return replyMarkdownButton(e, [
            { key: 'a', values: [`##`] },
            { key: 'b', values: [` 绑定成功`] },
            { key: 'c', values: [`\r> 记得及时撤回您的ID，以防被坏人拿去干坏事`] },
        ], [
            [
                { text: '查询国际服身高', callback: '国际服身高查询', clicked_text: '正在查询国际服身高' },
                { text: '查看绑定id及次数', callback: '查询绑定id', clicked_text: '正在查询绑定id及次数' },
            ]
        ]);
    }

    async QUERY_GF(e) {
        if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }

        if (await this.WF(e) !== 0) return;

        const USER_ID = e.user_id?.slice(11);
        const USER_FILE_DATA = await GD(USER_FILE);

        // 检查用户是否存在和绑定
        if (!USER_FILE_DATA[USER_ID] || !USER_FILE_DATA[USER_ID]['SKY_UID']) {
            return e.reply([
                { key: 'a', values: [`##`] },
                { key: 'b', values: [` 您尚未绑定光遇长ID，请从小精灵内获取长ID绑定`] },
            ], [
                [
                    { text: '绑定国服ID', input: '国服绑定xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx', clicked_text: '正在绑定国服ID' },
                    { text: '如何获取ID', link: 'https://v.t1qq.com/gfid.jpg', clicked_text: '正在跳转' }
                ]
            ]);
        }

        // 检查查询次数
        const TIMES = USER_FILE_DATA[USER_ID]['times'];
        if (TIMES <= 0) {
            return e.reply([
                { key: 'a', values: [`##`] },
                { key: 'b', values: [` 您尚未拥有国服查询次数，请购买获得次数`] },
            ], [
                [
                    { text: '购买次数', link: 'https://wiki.kevcore.cn/height/', clicked_text: '正在购买次数' },
                    { text: '兑换国服次数', input: '兑换国服次数（此处填写兑换码，连同括号一起替换掉）', clicked_text: '正在兑换国服次数' }
                ]
            ]);
        }

        e.reply('正在查询，请耐心等待！', false, { recallMsg: 10 });

        try {
            let URL = `${API_GUO_FU}?key=${KEY_2}&gy=gf&uid=${USER_FILE_DATA[USER_ID]['SKY_UID']}`;
            let URL_DATA = await (await fetch(URL)).json();

            // 如果需要先使用好友码查询
            if (URL_DATA.code !== 200 && URL_DATA.code === 401) {
                URL = `${API_GUO_FU_FRIEND}?key=${KEY_2}&gy=gf&uid=${USER_FILE_DATA[USER_ID]['SKY_CODE']}`;
                URL_DATA = await (await fetch(URL)).json();
            }

            if (URL_DATA.code !== 200) {
                return e.reply([
                    { key: 'a', values: [`##`] },
                    { key: 'b', values: [` 接口返回异常:${URL_DATA.code}`] },
                    { key: 'c', values: [`\r> ${URL_DATA.msg}`] }
                ], [
                    [
                        { text: '重新查询', callback: '国服身高查询', clicked_text: '正在重新查询' },
                        { text: '联系主人', link: 'https://qm.qq.com/q/Mfra27jTmQ', clicked_text: '正在跳转' }
                    ]
                ]);
            }

            // 更新用户次数
            USER_FILE_DATA[USER_ID]['times'] -= 1;
            await SAVE(USER_FILE, USER_FILE_DATA);

            // 解数据
            const { scale, height, maxHeight, minHeight, currentHeight } = URL_DATA['data'];
            const { hair, horn, mask, neck, body, hat, prop, face, feet, wing } = URL_DATA['remote'];
            const time = new Date().toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            })

            const displayTimes = USER_FILE_DATA[USER_ID]['times'] >= 10000 ? '∞' : USER_FILE_DATA[USER_ID]['times'];

            // 返回查询结果
            return replyMarkdownButton(e, [
                { key: 'a', values: [`<@${USER_ID}>`] },
                { key: 'b', values: [`\r# 这里是国服数据，请查收\r> ${time}\r\r`] },
                { key: 'c', values: ["``"] },
                { key: 'd', values: [`\`\r————用户身高————\r🍊体型S值是：${parseFloat(scale).toFixed(5)}\r🍊身高H值是：${parseFloat(height).toFixed(5)}\r🍊最高是：${parseFloat(maxHeight).toFixed(5)}\r🍊最矮是：${parseFloat(minHeight).toFixed(5)}\r🍊目前身高：${parseFloat(currentHeight).toFixed(5)}\r🍊剩余查询次数：${displayTimes}`] },
                { key: 'e', values: [`\r————用户装扮————\r🍊发型：${hair}\r🍊头饰：${hat}\r🍊面具：${mask}\r🍊面饰：${face}\r🍊耳饰：${horn}\r🍊颈部：${neck}\r🍊裤子：${body}\r🍊鞋子：${feet}\r🍊斗篷：${wing}\r🍊背饰：${prop}`] },
                { key: 'f', values: ['\r————橙子BOT————``'] },
                { key: 'g', values: ['`'] }
            ], [
                [
                    { text: '再次查询', callback: '国服身高查询', clicked_text: '正在重新查询' },
                    { text: '兑换国服次数', input: '兑换国服次数（此处填写兑换码，连同括号一起替换掉）', clicked_text: '正在兑换国服次数' }
                ]
            ]);

        } catch (error) {
            console.error('查询失败:', error);
            return e.reply([
                { key: 'a', values: [`##`] },
                { key: 'b', values: [`接口返回异常:${error.code}`] },
                { key: 'c', values: [`${error.msg}`] }
            ], [
                [
                    { text: '重新查询', callback: '国服身高查询', clicked_text: '正在重新查询' }
                ]
            ]);
        }
    }

    async FRIEND_CODE_RESULT(e) {
        if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }

        if (await this.WF(e) !== 0) return;

        const USER_ID = e.user_id?.slice(11);
        const USER_FILE_DATA = await GD(USER_FILE);
        const friendCode = ((e.msg.match(FRIEND_CODE_RESULT))[2]).replace(/[\u4e00-\u9fa5()]/g, '').replace(/\s/g, '');

        // 检查查询次数
        const TIMES = USER_FILE_DATA[USER_ID]?.times || 0;
        if (TIMES <= 0) {
            return e.reply([
                { key: 'a', values: [`##`] },
                { key: 'b', values: [` 您尚未拥有国服查询次数，请购买获得次数`] },
                { key: 'c', values: [`\r> 请先获取次数再进行查询`] }
            ], [
                [
                    { text: '购买次数', link: 'https://wiki.kevcore.cn/height/', clicked_text: '正在购买次数' },
                    { text: '兑换国服次数', input: '兑换国服次数（此处填写兑换码，连同括号一起替换掉）', clicked_text: '正在兑换国服次数' }
                ]
            ]);
        }

        if (!friendCode) {
            return e.reply([
                { key: 'a', values: [`##`] },
                { key: 'b', values: [` 请输入正确的好友码`] },
                { key: 'c', values: [`格式：好友码查询xxxx-xxxx-xxxx`] }
            ], [
                [
                    { text: '查询示例', input: '好友码查询1234-5678-9012', clicked_text: '正在查询示例' }
                ]
            ]);
        }

        e.reply('正在查询好友码信息，请稍候...', false, { recallMsg: 10 });

        try {
            const URL = `${API_GUO_FU_FRIEND}?key=${KEY_2}&gy=gf&uid=${friendCode}`;
            const URL_DATA = await (await fetch(URL)).json();

            if (URL_DATA.code !== 200) {
                return e.reply([
                    { key: 'a', values: [`##`] },
                    { key: 'b', values: [` 查询失败`] },
                    { key: 'c', values: [`错误信息：${URL_DATA.msg}`] }
                ], [
                    [
                        { text: '重新查询', input: '好友码查询', clicked_text: '正在重新查询' }
                    ]
                ]);
            }

            // 扣除次数
            USER_FILE_DATA[USER_ID] = {
                ...USER_FILE_DATA[USER_ID],
                times: TIMES - 1
            };
            await SAVE(USER_FILE, USER_FILE_DATA);

            // 解构数据
            const { scale, height, maxHeight, minHeight, currentHeight } = URL_DATA['data'];
            const { hair, horn, mask, neck, body, hat, prop, face, feet, wing } = URL_DATA['remote'];
            const time = new Date().toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            })

            const displayTimes = TIMES >= 10000 ? '∞' : TIMES - 1;

            // 返回好友码查询结果
            return replyMarkdownButton(e, [
                { key: 'a', values: [`<@${USER_ID}>`] },
                { key: 'b', values: [`\r# 这里是好友码查询结果，请查收\r> ${time}\r\r`] },
                { key: 'c', values: ["``"] },
                { key: 'd', values: [`\`\r————用户身高————\r🍊体型S值是：${parseFloat(scale).toFixed(5)}\r🍊身高H值是：${parseFloat(height).toFixed(5)}\r🍊最高是：${parseFloat(maxHeight).toFixed(5)}\r🍊最矮是：${parseFloat(minHeight).toFixed(5)}\r🍊目前身高：${parseFloat(currentHeight).toFixed(5)}\r🍊剩余查询次数：${displayTimes}`] },
                { key: 'e', values: [`\r————用户装扮————\r🍊发型：${hair}\r🍊头饰：${hat}\r🍊面具：${mask}\r🍊面饰：${face}\r🍊耳饰：${horn}\r🍊颈部：${neck}\r🍊裤子：${body}\r🍊鞋子：${feet}\r🍊斗篷：${wing}\r🍊背饰：${prop}`] },
                { key: 'f', values: ['\r————橙子BOT————``'] },
                { key: 'g', values: ['`'] }
            ], [
                [
                    { text: '重新查询', input: '好友码查询', clicked_text: '正在重新查询' },
                    { text: '兑换国服次数', input: '兑换国服次数（此处填写兑换码，连同括号一起替换掉）', clicked_text: '正在兑换国服次数' }
                ]
            ]);

        } catch (error) {
            console.error('好友码查询失败:', error);
            return e.reply([
                { key: 'a', values: [`##`] },
                { key: 'b', values: [` 查询失败`] },
                { key: 'c', values: [`请稍后重试`] }
            ], [
                [
                    { text: '重新查询', input: '好友码查询', clicked_text: '正在重新查询' }
                ]
            ]);
        }
    }

    async QUERY_GJF(e) {
        if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }

        if (await this.WF(e) !== 0) return;

        const USER_ID = e.user_id?.slice(11);
        const USER_FILE_DATA = await GD(USER_FILE);

        if (!USER_FILE_DATA[USER_ID]) return e.reply([
            { key: 'a', values: [`##`] },
            { key: 'b', values: [` 您尚绑定光遇长ID，请从游戏内获取长ID绑定`] },
        ], [
            [
                { text: '绑定国际服ID', input: '国际服绑定xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx', clicked_text: '正在绑定国际服ID' },
                { text: '如何获取ID', link: 'https://pan.t1qq.com/view.php/70256ea206338d7268a43ab682d9bdf7.jpg', clicked_text: '正在跳转' },
            ]
        ]);

        const SKY_UID = USER_FILE_DATA[USER_ID]['GJFSKY_UID'];

        if (SKY_UID === "") return e.reply([
            { key: 'a', values: [`##`] },
            { key: 'b', values: [` 您尚绑定光遇长ID，请从游戏内获取长ID绑定`] },
        ], [
            [
                { text: '绑定国际服ID', input: '国际服绑定xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx', clicked_text: '正在绑定国际服ID' },
                { text: '如何获取ID', link: 'https://pan.t1qq.com/view.php/70256ea206338d7268a43ab682d9bdf7.jpg', clicked_text: '正在跳转' },
            ]
        ]);

        let LIVE_TIMES = USER_FILE_DATA[USER_ID]['live_times'];

        e.reply('正在查询，请耐心等待！', false, { recallMsg: 10 });

        let URL = `${API_GUO_FU}?key=${KEY_1}&id=${SKY_UID}`;

        const URL_DATA = await (await fetch(URL)).json();
        const CODE = URL_DATA['code'];
        const TIME = URL_DATA['time'];

        if (CODE === 200) {
            const { scale, height, maxHeight, minHeight, currentHeight } = URL_DATA['data'];
            const { hair, horn, mask, neck, pants, cloak, prop } = URL_DATA['adorn'];
            const { voice, attitude } = URL_DATA['action'];

            return setTimeout(() => {
                e.reply([
                    { key: 'a', values: [`<@${USER_ID}>`] },
                    { key: 'b', values: [`\r# 这里是国际服数据，请查收\r> ${TIME}\r\r`] },
                    { key: 'c', values: ["``"] },
                    { key: 'd', values: [`\`\r————用户身高————\r🍊体型S值是：${parseFloat(scale).toFixed(5)}\r🍊身高H值是：${parseFloat(height).toFixed(5)}\r🍊最高是：${parseFloat(maxHeight).toFixed(5)}\r🍊最矮是：${parseFloat(minHeight).toFixed(5)}\r🍊目前身高：${parseFloat(currentHeight).toFixed(5)}`] },
                    { key: 'e', values: [`\r————用户装扮————\r🍊发型：${hair}\r🍊头饰：${horn}\r🍊面具：${mask}\r🍊项链：${neck}\r🍊裤子：${pants}\r🍊斗篷：${cloak}\r🍊背饰：${prop}`] },
                    { key: 'f', values: [`\r————用户状态————\r🍊叫声：${voice}\r🍊站姿：${attitude}\r————橙子BOT———\`\``] },
                    { key: 'g', values: ['`'] }
                ], [
                    [
                        { text: '再次查询', callback: '国际服身高查询' },
                    ]
                ]);
            });
        } else if (CODE === 201) {
            return e.reply([
                { key: 'a', values: [`##`] },
                { key: 'b', values: [` ID错误，请重新绑定`] },
            ], [
                [
                    { text: '绑定国际服ID', input: '国际服绑定xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx', clicked_text: '正在绑定国际服ID' },
                    { text: '如何获取ID', link: 'https://pan.t1qq.com/view.php/70256ea206338d7268a43ab682d9bdf7.jpg', clicked_text: '正在跳转' },
                ]
            ]);
        } else {
            return e.reply([
                { key: 'a', values: [`##`] },
                { key: 'b', values: [` 接口返回异常:${CODE}`] },
                { key: 'c', values: [`\r> 请联系主人反馈问题`] },
            ], [
                [
                    { text: '重新查询', callback: '国际服身高查询', clicked_text: '正在重新查询' },
                    { text: '联系主人', link: 'https://qm.qq.com/q/Mfra27jTmQ', clicked_text: '正在跳转' },
                ]
            ]);
        }
    }

    async GENERATE_GFREDEMPTION_CODE(e) {
        if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }

        const times = parseFloat(e.msg.replace(/#|\/|生成国服次数\*/g, '').trim())
        if (!times) return e.reply('不是纯数字')

        const USER_ID = e.user_id?.slice(11)
        const USER_FILE_DATA = await GD(USER_FILE)

        // 检查用户是否有足够的次数
        if (!USER_FILE_DATA[USER_ID] || !USER_FILE_DATA[USER_ID]['times'] || USER_FILE_DATA[USER_ID]['times'] < times) {
            return e.reply([
                { key: 'a', values: [`##`] },
                { key: 'b', values: [` 次数不足`] },
                { key: 'c', values: [`\r> 您当前剩余次数：${USER_FILE_DATA[USER_ID]?.times || 0}次\r> 需要生成次数：${times}次`] },
            ], [
                [
                    { text: '购买次数', callback: '购买次数', clicked_text: '正在购买次数' },
                    { text: '查询剩余次数', callback: '查询绑定id', clicked_text: '正在查询绑定id' }
                ]
            ]);
        }

        const CHARACTER = [
            '0', '1', '2', '3', '4', '5',
            '6', '7', '8', '9', 'Q', 'W',
            'E', 'R', 'T', 'Y', 'U', 'I',
            'O', 'P', 'A', 'S', 'D', 'F',
            'G', 'H', 'J', 'K', 'L', 'Z',
            'X', 'C', 'V', 'B', 'N', 'M',
        ]
        let code = ''
        for (let i = 0; i < 7; i++) {
            const randomIndex = Math.floor(Math.random() * CHARACTER.length);
            code += CHARACTER[randomIndex];
        }

        const CODE_FILE_DATA = await GD(GFCODE_FILE)

        if (e.isMaster) {
            CODE_FILE_DATA[code] = times
        } else {
            // 扣除用户次数
            USER_FILE_DATA[USER_ID]['times'] -= times
            await SAVE(USER_FILE, USER_FILE_DATA)
            // 生成兑换码
            CODE_FILE_DATA[code] = times
        }

        return replyMarkdownButton(e, [
            { key: 'a', values: [`##`] },
            { key: 'b', values: [` 生成成功`] },
            { key: 'c', values: [`\r> 兑换码：${code}\r> 包含次数：${times}次\r> 剩余次数：${USER_FILE_DATA[USER_ID]['times']}次`] },
        ], [
            [
                { text: '复制兑换码', input: `${code}` },
                { text: '生成一次', callback: `生成国服次数*1` },
                { text: '生成十次', callback: `生成国服次数*10` },
            ]
        ]);
        await SAVE(GFCODE_FILE, CODE_FILE_DATA)
    }

    async USE_GFCDKEY(e) {
        if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }

        if (await this.WF(e) !== 0) return

        const USER_ID = e.user_id?.slice(11)

        const CDKEY = (e.msg.match(USE_GFCDKEY_REGEX))[2].replace(/\s/g, '')
        if (CDKEY.length === 0) return e.reply([
            { key: 'a', values: [`##`] },
            { key: 'b', values: [` 请在指令后附带兑换码\r`] },
            { key: 'c', values: [`> 如：兑换国服次数XIAOCHENG666`] },
        ], [
            { text: '重新兑换', input: `兑换国服次数XIAOCHENG666` },
        ]);
        const CODE_FILE_DATA = await GD(GFCODE_FILE)
        if (!CODE_FILE_DATA[CDKEY] || CODE_FILE_DATA[CDKEY] === 0) return e.reply([
            { key: 'a', values: [`##`] },
            { key: 'b', values: [` 无此国服兑换码`] },
        ], [
            [
                { text: '重新兑换', input: `兑换国服次数XIAOCHENG666`, clicked_text: '正在重新兑换' },
            ]
        ]);

        const USER_FILE_DATA = await GD(USER_FILE)
        if (!USER_FILE_DATA[USER_ID]) {
            USER_FILE_DATA[USER_ID] = {
                SKY_UID: "",
                GJFSKY_UID: "",
                times: CODE_FILE_DATA[CDKEY],
                live_times: "",
            }
        } else {
            USER_FILE_DATA[USER_ID] = {
                SKY_UID: USER_FILE_DATA[USER_ID]['SKY_UID'],
                GJFSKY_UID: USER_FILE_DATA[USER_ID]['GJFSKY_UID'],
                times: USER_FILE_DATA[USER_ID]['times'] + CODE_FILE_DATA[CDKEY],
                live_times: USER_FILE_DATA[USER_ID]['live_times'],
            }
        }

        return replyMarkdownButton(e, [
            { key: 'a', values: [`##`] },
            { key: 'b', values: [` 兑换成功！\r`] },
            { key: 'c', values: [`> 获得国服次数：**${CODE_FILE_DATA[CDKEY]}**`] },
        ], [
            [
                { text: '查询国服身高', callback: '国服身高查询' },
            ]
        ]);
        CODE_FILE_DATA[CDKEY] = 0
        await SAVE(GFCODE_FILE, CODE_FILE_DATA)
        await SAVE(USER_FILE, USER_FILE_DATA)
    }

    async OPEN_GROUP(e) {
        logger.info('[光遇身高查询] 开始处理开放群聊请求');

        if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }

        try {
            const GROUP_ID = e.group_id;
            if (!e.isMaster) {
                logger.info('[光遇身高查询] 非主人尝试开放群聊');
                return e.reply([
                    { key: 'a', values: [`##`] },
                    { key: 'b', values: [` 权限不足`] },
                    { key: 'c', values: [`\r> 该指令仅限主人使用`] }
                ]);
            }

            const FREE_GROUP_ID = await GD(OPEN_GROUP_FILE);
            if (!FREE_GROUP_ID['FREE_GROUP_ID_1']) {
                FREE_GROUP_ID['FREE_GROUP_ID_1'] = [];
            }

            if (FREE_GROUP_ID['FREE_GROUP_ID_1'].includes(GROUP_ID)) {
                logger.info(`[光遇身高查询] 群聊 ${GROUP_ID} 已经开放`);
                return e.reply([
                    { key: 'a', values: [`##`] },
                    { key: 'b', values: [` 该群已经开放过了，可以查询啦~`] }
                ], [
                    { text: '查国服身高', callback: '国服身高查询', clicked_text: '正在查询国服身高' },
                    { text: '国际服身高', callback: '国际服身高查询', clicked_text: '正在查询国际服身高' }
                ]);
            }

            FREE_GROUP_ID['FREE_GROUP_ID_1'].push(GROUP_ID);
            await SAVE(OPEN_GROUP_FILE, FREE_GROUP_ID);
            logger.info(`[光遇身高查询] 成功开放群聊 ${GROUP_ID}`);

            return e.reply([
                { key: 'a', values: [`##`] },
                { key: 'b', values: [` 该群已开放！可以查询啦~\r`] }
            ], [
                { text: '查国服身高', callback: '国服身高查询', clicked_text: '正在查询国服身高' },
                { text: '国际服身高', callback: '国际服身高查询', clicked_text: '正在查询国际服身高' }
            ]);

        } catch (error) {
            logger.error(`[光遇身高查询] 开放群聊失败: ${error}`);
            return e.reply('开放群聊失败，请稍后重试');
        }
    }

    async BUY_TIMES(e) {
        if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }

        if (await this.WF(e) !== 0) return;

        return replyMarkdownButton(e, [
            { key: 'a', values: ['##'] },
            { key: 'b', values: [' 🍊橙子身高查询次数购买说明\r``'] },
            { key: 'c', values: ['`\r🔸国服次数价格：\r· 5次：1.5元\r· 10次：3元\r· 30次：9元\r· 50次：15元\r· 100次：30元\r🔸国际服：免费'] },
            { key: 'd', values: ['``'] },
            { key: 'e', values: ['`\r温馨提示：\r1. 购买后请保存好兑换码\r2. 次数永久有效\r\r'] },
            { key: 'f', values: ['> 最终解释权归橙子科技工作室所有'] }
        ], [
            [
                { text: '购买国服次数', link: 'https://wiki.kevcore.cn/height/' },
                { text: '联系客服', link: 'https://qm.qq.com/q/Mfra27jTmQ' }
            ],
            [
                { text: '兑换次数', input: '兑换国服次数', clicked_text: '正在兑换次数' },
                { text: '查询剩余次数', callback: '查询绑定id', clicked_text: '正在查询绑定id' }
            ]
        ]);
    }

    async CHECK_TOTAL_TIMES(e) {
        if (!isQQBot(e)) { await e.reply('请艾特橙子BOT使用'); return false }

        // 检查是否为主人
        if (!e.isMaster) {
            return replyMarkdownButton(e, [
                { key: 'a', values: ['##'] },
                { key: 'b', values: [' 权限不足'] },
                { key: 'c', values: ['\r> 该指令仅限主人使用'] }
            ], []);
        }

        try {
            const response = await fetch(`${API_GUO_JI}?key=${KEY_2}`);
            const data = await response.json();

            if (data && 'ID剩余次数' in data) {
                return replyMarkdownButton(e, [
                    { key: 'a', values: ['##'] },
                    { key: 'b', values: [' 🍊橙子身高查询系统'] },
                    { key: 'c', values: [`\r> 目前系统剩余总次数：${data['ID剩余次数']}次\r> 今日使用次数：${data['ID今天使用次数']}次\r> 总成功次数：${data['ID总成功次数']}次\r> 总失败次数：${data['ID总失败次数']}次`] }
                ], [
                    [
                        { text: '生成十次', callback: '生成国服次数*10', clicked_text: '正在生成十次' },
                        { text: '查询个人次数', callback: '查询绑定id', clicked_text: '正在查询绑定id' }
                    ]
                ]);
            } else {
                return replyMarkdownButton(e, [
                    { key: 'a', values: ['##'] },
                    { key: 'b', values: [' 查询失败'] },
                    { key: 'c', values: ['\r> 接口返回数据格式异常'] }
                ], []);
            }
        } catch (error) {
            logger.error('查询总次数失败:', error);
            return replyMarkdownButton(e, [
                { key: 'a', values: ['##'] },
                { key: 'b', values: [' 查询失败'] },
                { key: 'c', values: ['\r> 请稍后重试'] }
            ], []);
        }
    }

    async WF(e) {
        try {
            if (e.isMaster) {
                return 0;
            }
            const GROUP_ID = e.group_id;
            if (!GROUP_ID) {
                logger.info('[光遇身高查询] 非群聊消息');
                return replyMarkdownButton(e, [
                    { key: 'a', values: ['##'] },
                    { key: 'b', values: [' 私聊无法查询'] }
                ], [
                    [
                        { text: '加入身高群', link: 'https://qm.qq.com/q/vWkWLP7W36' }
                    ]
                ]);
            }

            const FREE_GROUP_ID = await GD(OPEN_GROUP_FILE);
            if (!FREE_GROUP_ID || !FREE_GROUP_ID['FREE_GROUP_ID_1']) {
                logger.info('[光遇身高查询] 无群组权限数据');
                return -1;
            }

            if (!FREE_GROUP_ID['FREE_GROUP_ID_1'].includes(GROUP_ID)) {
                return replyMarkdownButton(e, [
                    { key: 'a', values: ['##'] },
                    { key: 'b', values: [' 该群无权限查询，请加专属身高群查询'] }
                ], [
                    [
                        { text: '加入身高群', link: 'https://qm.qq.com/q/vWkWLP7W36' }
                    ]
                ]);
            }
            return 0;
        } catch (error) {
            logger.error(`[光遇身高查询] 权限检查失败: ${error}`);
            return -1;
        }
    }
}