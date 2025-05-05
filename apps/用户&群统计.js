import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { isQQBot, replyMarkdownButton } from '../components/CommonReplyUtil.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 新增：确保 data 目录存在
const dataDir = path.join(process.cwd(), 'plugins/Kevin-plugin/data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

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
                    reg: /^[#/]?迁移数据到数据库$/,
                    fnc: 'migrateData',
                    permission: 'master'
                },
                {
                    reg: /^[#/]?验证数据迁移$/,
                    fnc: 'verifyMigration',
                    permission: 'master'
                }
            ]
        });

        // 存储到 ./plugins/Kevin-plugin/data/ 目录下
        this.userDataFilePath = path.join(dataDir, 'userData.json');
        this.groupDataFilePath = path.join(dataDir, 'groupData.json');
        this.userData = new Set(this.loadData(this.userDataFilePath));
        this.groupData = new Set(this.loadData(this.groupDataFilePath));
        this.dataDir = dataDir;
    }

    getGroupId(e) {
        const groupId = e.group_id;
        if (!groupId) return null;
        return groupId.toString().split(':')[1] || groupId.toString();
    }

    async getUserCount(e) {
        const userCount = this.userData.size;
        const imagesDir = path.join(__dirname, './usercount');

        // 将用户数量转换为五位数的字符串
        const countString = userCount.toString().padStart(5, '0');

        // 生成对应的图片消息
        let msg = countString.split('').map(num => {
            const imagePath = path.join(imagesDir, `${num}.gif`);
            return segment.image(imagePath);
        });

        // 输出图片消息数组到日志
        console.log(`图片消息数组: ${msg}`);

        if (isQQBot(e)) {
            // 直接发送图片消息
            await e.reply(msg);
        } else {
            await e.reply(`当前橙子BOT用户数量: ${userCount}\n如果需要查看图片形式请艾特橙子BOT再次发送指令查看`);
        }
    }

    loadData(filePath) {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, '[]', 'utf8'); // 初始化为空的 JSON 数组
            return new Set();
        }

        try {
            const data = fs.readFileSync(filePath, 'utf8');
            const jsonData = JSON.parse(data);
            return new Set(jsonData); // 从 JSON 数组中创建 Set
        } catch (error) {
            console.error(`加载数据时出错: ${error}`);
            return new Set();
        }
    }

    saveData(filePath, data) {
        try {
            const dataArray = Array.from(data); // 将 Set 转换为数组
            const dataString = JSON.stringify(dataArray, null, 2); // 格式化 JSON 字符串
            fs.writeFileSync(filePath, dataString, 'utf8');
        } catch (error) {
            console.error(`保存数据时出错: ${error}`);
        }
    }

    async handleMessage(e) {
        if (!isQQBot(e)) {
            return false;
        }

        const userId = e.user_id?.slice(11);
        const groupId = this.getGroupId(e);

        // 检查群号和用户ID是否以 "qg_" 开头
        if ((groupId && groupId.toString().startsWith('qg_')) ||
            (userId && userId.toString().startsWith('qg_'))) {
            return false; // 如果是 "qg_" 开头，直接返回，不记录
        }

        if (!this.userData.has(userId)) {
            this.userData.add(userId);
            this.saveData(this.userDataFilePath, this.userData);

            if (groupId && !this.groupData.has(groupId)) {
                this.groupData.add(groupId);
                this.saveData(this.groupDataFilePath, this.groupData);
            }

            const userCount = this.userData.size;
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

    async migrateData(e) {
        try {
            await e.reply('开始迁移数据到数据库...');

            if (!fs.existsSync(this.dataDir)) {
                await e.reply('数据目录不存在，无需迁移');
                return;
            }

            let userCount = 0;
            let groupCount = 0;

            if (fs.existsSync(this.userDataFilePath)) {
                const userData = JSON.parse(fs.readFileSync(this.userDataFilePath, 'utf8'));
                if (userData && userData.length > 0) {
                    for (const userId of userData) {
                        try {
                            const [result] = await pool.query(
                                'INSERT IGNORE INTO bot_users (user_id) VALUES (?)',
                                [userId]
                            );
                            if (result.affectedRows > 0) userCount++;
                        } catch (error) {
                            console.error(`迁移用户 ${userId} 失败:`, error);
                        }
                    }
                }
            }

            if (fs.existsSync(this.groupDataFilePath)) {
                const groupData = JSON.parse(fs.readFileSync(this.groupDataFilePath, 'utf8'));
                if (groupData && groupData.length > 0) {
                    for (const groupId of groupData) {
                        try {
                            const [result] = await pool.query(
                                'INSERT IGNORE INTO bot_groups (group_id) VALUES (?)',
                                [groupId]
                            );
                            if (result.affectedRows > 0) groupCount++;
                        } catch (error) {
                            console.error(`迁移群组 ${groupId} 失败:`, error);
                        }
                    }
                }
            }

            await e.reply([
                '数据迁移完成！',
                `迁移用户数: ${userCount}`,
                `迁移群组数: ${groupCount}`,
                '可以使用"验证数据迁移"命令检查数据一致性'
            ]);
        } catch (error) {
            await e.reply('数据迁移失败: ' + error.message);
            console.error('数据迁移失败:', error);
        }
    }

    async verifyMigration(e) {
        try {
            await e.reply('开始验证数据迁移...');

            let fileUserCount = 0;
            let fileGroupCount = 0;
            let dbUserCount = 0;
            let dbGroupCount = 0;

            if (fs.existsSync(this.userDataFilePath)) {
                const userData = JSON.parse(fs.readFileSync(this.userDataFilePath, 'utf8'));
                fileUserCount = userData ? userData.length : 0;
            }

            if (fs.existsSync(this.groupDataFilePath)) {
                const groupData = JSON.parse(fs.readFileSync(this.groupDataFilePath, 'utf8'));
                fileGroupCount = groupData ? groupData.length : 0;
            }

            const [userRows] = await pool.query('SELECT COUNT(*) as count FROM bot_users');
            dbUserCount = userRows[0].count;

            const [groupRows] = await pool.query('SELECT COUNT(*) as count FROM bot_groups');
            dbGroupCount = groupRows[0].count;

            await e.reply([
                '数据验证结果:',
                `文件用户数: ${fileUserCount}`,
                `数据库用户数: ${dbUserCount}`,
                `用户数据状态: ${fileUserCount === dbUserCount ? '✓ 一致' : '✗ 不一致'}`,
                `文件群组数: ${fileGroupCount}`,
                `数据库群组数: ${dbGroupCount}`,
                `群组数据状态: ${fileGroupCount === dbGroupCount ? '✓ 一致' : '✗ 不一致'}`
            ]);
        } catch (error) {
            await e.reply('验证数据迁移时出错: ' + error.message);
            console.error('验证数据迁移失败:', error);
        }
    }
}
