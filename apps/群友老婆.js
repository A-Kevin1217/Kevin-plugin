import mysql from'mysql2';
import { createPool } from'mysql2/promise';
import { replyMarkdownButton } from '../components/CommonReplyUtil.js'

const pool = createPool({
    host: 'localhost',
    user: 'marry',
    password: 'NeGHiFNbEC2fn7cx',
    database: 'marry',
    waitForConnections: true,
    connectionLimit: 10
});

const handleDatabaseError = async (reply, e, operation, error) => {
    let errorMessage = `Database ${operation} error: ${error.message}`;
    console.error(errorMessage);
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
        await reply("数据库权限不足，请联系管理员。");
    } else {
        await reply("数据库操作出错，请稍后重试。");
    }
};

function buildReplyParamsAndButtons(userId, result1, imgUrl, atMode = false, noMember = false) {
    let params = [
        { key: 'a', values: [`<@${userId?.slice(11)}>`] },
        { key: 'b', values: ['\r你的群友老婆是\r'] },
    ];
    if (!noMember) {
        if (!atMode) {
            params.push({ key: 'c', values: [`<@${result1}>`] });
        }
        params.push({ key: 'd', values: [`\r![橙子BOT #100px #100px](${imgUrl})`] });
    } else {
        params.push({ key: 'd', values: [`\r![橙子BOT #100px #100px](${imgUrl})\r***\r>暂时没有记录的群员了，叫大家一起来用橙子BOT吧`] });
    }
    let buttons = [
        [
            { text: '💞群友老婆', callback: '群友老婆', clicked_text: '正在获取群友老婆' },
            { text: '🐾猫猫糕', callback: '/今日猫猫糕', clicked_text: '正在获取猫猫糕' }
        ],
        [
            { text: '不@对方', callback: '群友老婆-@', clicked_text: '不@对方' },
            { text: '丢', callback: 'meme-15', clicked_text: '丢' },
            { text: '更多表情', callback: '更多表情meme', clicked_text: '正在获取更多表情' }
        ]
    ];
    return { params, buttons };
}

export class example extends plugin {
    constructor() {
        super({
            name: '取群友',
            dsc: 'marry',
            event: 'message',
            priority: 5000,
            rule: [
                {
                    reg: "^(#|/)?群友老婆(-@)?$",
                    fnc: 'gGL',
                },
                {
                    reg: "^(#|/)?离婚$",
                    fnc: 'divorce',
                }
            ]
        });
    }

