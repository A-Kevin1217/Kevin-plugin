import fs from 'fs';

const gameDataPath = 'data/.AAA 电子木鱼游戏数据'
fs.mkdirSync(`${gameDataPath}/用户`, { recursive: true });
fs.mkdirSync(`${gameDataPath}/记录`, { recursive: true });
// 添加用户连续敲击记录
const userClickSessions = new Map();
// 存储最后一次交互的e对象
const lastInteractionE = new Map();
// 存储消息发送时间
const messageTimestamps = new Map();

export class example extends plugin {
    constructor() {
        super({
            name: '[Game]电子木鱼',
            dsc: 'example',
            event: 'message',
            priority: 1,
            rule: [
                { reg: /^(#|\/)?敲木鱼$/, fnc: 'F1' },
                { reg: /^(#|\/)?(今日|本群(今日)?)?功德榜/, fnc: 'F2' },
                { reg: /^(#|\/)?木鱼记录$/, fnc: 'F3' },
                { reg: /^(#|\/)?设置木鱼昵称\s*(.+)$/, fnc: 'F4' }
            ]
        })
        
        // 设置定时器清理长时间不活跃的会话
        setInterval(() => {
            const now = Date.now();
            for (const [userId, session] of userClickSessions.entries()) {
                // 检查是否需要发送新消息（每4分50秒）
                const messageTime = messageTimestamps.get(userId) || 0;
                if (session.count > 0 && now - messageTime >= 290000) { // 4分50秒 = 290000毫秒
                    this.sendRefreshMessage(userId);
                }
                
                // 检查是否需要结束会话（10秒无操作）
                if (now - session.lastClickTime > 10000) {
                    this.endClickSession(userId);
                }
            }
        }, 5000); // 每5秒检查一次
    }
    
    // 发送刷新消息
    async sendRefreshMessage(userId) {
        const session = userClickSessions.get(userId);
        const e = lastInteractionE.get(userId);
        if (!session || !e) return;
        
        e.reply([
            segment.markdown({
                custom_template_id: "102059511_1713948595",
                params: [
                    { key: 'a', values: [`<@${userId}>\r`] },
                    { key: 'b', values: ['#'] },
                    { key: 'c', values: [`继续敲击木鱼\r`] },
                    { key: 'd', values: [`\r已连续敲击 ${session.count} 次\r继续点击+1按钮可以积累更多功德`] }
                ]
            }),
            segment.button([
                {text:'+1',callback:'敲木鱼',type:1}
            ])
        ]);
        
        // 更新消息时间戳
        messageTimestamps.set(userId, Date.now());
    }
    
    async F1(e) {
        const platform = e.bot?.adapter?.name || e.platform || '未知'
        if (platform !== 'QQBot') {
            await e.reply('请艾特六阶堂穗玉使用')
            return false
        }
        /** 用户ID */
        const userId = e.user_id?.slice(11)
        /** 群ID */
        const groupId = e.group_id
        /** 今日日期 */
        const todayDate = getTodayDate()
        /** 文件路径 */
        const filePath = {
            user: `${gameDataPath}/用户/${userId}.json`,
            todayRecord: `${gameDataPath}/记录/${todayDate}.json`
        }
        /** 用户数量 */
        const userNumber = fs.readdirSync(`${gameDataPath}/用户`)['length'] + 100001

        // 存储最后一次交互的e对象，用于结算时发送消息
        lastInteractionE.set(userId, e);

        // 判断用户是否存在，不存在创建基础信息
        if (!fs.existsSync(filePath['user'])) {
            storeJson(filePath['user'], {
                N: userNumber,
                ID: userId,
                GID: groupId,
                nickname: `木鱼用户${userNumber}号`,
                total: 0,
                Historical: {}
            })
        }

        // 判断今日是否有记录，没有则创建今日记录
        if (!fs.existsSync(filePath['todayRecord'])) {
            storeJson(filePath['todayRecord'], {
                total: 0,
                group: [],
                user: []
            })
        }

        // 检查用户是否有正在进行的敲击会话
        if (!userClickSessions.has(userId)) {
            // 创建新的敲击会话
            userClickSessions.set(userId, {
                count: 0,
                groupId,
                lastClickTime: Date.now(),
                messageId: e.message_id
            });
            
            // 第一次敲击的提示
            let Tips = '';
            const todayData = await getJsonData(filePath['todayRecord']);
            
            if (!todayData['group'].includes(groupId)) {
                Tips = `今日第 ${todayData['group']['length'] + 1} 个敲击木鱼的群\r`
                todayData['group'].push(groupId)
                storeJson(filePath['todayRecord'], todayData)
            }
            if (!todayData['user'].includes(userId)) {
                Tips += `今日第 ${todayData['user']['length'] + 1} 位敲击木鱼的用户\r`
                todayData['user'].push(userId)
                storeJson(filePath['todayRecord'], todayData)
            }
            
            e.reply([
                segment.markdown({
                    custom_template_id: "102059511_1713948595",
                    params: [
                        { key: 'a', values: [`<@${userId}>\r${Tips}`] },
                        { key: 'b', values: ['#'] },
                        { key: 'c', values: ['开始敲击木鱼\r'] },
                        { key: 'd', values: ['连续点击+1按钮可以积累功德\r10秒内不点击将结算功德'] }
                    ]
                }),
                segment.button([
                    {text:'+1',callback:'敲木鱼',type:1}
                ])
            ]);
            
            // 记录消息发送时间
            messageTimestamps.set(userId, Date.now());
            
        } else {
            // 更新现有会话
            const session = userClickSessions.get(userId);
            session.count++;
            session.lastClickTime = Date.now();
            
            // 不发送新消息，用户继续点击原有按钮
        }
    }

    // 结束敲击会话并更新数据
    async endClickSession(userId) {
        const session = userClickSessions.get(userId);
        if (!session || session.count === 0) {
            userClickSessions.delete(userId);
            lastInteractionE.delete(userId);
            messageTimestamps.delete(userId);
            return;
        }
        
        // 获取最后一次交互的e对象
        const e = lastInteractionE.get(userId);
        if (!e) {
            userClickSessions.delete(userId);
            lastInteractionE.delete(userId);
            messageTimestamps.delete(userId);
            return;
        }
        
        const todayDate = getTodayDate();
        const filePath = {
            user: `${gameDataPath}/用户/${userId}.json`,
            todayRecord: `${gameDataPath}/记录/${todayDate}.json`
        };
        
        // 更新用户数据
        const userData = await getJsonData(filePath['user']);
        userData['total'] += session.count;
        userData['Historical'][todayDate] = (userData['Historical'][todayDate] || 0) + session.count;
        storeJson(filePath['user'], userData);
        
        // 更新今日数据
        const todayData = await getJsonData(filePath['todayRecord']);
        todayData['total'] += session.count;
        storeJson(filePath['todayRecord'], todayData);
        
        // 使用e.reply发送结算消息
        e.reply([
            segment.at(userId),
            segment.markdown({
                custom_template_id: "102059511_1713948595",
                params: [
                    { key: 'a', values: [`<@${userId}>\r`] },
                    { key: 'b', values: ['#'] },
                    { key: 'c', values: [` 木鱼功德结算\r`] },
                    { key: 'd', values: [`\r本次共敲击 ${session.count} 次\r今日累计 ${userData['Historical'][todayDate]} 次\r总功德 ${userData['total']}`] }
                ]
            }),
            segment.button([
                {text:'再来一次',callback:'敲木鱼',type:1}
            ]),
            segment.button([
                {text:'个人记录',callback:'木鱼记录',clicked_text:'正在获取个人记录'},
                {text:'总榜',callback:'今日功德榜',clicked_text:'正在获取总榜'},
            ])
        ]);
        
        // 删除会话
        userClickSessions.delete(userId);
        lastInteractionE.delete(userId);
        messageTimestamps.delete(userId);
    }

    async F2(e) {
        const platform = e.bot?.adapter?.name || e.platform || '未知'
        if (platform !== 'QQBot') {
            await e.reply('请艾特六阶堂穗玉使用')
            return false
        }
        const groupId = e.group_id;
        const rankingType = e.msg.match(/^(#|\/)?(今日|本群(今日)?)?功德榜$/)[2];
        const fileList = fs.readdirSync(`${gameDataPath}/用户`);
        const todayDate = getTodayDate();

        const rankingData = await Promise.all(fileList.map(async (userFile) => {
            const userFilePath = `${gameDataPath}/用户/${userFile}`;
            const userData = await getJsonData(userFilePath);

            if (rankingType === '本群') {
                if (userData['GID'] === groupId) {
                    return { A: userData['total'], B: userData['ID'], C: userData['nickname'] }
                } else {
                    return null
                }
            } else if (rankingType === '本群今日') {
                if (userData['GID'] === groupId) {
                    if (userData['Historical'][todayDate]) {
                        return { A: userData['total'], B: userData['ID'], C: userData['nickname'] }
                    } else {
                        return null
                    }
                } else {
                    return null
                }
            } else if (rankingType === '今日') {
                if (userData['Historical'][todayDate]) {
                    return { A: userData['total'], B: userData['ID'], C: userData['nickname'] }
                } else {
                    return null
                }
            } else {
                return { A: userData['total'], B: userData['ID'], C: userData['nickname'] }
            }
        }));

        const filteredRankingData = rankingData.filter(data => data !== null);
        filteredRankingData.sort((a, b) => b.A - a.A);
        const topRankingData = filteredRankingData.slice(0, 10);
        
        let replyMsg = `\r\r#${!rankingType ? '' : rankingType}功德榜\r***\r> `;
        
        for (let i = 0; i < topRankingData.length; i++) {
            replyMsg += `Top${i + 1}. ${topRankingData[i]['C']}\r功德: [${topRankingData[i]['A']}]\r`;
        }
        e.reply([segment.markdown({
            custom_template_id: "102059511_1713948595",
            params: [
                { key: 'a', values: [`${replyMsg}`] }
            ]
        }),segment.button([
            {text:'+1',callback:'敲木鱼',type:1}
        ]),segment.button([
            {text:'个人记录',callback:'木鱼记录',clicked_text:'正在获取个人记录'},
            {text:'总榜',callback:'今日功德榜',clicked_text:'正在获取总榜'},
            {text:'设置昵称',input:'设置木鱼昵称',clicked_text:'正在设置昵称'}
            ])
            ]);
    }


    async F3(e) {
        const platform = e.bot?.adapter?.name || e.platform || '未知'
        if (platform !== 'QQBot') {
            await e.reply('请艾特六阶堂穗玉使用')
            return false
        }
        const userId = e.user_id?.slice(11)
        const groupId = e.group_id
        const userNumber = fs.readdirSync(`${gameDataPath}/用户`)['length'] + 100001
        const userFilePath = `${gameDataPath}/用户/${userId}.json`
        const todayDate = getTodayDate()

        if (!fs.existsSync(userFilePath)) {
            storeJson(userFilePath, {
                N: userNumber,
                ID: userId,
                GID: groupId,
                nickname: e.adapter === 'QQBot' ? `木鱼用户${userNumber}号` : e.sender.nickname,
                total: 0,
                Historical: {}
            })
        }

        const userData = await getJsonData(userFilePath)

        e.reply([segment.markdown({
            custom_template_id: "102059511_1713948595",
            params: [
                { key: 'a', values: [`#`] },
                { key: 'b', values: [` 敲木鱼·个人记录<@${e.user_id?.slice(11)}>\r***\r\r`] },
                { key: 'c', values: [`> 功德: [${userData['total']}]`] },
                { key: 'd', values: [`\r今日敲击次数: [${!userData['Historical'][todayDate] ? 0 : userData['Historical'][todayDate]}]`] },
                { key: 'e', values: [`\r累计敲击天数: [${Object.keys(userData['Historical']).length}]`] }
            ]
        }),
        segment.button([
            {text:'+1',callback:'敲木鱼',type:1}
        ]),
        segment.button([
            {text:'个人记录',callback:'木鱼记录',clicked_text:'正在获取个人记录'},
            {text:'总榜',callback:'今日功德榜',clicked_text:'正在获取总榜'},
            ])
        ])
    }

    async F4(e) {
        const platform = e.bot?.adapter?.name || e.platform || '未知'
        if (platform !== 'QQBot') {
            await e.reply('请艾特六阶堂穗玉使用')
            return false
        }
        const userId = e.user_id?.slice(11);
        const match = e.msg.match(/^(#|\/)?设置木鱼昵称\s*(.+)$/);
        if (!match || !match[2]) {
            e.reply("请输入正确的格式：#设置木鱼昵称 新昵称");
            return;
        }
        const newName = match[2].replace(/\s+/g, ''); // 移除所有空格
        if (newName.length === 0) {
            e.reply("昵称不能为空，请重新设置");
            return;
        }
        const userFilePath = `${gameDataPath}/用户/${userId}.json`;

        if (!fs.existsSync(userFilePath)) {
            e.reply("您还没有木鱼记录，请先敲击木鱼来创建记录。");
            return;
        }

        const userData = await getJsonData(userFilePath);
        userData.nickname = newName;
        storeJson(userFilePath, userData);

        e.reply(`您的木鱼昵称已成功设置为："${newName}"`);
    }
}

/**
 * 存储JSON
 * @param {string} filePath 
 * @param {JSON} data 
 */
function storeJson(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
        console.log('数据已成功写入文件：' + filePath);
    } catch (err) {
        console.error('写入文件时发生错误：', err);
    }
}

/**
 * 读取JSON数据
 * @param {string} filePath JSON文件路径
 * @returns {JSON}
 */
async function getJsonData(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

/** 
 * 得到今日年月日
 * @returns {string}
 */
function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}
