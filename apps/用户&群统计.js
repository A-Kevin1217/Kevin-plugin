import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { isQQBot, replyMarkdownButton } from '../components/CommonReplyUtil.js'
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = mysql.createPool({
    host: 'localhost',
    user: 'kevin',
    password: '123456',
    database: 'kevin_bot'
});

export class example extends plugin {
    constructor() {
        super({
            name: '用户&群统计',
            dsc: '用于统计用户和群。',
            event: 'message',
            priority: -(99 ** 99),
            rule: [
                {
                    reg: /.*/,
                    fnc: 'handleMessage'
                },
                {
                    reg: /^[#/]?查看用户数量$/,
                    fnc: 'getUserCount'
                },
                {
                    reg: /^[#/]?初始化数据库$/,
                    fnc: 'initDatabase',
                    permission: 'master'
                }
            ]
        });
    }

    getGroupId(e) {
        const groupId = e.group_id;
        if (!groupId) return null;
        return groupId.toString().split(':')[1] || groupId.toString();
    }

    async getUserCount(e) {
        // 直接查询数据库
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM bot_users');
        const userCount = rows[0].count;
        const imagesDir = '../resources/img/usercount';
        const countString = userCount.toString().padStart(5, '0');
        let msg = countString.split('').map(num => {
            const imagePath = path.join(imagesDir, `${num}.gif`);
            return segment.image(imagePath);
        });
        console.log(`图片消息数组: ${msg}`);
        const [groupRows] = await pool.query('SELECT COUNT(*) as count FROM bot_groups');
        const groupCount = groupRows[0].count;
        await e.reply(`当前橙子BOT用户数量: ${userCount}\n当前橙子BOT群组总数: ${groupCount}`);
    }

    async handleMessage(e) {
        if (!isQQBot(e)) {
            return false;
        }
        const userId = e.user_id?.slice(11);
        const groupId = this.getGroupId(e);
        if ((groupId && groupId.toString().startsWith('qg_')) ||
            (userId && userId.toString().startsWith('qg_'))) {
            return false;
        }
        // 检查用户是否已存在
        const [userRows] = await pool.query('SELECT 1 FROM bot_users WHERE user_id = ? LIMIT 1', [userId]);
        if (userRows.length === 0) {
            await pool.query('INSERT INTO bot_users (user_id) VALUES (?)', [userId]);
            if (groupId) {
                const [groupRows] = await pool.query('SELECT 1 FROM bot_groups WHERE group_id = ? LIMIT 1', [groupId]);
                if (groupRows.length === 0) {
                    await pool.query('INSERT INTO bot_groups (group_id) VALUES (?)', [groupId]);
                }
            }
            const [countRows] = await pool.query('SELECT COUNT(*) as count FROM bot_users');
            const userCount = countRows[0].count;
            const avatarUrl = `https://q.qlogo.cn/qqapp/102059511/${userId}/640`;
            await replyMarkdownButton(e, [
                { key: 'a', values: [`![头像 #640px #640px](${avatarUrl}`] },
                { key: 'b', values: [')\r\r> 欢迎'] },
                { key: 'c', values: [`<@${userId}>使用「橙子BOT」`] },
                { key: 'd', values: [`\r您是 **${userCount}** 位用户！\r\r`] },
                { key: 'e', values: ['***'] },
                { key: 'f', values: [`\r> 更多功能请回复"菜单"查看详情\r\r`] }
            ], [
                [{ text: '菜单', callback: '菜单', clicked_text: '正在获取菜单' }]
            ]);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        return false;
    }

    async initDatabase(e) {
        try {
            await e.reply('开始初始化数据库...');
            await pool.query(`
                CREATE TABLE IF NOT EXISTS bot_users (
                    user_id VARCHAR(64) PRIMARY KEY
                )
            `);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS bot_groups (
                    group_id VARCHAR(64) PRIMARY KEY
                )
            `);
            await e.reply('数据库初始化完成！');
        } catch (error) {
            await e.reply('数据库初始化失败: ' + error.message);
            console.error('数据库初始化失败:', error);
        }
    }
}