    async gGL(e) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, 0);
        const day = String(now.getDate()).padStart(2, 0);
        const today = `${year}${month}${day}`;
        const groupTable = `group${today}`;
        const userTable = `user${today}`;
        const groupId = String(e.group_id);
        const userId = String(e.user_id);

        try {
            await this.ensureTodayTables();
            const alreadyInGroup = await this.userInGroupToday(groupTable, groupId, userId);
            if (alreadyInGroup) {
                const result = await this.getUserData(userTable, groupId, userId);
                if (result) {
                    logger.info(`User data found: ${result}`);
                    let result1 = result.slice(11);
                    let newUrlReplaced = `https://q.qlogo.cn/qqapp/102134274/${result1}/640?${Math.floor(10000000 + Math.random() * 90000000)}`;
                    let atMode = e.raw_message.endsWith('-@');
                    let { params, buttons } = buildReplyParamsAndButtons(userId, result1, newUrlReplaced, atMode);
                    await replyMarkdownButton(e, params, buttons);
                    return;
                }
            } else {
                const randomWife = await this.getRandomWifeExcludingUsed(e, groupTable, groupId);
                if (!randomWife) {
                    let imgUrl = 'https://gd-hbimg.huaban.com/42fb51fa7608d4b48dedf14e002e7865a7589d2c56522-QDB6gM';
                    let { params, buttons } = buildReplyParamsAndButtons(userId, '', imgUrl, false, true);
                    await replyMarkdownButton(e, params, buttons);
                    return;
                }
                const user = randomWife.user_id;
                await this.insertDataToTables(e, userId, user);
                let replacement = user.slice(11);
                let newUrlReplaced = `https://q.qlogo.cn/qqapp/102134274/${replacement}/640?${Math.floor(10000000 + Math.random() * 90000000)}`;
                let atMode = e.raw_message.endsWith('-@');
                let { params, buttons } = buildReplyParamsAndButtons(userId, replacement, newUrlReplaced, atMode);
                await replyMarkdownButton(e, params, buttons);
                return;
            }
        } catch (error) {
            await handleDatabaseError(e.reply.bind(e), e, "general operation", error);
        }
    }

    async userInGroupToday(groupTable, groupId, userId) {
        try {
            const sql = `SELECT userids FROM ${groupTable} WHERE groupid =?`;
            const [results] = await pool.query(sql, [groupId]);
            if (results && results.length > 0 && results[0].userids) {
                const userIds = JSON.parse(results[0].userids);
                return userIds.includes(userId);
            }
            return false;
        } catch (e) {
            await handleDatabaseError(this.reply.bind(this), e, "userInGroupToday query", e);
            return false;
        }
    }

    async getUserData(userTable, groupId, userId) {
        try {
            const sql = `SELECT * FROM ${userTable} WHERE groupid =? AND (userid =? OR wifeid =?)`;
            const [results] = await pool.query(sql, [groupId, userId, userId]);
            if (results && results.length > 0) {
                const result = results[0];
                return result.userid === userId? result.wifeid : result.userid;
            }
            return null;
        } catch (e) {
            await handleDatabaseError(this.reply.bind(this), e, "getUserData query", e);
            return null;
        }
    }

    async ensureTodayTables() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, 0);
        const day = String(now.getDate()).padStart(2, 0);
        const today = `${year}${month}${day}`;
        const userTable = `user${today}`;
        const groupTable = `group${today}`;

        // Check and create user table if it doesn't exist
        try {
            const sqlUserTableCheck = `SHOW TABLES LIKE '${userTable}'`;
            const [userTableExists] = await pool.query(sqlUserTableCheck);
            if (userTableExists.length === 0) {
                const createUserTableSql = `CREATE TABLE ${userTable} (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        userid VARCHAR(255) NOT NULL,
                        wifeid VARCHAR(255) NOT NULL,
                        groupid VARCHAR(255) NOT NULL
                    ) CHARSET=utf8mb4`;
                await pool.query(createUserTableSql);
            }
        } catch (e) {
            await handleDatabaseError(this.reply.bind(this), e, "create user table", e);
        }

        // Check and create group table if it doesn't exist
        try {
            const sqlGroupTableCheck = `SHOW TABLES LIKE '${groupTable}'`;
            const [groupTableExists] = await pool.query(sqlGroupTableCheck);
            if (groupTableExists.length === 0) {
                const createGroupTableSql = `CREATE TABLE ${groupTable} (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        userids TEXT NOT NULL,
                        groupid VARCHAR(255) NOT NULL
                    ) CHARSET=utf8mb4`;
                await pool.query(createGroupTableSql);
            }
        } catch (e) {
            await handleDatabaseError(this.reply.bind(this), e, "create group table", e);
        }

        // 新增离婚次数表
        try {
            const sqlCsTableCheck = `SHOW TABLES LIKE 'cs${today}'`;
            const [csTableExists] = await pool.query(sqlCsTableCheck);
            if (csTableExists.length === 0) {
                const createCsTableSql = `CREATE TABLE cs${today} (
                    groupid VARCHAR(255) NOT NULL,
                    userid VARCHAR(255) NOT NULL,
                    count INT NOT NULL DEFAULT 0,
                    PRIMARY KEY (groupid, userid)
                ) CHARSET=utf8mb4`;
                await pool.query(createCsTableSql);
            }
        } catch (e) {
            await handleDatabaseError(this.reply.bind(this), e, "create cs table", e);
        }
    }

    async insertDataToTables(e, selfId, wifeId) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, 0);
        const day = String(now.getDate()).padStart(2, 0);
        const today = `${year}${month}${day}`;
        const userTable = `user${today}`;
        const groupTable = `group${today}`;
        const groupId = String(e.group_id);

        // 插入数据到用户表
        try {
            const insertUserTableSql = `INSERT INTO ${userTable} (userid, wifeid, groupid) VALUES (?,?,?)`;
            await pool.query(insertUserTableSql, [selfId, wifeId, groupId]);
        } catch (e) {
            await handleDatabaseError(this.reply.bind(this), e, "insert user data", e);
        }

        // 检查并更新群组表
        try {
            const selectGroupTableSql = `SELECT * FROM ${groupTable} WHERE groupid =?`;
            const [groupResults] = await pool.query(selectGroupTableSql, [groupId]);
            if (!groupResults || groupResults.length === 0) {
                // 如果没有当前群id，创建新条目
                const insertGroupTableSql = `INSERT INTO ${groupTable} (groupid, userids) VALUES (?,?)`;
                await pool.query(insertGroupTableSql, [groupId, JSON.stringify([selfId, wifeId])]);
            } else {
                // 如果有当前群id，更新userids
                const currentIds = JSON.parse(groupResults[0].userids);
                currentIds.push(selfId, wifeId);
                const updateGroupTableSql = `UPDATE ${groupTable} SET userids =? WHERE groupid =?`;
                await pool.query(updateGroupTableSql, [JSON.stringify(currentIds), groupId]);
            }
        } catch (e) {
            await handleDatabaseError(this.reply.bind(this), e, "update group data", e);
        }
    }

    async getRandomWifeExcludingUsed(e, groupTable, groupId) {
        let mmap = await e.group.getMemberMap();
        let arrMember = Array.from(mmap.values());
        const selfMember = arrMember.find(member => member.user_id === String(e.user_id));
        let excludeUserIds = [String(e.self_id), String(e.user_id)];

        // 获取今天已经使用过的ID列表
        try {
            const sql = `SELECT userids FROM ${groupTable} WHERE groupid =?`;
            const [results] = await pool.query(sql, [groupId]);
            let usedIds = [];
            if (results && results.length > 0 && results[0].userids) {
                usedIds = JSON.parse(results[0].userids);
            }
            // 过滤已经使用过的ID
            let filteredArrMember = arrMember.filter(member =>
                !excludeUserIds.includes(String(member.user_id)) &&
                !usedIds.includes(String(member.user_id))
            );

            if (filteredArrMember.length === 0) {
                return;
            }

            return filteredArrMember[Math.floor(Math.random() * filteredArrMember.length)];
        } catch (e) {
            await handleDatabaseError(this.reply.bind(this), e, "get used Ids query", e);
            return null;
        }
    }

    // 离婚功能相关辅助方法
    async getDivorceCount(csTable, groupId, userId) {
        const sql = `SELECT count FROM ${csTable} WHERE groupid = ? AND userid = ?`;
        const [rows] = await pool.query(sql, [groupId, userId]);
        return rows.length ? rows[0].count : 0;
    }

    async updateDivorceCount(csTable, groupId, userId) {
        const sql = `INSERT INTO ${csTable} (groupid, userid, count) VALUES (?, ?, 1)
            ON DUPLICATE KEY UPDATE count = LEAST(count + 1, 2)`;
        await pool.query(sql, [groupId, userId]);
    }

    async getSpouse(userTable, groupId, userId) {
        const sql = `SELECT wifeid, userid FROM ${userTable} WHERE groupid = ? AND (userid = ? OR wifeid = ?)`;
        const [rows] = await pool.query(sql, [groupId, userId, userId]);
        if (!rows.length) return null;
        return rows[0].userid === userId ? rows[0].wifeid : rows[0].userid;
    }

    async deleteMarriageRecord(userTable, groupId, userId, spouse) {
        const sql = `DELETE FROM ${userTable} WHERE groupid = ? AND ((userid = ? AND wifeid = ?) OR (userid = ? AND wifeid = ?))`;
        await pool.query(sql, [groupId, userId, spouse, spouse, userId]);
    }

    async updateGroupTable(groupTable, groupId, removeIds) {
        const sql = `SELECT userids FROM ${groupTable} WHERE groupid = ?`;
        const [rows] = await pool.query(sql, [groupId]);
        if (rows.length) {
            let userIds = JSON.parse(rows[0].userids);
            userIds = userIds.filter(id => !removeIds.includes(id));
            const updateSql = `UPDATE ${groupTable} SET userids = ? WHERE groupid = ?`;
            await pool.query(updateSql, [JSON.stringify(userIds), groupId]);
        }
    }

    async divorce(e) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, 0);
        const day = String(now.getDate()).padStart(2, 0);
        const today = `${year}${month}${day}`;
        const csTable = `cs${today}`;
        const userTable = `user${today}`;
        const groupTable = `group${today}`;
        const groupId = String(e.group_id);
        const userId = String(e.user_id);

        try {
            await this.ensureTodayTables();
            if (await this.getDivorceCount(csTable, groupId, userId) >= 2) {
                let params = [
                    { key: 'a', values: [`<@${userId?.slice(11)}>`] },
                    { key: 'b', values: ['不要移情别恋了哦，今天已经离婚两次啦~'] }
                ];
                let buttons = [
                    [
                        { text: '🐾猫猫糕', callback: '/今日猫猫糕', clicked_text: '正在获取猫猫糕' }
                    ],
                    [
                        { text: '丢', callback: 'meme-15', clicked_text: '丢' },
                        { text: '更多表情', callback: '更多表情meme', clicked_text: '正在获取更多表情' }
                    ]
                ];
                await replyMarkdownButton(e, params, buttons);
                return;
            }
            const spouse = await this.getSpouse(userTable, groupId, userId);
            if (!spouse) {
                let params = [
                    { key: 'a', values: [`<@${userId?.slice(11)}>`] },
                    { key: 'b', values: ['离婚失败，今日还没有老婆呢'] }
                ];
                let buttons = [
                    [
                        { text: '💞群友老婆', callback: '群友老婆', clicked_text: '正在获取群友老婆' },
                        { text: '不@对方', callback: '群友老婆-@', clicked_text: '不@对方' }
                    ],
                    [
                        { text: '🐾猫猫糕', callback: '/今日猫猫糕', clicked_text: '正在获取猫猫糕' }
                    ]
                ];
                await replyMarkdownButton(e, params, buttons);
                return;
            }
            await this.deleteMarriageRecord(userTable, groupId, userId, spouse);
            await this.updateGroupTable(groupTable, groupId, [userId, spouse]);
            await this.updateDivorceCount(csTable, groupId, userId);
            let params = [
                { key: 'a', values: [`<@${userId?.slice(11)}>`] },
                { key: 'b', values: ['一段感情的结束....'] }
            ];
            let buttons = [
                [
                    { text: '💞群友老婆', callback: '群友老婆', clicked_text: '正在获取群友老婆' },
                    { text: '不@对方', callback: '群友老婆-@', clicked_text: '不@对方' }
                ],
                [
                    { text: '🐾猫猫糕', callback: '/今日猫猫糕', clicked_text: '正在获取猫猫糕' }
                ]
            ];
            await replyMarkdownButton(e, params, buttons);
        } catch (error) {
            await handleDatabaseError(e.reply.bind(e), e, "divorce operation", error);
        }
    }
}