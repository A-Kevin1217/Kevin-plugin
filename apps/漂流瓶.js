import mysql from 'mysql2/promise';
import { replyMarkdownButton } from '../components/CommonReplyUtil.js'

const bottlePool = mysql.createPool({
    host: 'localhost',
    user: 'bottle',
    password: '123456',
    database: 'bottle'
});

// plp_id_map相关操作
async function addPlpIdMap(plp_id, user_id, date) {
    await bottlePool.query(
        'INSERT INTO plp_id_map (plp_id, user_id, date) VALUES (?, ?, ?)',
        [plp_id, user_id, date]
    )
}
async function getAllPlpIdMap() {
    const [rows] = await bottlePool.query('SELECT * FROM plp_id_map')
    return rows.map(row => ({ number: row.plp_id, qq: row.user_id, date: row.date }))
}
async function delPlpIdMap(plp_id) {
    await bottlePool.query('DELETE FROM plp_id_map WHERE plp_id = ?', [plp_id])
}

// 顶部添加配置常量
const config = {
    dbcomment: true, // 是否开放评论区
    Rplp: 3,        // 每天可扔漂流瓶次数
    Jplp: 3         // 每天可捡漂流瓶次数
}

export class plp extends plugin {
    constructor(){
        super({
            name: 'Gi互动:漂流瓶',
            dsc: 'Gi互动:漂流瓶',
            event: 'message',
            priority: 500,
            rule:[
                {
                    reg: '^(#|/)?扔漂流瓶$',
                    fnc: '扔漂流瓶'
                },{
                    reg: '^(#|/)?捡漂流瓶$',
                    fnc: '捡漂流瓶'
                },{
                    reg: /^(#|\/)?评论漂流瓶(.*)$/,
                    fnc: '评论漂流瓶'
                },{
                    reg: '^(#|/)?我的漂流瓶(\s*\d*)?$',
                    fnc: 'myBottle'
                },{
                    reg: '^(#|/)?初始化漂流瓶数据库$',
                    fnc: 'initDb',
                    permission: 'master'
                },{
                    reg: '^(#|/)?漂流瓶(帮助|教程)?$',
                    fnc: 'help'
                },{
                    reg: '^(#|/)?评论漂流瓶\s*(\d+)\s+(.+)$',
                    fnc: 'quickComment'
                },{
                    reg: '^(#|/)?查看漂流瓶评论\s*(\d+)$',
                    fnc: 'viewComments'
                }
            ]
        })
    }
    async 评论漂流瓶(e) {
        if(!config.dbcomment){
            await replyMarkdownButton(e, [
                { key: 'a', values: ['港口管理员未开放评论区哦~'] }
            ], defaultButtons())
            return true
        }
        let dbid = Number(e.msg.match(/^(#|\/)?评论漂流瓶(.*)$/)[2])
        if(dbid == NaN) {
            await replyMarkdownButton(e, [
                { key: 'a', values: ['港口管理员："哎？漂流瓶ID应该是数字吧"'] }
            ], defaultButtons())
            return true
        }
        let dbdata = await redis.get(`Yunzai:giplugin_plp_${dbid}`)
        if(!dbdata) {
            await replyMarkdownButton(e, [
                { key: 'a', values: ['没有找到你说的这个漂流瓶哦，请检查漂流瓶ID是否正确~'] }
            ], defaultButtons())
            return true
        }
        await redis.set(`comment:${e.user_id}`, dbid)
        await replyMarkdownButton(e, [
            { key: 'a', values: [`你正在评论漂流瓶ID为【${dbid}】的漂流瓶`] },
            { key: 'b', values: ['请发送你要评论的内容'] },
            { key: 'c', values: ['发送[0]取消评论'] }
        ], defaultButtons())
        this.setContext(`评论漂流瓶_`)
    }
    async 评论漂流瓶_(e) {
        this.finish(`评论漂流瓶_`)
        if(this.e.msg == `0` || this.e.msg == `[0]`) {
            await replyMarkdownButton(e, [
                { key: 'a', values: ['你已取消评论漂流瓶'] }
            ], defaultButtons())
            await redis.del(`comment:${e.user_id}`)
            return true
        }
        let dbid = await redis.get(`comment:${e.user_id}`)
        await redis.del(`comment:${e.user_id}`)
        if(!dbid) {
            await replyMarkdownButton(e, [
                { key: 'a', values: ['获取漂流瓶ID失败'] }
            ], defaultButtons())
            return true
        }
        try {
            await bottlePool.query(
                'INSERT INTO plp_comments (plp_id, user_id, message, create_time) VALUES (?, ?, ?, NOW())',
                [dbid, e.user_id, this.e.message]
            )
        } catch (err) {
            await replyMarkdownButton(e, [
                { key: 'a', values: ['评论存储失败：' + err.message] }
            ], defaultButtons())
            return true
        }
        await replyMarkdownButton(e, [
            { key: 'a', values: ['港口管理员已将你的评论和漂流瓶一起扔向大海喽~'] }
        ], defaultButtons())
        return true
    }
    async 扔漂流瓶(e){
        const date_time = getDateTimeStr();
        let date_time2 = await redis.get(`giplugin_db:${e.user_id}`);
        date_time2 = JSON.parse(date_time2);
        if(config.Rplp == 0) {
            await replyMarkdownButton(e, [
                { key: 'a', values: ['港口管理员未开放漂流瓶功能哦~'] }
            ], defaultButtons())
            return true
        }
        if(date_time2 && date_time2.number >= config.Rplp && date_time2.date == date_time && !e.isMaster) {
            await replyMarkdownButton(e, [
                { key: 'a', values: [`你今天已经扔过${date_time2.number}次漂流瓶，每天只能扔${config.Rplp}次哦`] }
            ], defaultButtons())
            return true
        } else {
            if(!date_time2 || date_time2.date != date_time) {
                date_time2 = {
                    date: date_time,
                    number: 0
                }
                await redis.set(`giplugin_db:${e.user_id}`, JSON.stringify(date_time2))
            }
        }
        await replyMarkdownButton(e, [
            { key: 'a', values: ['发送你想要扔漂流瓶的内容(仅支持文字)'] },
            { key: 'b', values: ['发送[0]取消扔漂流瓶'] }
        ], defaultButtons())
        this.setContext(`扔漂流瓶1`)
    }
    async 扔漂流瓶1(e){
        this.finish(`扔漂流瓶1`)
        if(this.e.msg == `0`|| this.e.msg == `[0]`){
            await replyMarkdownButton(e, [
                { key: 'a', values: ['已取消扔漂流瓶'] }
            ], defaultButtons())
            return true;
        } else {
            let userDBnumber = JSON.parse(await redis.get(`giplugin_db:${e.user_id}`))
            if(userDBnumber) {
                userDBnumber.number++
                await redis.set(`giplugin_db:${e.user_id}`, JSON.stringify(userDBnumber))
            } else {
                userDBnumber = {
                    date: getDateTimeStr(),
                    number: 1
                }
                await redis.set(`giplugin_db:${e.user_id}`, JSON.stringify(userDBnumber))
            }
        }
        if(!this.e.msg || this.e.img) {
            await replyMarkdownButton(e, [
                { key: 'a', values: ['扔漂流瓶只支持文字内容，不支持图片或图文混合。'] }
            ], defaultButtons())
            return true;
        }
        let type = 'text';
        let plp_content = this.e.msg;
        let plp_imgUrl = '';
        let plp_id = await redis.get(`Yunzai:giplugin-plpid`)
        plp_id = JSON.parse(plp_id)
        if (plp_id == undefined) {
            plp_id = `1000001`
        } else {
            plp_id++;
        }
        try {
            await bottlePool.query(
                'INSERT INTO plp_bottle (plp_id, user_id, group_id, type, text, img_url, create_time) VALUES (?, ?, ?, ?, ?, ?, NOW())',
                [plp_id, e.user_id, e.group_id, type, plp_content, plp_imgUrl]
            )
            let date = getDateTimeStr()
            await addPlpIdMap(plp_id, e.user_id, date)
        } catch (err) {
            await replyMarkdownButton(e, [
                { key: 'a', values: ['漂流瓶存储失败：' + err.message] }
            ], defaultButtons())
            return true
        }
        let plp = {
            plp_id,
            plp_userid: e.user_id,
            plp_groupid: e.group_id,
            plp_type: type,
            plp_text: plp_content,
            plp_imgUrl,
        }
        redis.set(`Yunzai:giplugin_plp_${plp_id}`, JSON.stringify(plp))
        redis.set(`Yunzai:giplugin-plpid`, JSON.stringify(plp_id))
        await replyMarkdownButton(e, [
            { key: 'a', values: ['你的漂流瓶成功扔出去了~'] }
        ], defaultButtons())
        logger.mark(`[Gi互动:扔漂流瓶]用户${e.user_id}扔了一个漂流瓶【${plp}】`)
        return true;
    }
    async 捡漂流瓶(e){
        let userPDBnumber = JSON.parse(await redis.get(`giplugin_pdb:${e.user_id}`))
        if(config.Jplp == 0) {
            await replyMarkdownButton(e, [
                { key: 'a', values: ['港口管理员未开放漂流瓶功能哦~'] }
            ], defaultButtons())
            return true
        }
        let date_time = getDateTimeStr()
        let plpid = []
        try {
            plpid = await getAllPlpIdMap()
        } catch {
            plpid = []
        }
        if(plpid.length === 0){
            await replyMarkdownButton(e, [
                { key: 'a', values: ['海里空空的，没有漂流瓶呢~'] }
            ], defaultButtons())
            return true;
        }
        if(userPDBnumber && userPDBnumber.number >= config.Jplp && userPDBnumber.date == date_time && !e.isMaster) {
            await replyMarkdownButton(e, [
                { key: 'a', values: [`你今天已经捡过${userPDBnumber.number}次漂流瓶，每天只能捡${config.Jplp}次哦`] }
            ], defaultButtons())
            return true
        } else {
            if(!userPDBnumber) {
                userPDBnumber = {
                    date: date_time,
                    number: 1
                }
            } else {
                userPDBnumber.number++
            }
            await redis.set(`giplugin_pdb:${e.user_id}`, JSON.stringify(userPDBnumber))
        }
        let plp_id1 = plpid[Math.floor(Math.random() * plpid.length)]
        let plpcontent
        try {
            const [rows] = await bottlePool.query('SELECT * FROM plp_bottle WHERE plp_id = ?', [plp_id1.number])
            if(rows.length > 0) {
                plpcontent = rows[0]
                if(plpcontent.img_url) {
                    try { plpcontent.plp_imgUrl = JSON.parse(plpcontent.img_url) } catch { plpcontent.plp_imgUrl = plpcontent.img_url }
                }
            } else {
                plpcontent = JSON.parse(await redis.get(`Yunzai:giplugin_plp_${plp_id1.number}`))
            }
        } catch {
            plpcontent = JSON.parse(await redis.get(`Yunzai:giplugin_plp_${plp_id1.number}`))
        }
        let params = [
            { key: 'a', values: [`你捡到漂流瓶了~\n`] },
            { key: 'b', values: [`内容：${plpcontent.plp_text}`] },
            { key: 'c', values: [`漂流瓶  ID：${plp_id1.number}`] },
            { key: 'd', values: [`漂流时间：${plpcontent.create_time ? (typeof plpcontent.create_time === 'string' ? plpcontent.create_time : plpcontent.create_time.toLocaleString?.() || plpcontent.create_time) : ''}`] },
            { key: 'e', values: [`今日第${userPDBnumber?.number || 1}/${config.Jplp}个`] }
        ]
        let day = dateCalculation(plp_id1.date)
        let comment = []
        try {
            const [rows] = await bottlePool.query('SELECT * FROM plp_comments WHERE plp_id = ? ORDER BY create_time ASC', [plp_id1.number])
            comment = rows
        } catch {}
        // 按钮区
        const buttons = [
            [
                { text: '🖊评论该瓶', input: `评论漂流瓶 ${plp_id1.number} `, clicked_text: '评论该瓶' },
                { text: '📜查看评论', input: `查看漂流瓶评论 ${plp_id1.number}`, clicked_text: '查看评论' }
            ],[
                { text: '扔漂流瓶', callback: '扔漂流瓶', clicked_text: '扔漂流瓶' },
                { text: '捡漂流瓶', callback: '捡漂流瓶', clicked_text: '捡漂流瓶' },
                { text: '我的漂流瓶', callback: '我的漂流瓶', clicked_text: '我的漂流瓶' }
            ]
        ];
        await replyMarkdownButton(e, params, buttons)
        if(!day || day > 3 || !config.dbcomment) {
            await delPlpIdMap(plp_id1.number)
            await redis.del(`Yunzai:giplugin_plp_${plp_id1.number}`)
        }
        return true;
    }
    async initDb(e) {
        try {
            await e.reply('开始初始化漂流瓶数据库...')
            await bottlePool.query(`
                CREATE TABLE IF NOT EXISTS plp_bottle (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    plp_id VARCHAR(32) NOT NULL,
                    user_id VARCHAR(128) NOT NULL,
                    group_id VARCHAR(32),
                    type VARCHAR(16) NOT NULL,
                    text TEXT,
                    img_url TEXT,
                    create_time DATETIME NOT NULL
                ) CHARSET=utf8mb4;
            `)
            await bottlePool.query(`
                CREATE TABLE IF NOT EXISTS plp_comments (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    plp_id VARCHAR(32) NOT NULL,
                    user_id VARCHAR(128) NOT NULL,
                    message TEXT NOT NULL,
                    create_time DATETIME NOT NULL
                ) CHARSET=utf8mb4;
            `)
            await bottlePool.query(`
                CREATE TABLE IF NOT EXISTS plp_id_map (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    plp_id VARCHAR(32) NOT NULL,
                    user_id VARCHAR(128) NOT NULL,
                    date DATE NOT NULL
                ) CHARSET=utf8mb4;
            `)
            await e.reply('漂流瓶数据库初始化完成！')
        } catch (err) {
            await e.reply('数据库初始化失败：' + err.message)
        }
    }
    async help(e) {
        const params = [
            { key: 'a', values: ['🍊漂流瓶使用教程\r'] },
            { key: 'b', values: ['``'] },
            { key: 'c', values: ['`\r请按照下面格式输出指令哦\r中间一定要带空格，并且要按格式发送，否则不会回复哦\r指令: 捡漂流瓶\r指令: 我的漂流瓶\r指令: 评论漂流瓶+漂流瓶id+内容\r指令: 查看漂流瓶评论+漂流瓶id'] },
            { key: 'd', values: ['``'] },
            { key: 'e', values: ['`'] }
        ];
        const buttons = [
            [
                { text: '扔漂流瓶', callback: '扔漂流瓶', clicked_text: '扔漂流瓶' },
                { text: '捡漂流瓶', callback: '捡漂流瓶', clicked_text: '捡漂流瓶' },
                { text: '我的漂流瓶', callback: '我的漂流瓶', clicked_text: '我的漂流瓶' }
            ]
        ];
        await replyMarkdownButton(e, params, buttons);
    }
    async myBottle(e) {
        // 支持分页，格式：我的漂流瓶 或 我的漂流瓶 2
        let page = 1;
        const match = e.msg.match(/我的漂流瓶\s*(\d*)/);
        if (match && match[1]) page = parseInt(match[1], 10) || 1;
        const pageSize = 5;
        const offset = (page - 1) * pageSize;
        const [rows] = await bottlePool.query(
            'SELECT * FROM plp_bottle WHERE user_id = ? ORDER BY create_time DESC LIMIT ? OFFSET ?',
            [e.user_id, pageSize, offset]
        );
        const [[{ total } = { total: 0 }]] = await bottlePool.query(
            'SELECT COUNT(*) as total FROM plp_bottle WHERE user_id = ?', [e.user_id]
        );
        if (!rows || rows.length === 0) {
            await replyMarkdownButton(e, [
                { key: 'a', values: ['你还没有扔过漂流瓶哦~'] }
            ], defaultButtons())
            return true;
        }
        let params = [
            { key: 'a', values: [`【我的漂流瓶】第${page}页 共${Math.ceil(total/pageSize)}页`] }
        ];
        for (let item of rows) {
            params.push({ key: 'b', values: [
                `ID:${item.plp_id}\n内容:${item.text}\n时间:${item.create_time.toLocaleString?.() || item.create_time}`
            ] })
        }
        let navBtns = [];
        if (page > 1) navBtns.push({ text: '上一页', input: `我的漂流瓶 ${page-1}`, clicked_text: '上一页' });
        if (page * pageSize < total) navBtns.push({ text: '下一页', input: `我的漂流瓶 ${page+1}`, clicked_text: '下一页' });
        const buttons = [
            [
                { text: '扔漂流瓶', callback: '扔漂流瓶', clicked_text: '扔漂流瓶' },
                { text: '捡漂流瓶', callback: '捡漂流瓶', clicked_text: '捡漂流瓶' },
                { text: '我的漂流瓶', callback: '我的漂流瓶', clicked_text: '我的漂流瓶' }
            ]
        ];
        if (navBtns.length > 0) buttons.push(navBtns);
        await replyMarkdownButton(e, params, buttons);
        return true;
    }
    async quickComment(e) {
        // 一步评论：#评论漂流瓶 123456 内容
        const match = e.msg.match(/评论漂流瓶\s*(\d+)\s+(.+)/)
        if (!match) return false;
        const dbid = match[1]
        const content = match[2]
        // 检查漂流瓶是否存在
        let dbdata = await redis.get(`Yunzai:giplugin_plp_${dbid}`)
        if(!dbdata) {
            await replyMarkdownButton(e, [
                { key: 'a', values: ['没有找到你说的这个漂流瓶哦，请检查漂流瓶ID是否正确~'] }
            ], defaultButtons())
            return true
        }
        try {
            await bottlePool.query(
                'INSERT INTO plp_comments (plp_id, user_id, message, create_time) VALUES (?, ?, ?, NOW())',
                [dbid, e.user_id, content]
            )
        } catch (err) {
            await replyMarkdownButton(e, [
                { key: 'a', values: ['评论存储失败：' + err.message] }
            ], defaultButtons())
            return true
        }
        await replyMarkdownButton(e, [
            { key: 'a', values: ['评论成功，港口管理员已将你的评论和漂流瓶一起扔向大海喽~'] }
        ], defaultButtons())
        return true
    }
    async viewComments(e) {
        // #查看漂流瓶评论 123456
        const match = e.msg.match(/查看漂流瓶评论\s*(\d+)/)
        if (!match) return false;
        const dbid = match[1]
        // 检查漂流瓶是否存在
        let dbdata = await redis.get(`Yunzai:giplugin_plp_${dbid}`)
        if(!dbdata) {
            await replyMarkdownButton(e, [
                { key: 'a', values: ['没有找到你说的这个漂流瓶哦，请检查漂流瓶ID是否正确~'] }
            ], defaultButtons())
            return true
        }
        let comment = []
        try {
            const [rows] = await bottlePool.query('SELECT * FROM plp_comments WHERE plp_id = ? ORDER BY create_time ASC', [dbid])
            comment = rows
        } catch {}
        let params = [
            { key: 'a', values: [`【漂流瓶${dbid}的评论区】`] }
        ]
        if(comment && comment.length > 0) {
            for (let item of comment) {
                params.push({ key: 'b', values: [`${item.message}（${item.create_time ? (typeof item.create_time === 'string' ? item.create_time : item.create_time.toLocaleString?.() || item.create_time) : ''}）`] })
            }
        } else {
            params.push({ key: 'b', values: ['暂无评论'] })
        }
        await replyMarkdownButton(e, params, defaultButtons())
        return true
    }
}

// 工具函数：默认按钮
function defaultButtons() {
    return [[
        { text: '扔漂流瓶', callback: '扔漂流瓶', clicked_text: '扔漂流瓶' },
        { text: '捡漂流瓶', callback: '捡漂流瓶', clicked_text: '捡漂流瓶' },
        { text: '我的漂流瓶', callback: '我的漂流瓶', clicked_text: '我的漂流瓶' }
    ]]
}

// 用原生JS替换Gimodel.date_time()
function getDateTimeStr() {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const day = currentDate.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 用原生JS替换Gimodel.date_calculation(date)
function dateCalculation(dateStr) {
    if (!dateStr) return null;
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    return diff;
}
