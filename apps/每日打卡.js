export class example extends plugin {
  constructor() {
    super({
      name: '打卡',
      dsc: '打卡抽取幸运值',
      event: 'message',
      priority: 1,
      rule: [
        {
          reg: '^(#|\/)?打卡$',
          fnc: 'meiridaka3qn'
        },
        {
          reg: '^(#|\/)?今日欧皇$',
          fnc: 'todayohuang'
        }
      ]
    });
  }
  async meiridaka3qn(e) {
    const platform = e.bot?.adapter?.name || e.platform || '未知'
        if (platform !== 'QQBot') {
            await e.reply('请艾特橙子BOT使用')
            return false
        }
    //获取当前日期
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const day = currentDate.getDate().toString().padStart(2, '0');
    const date_time = `${year}-${month}-${day}`;
    let date_time2 = await redis.get(`Yunzai:meiridaka3qn:${e.user_id}_${e.group_id}_daka`); date_time2 = JSON.parse(date_time2);//获取用户最后一次打卡日期
    const zhi1 = await redis.get(`Yunzai:meiridakazhi:${e.user_id}_${e.group_id}_daka`);//获取用户最后一次打卡的幸运值
    //判断该用户的上一次抽取时间是否是今天
    if (date_time === date_time2) {
      let msg = [
        segment.at(e.user_id),
        `\n你今天已经打过卡了喵~\n你今天的幸运值是` + zhi1 + `，可别再忘掉哦喵~`,
        segment.button([
          { text: '我也要打卡', callback: '打卡' },
          { text: '今日欧皇', callback: '今日欧皇' }
        ])
      ]
      await e.reply(msg)
      return;
    }
    const zhi = Math.floor(Math.random() * 101);//随机抽取数字,数字范围可以自己调
    console.log(zhi);
    let msg = [
      segment.at(e.user_id),
      `\n打卡成功！！\n你今天抽到的幸运值为` + zhi + `点`,
      segment.button([
        { text: '我也要打卡', callback: '打卡' },
        { text: '今日欧皇', callback: '今日欧皇' }
      ])
    ]//将消息设置为变量msg
    if (zhi === 100) {//判断本次抽取的幸运值是否为100
      let date_time3 = await redis.get(`Yunzai:ohuangriqi_daka:${e.group_id}`); date_time3 = JSON.parse(date_time3); //获取上一次欧皇诞生时间
      if (date_time3 !== date_time) { //判断上一次欧皇诞生时间是否为今天
        redis.set(`Yunzai:ohuangzhi_daka:${e.group_id}`, JSON.stringify(zhi)); //写入幸运值
        redis.set(`Yunzai:ohuangname_daka:${e.group_id}`, JSON.stringify(e.nickname));//写入欧皇名字
        redis.set(`Yunzai:ohuangqq_daka:${e.group_id}`, JSON.stringify(e.user_id));//写入欧皇的qq号
        redis.set(`Yunzai:ohuangriqi_daka:${e.group_id}`, JSON.stringify(date_time));//写入欧皇诞生的时间
      }
    }
    await e.reply(msg)//处理方式
    redis.set(`Yunzai:meiridaka3qn:${e.user_id}_${e.group_id}_daka`, JSON.stringify(date_time));//将当前日期写入redis防止重复抽取
    redis.set(`Yunzai:meiridakazhi:${e.user_id}_${e.group_id}_daka`, JSON.stringify(zhi));//将打卡获取的幸运值写入redis
    return true;//结束运行
  }

  async todayohuang(e) {
    const platform = e.bot?.adapter?.name || e.platform || '未知'
        if (platform !== 'QQBot') {
            await e.reply('请艾特橙子BOT使用')
            return false
        }
    // 获取当前日期
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const day = currentDate.getDate().toString().padStart(2, '0');
    const date_time = `${year}-${month}-${day}`;
    let date_time2 = await redis.get(`Yunzai:ohuangriqi_daka:${e.group_id}`); date_time2 = JSON.parse(date_time2); // 获取本群欧皇最后一次诞生时间
    if (date_time !== date_time2) {
      let msg = [
        segment.at(e.user_id),
        `\n本群今天的欧皇还没诞生喵~`,
        segment.button([
          { text: '我也要打卡', callback: '打卡' },
          { text: '今日欧皇', callback: '今日欧皇' }
        ])
      ]
      await e.reply(msg)
      return;
    }
    let ohuangname = await redis.get(`Yunzai:ohuangname_daka:${e.group_id}`); ohuangname = JSON.parse(ohuangname); // 获取本群欧皇的名字
    let ohuangqq = await redis.get(`Yunzai:ohuangqq_daka:${e.group_id}`); ohuangqq = JSON.parse(ohuangqq); // 获取本群欧皇QQ号

    // 去除冒号和冒号前的内容
    const cleanedOhuangqq = ohuangqq.toString().split(':')[1] || ohuangqq.toString();
    await e.reply([
      segment.markdown({
        custom_template_id: "102059511_1713948595",
        params: [
          { key: 'a', values: [`本群今日的首个欧皇已诞生！！！！\r`] },
          { key: 'b', values: [`ta就是：<@${cleanedOhuangqq}>\r`] },
          { key: 'c', values: [`ta的幸运值是：100 ！！！`] }
        ]
      }),
      segment.button([
        { text: '我也要打卡', callback: '打卡' },
        { text: '今日欧皇', callback: '今日欧皇' }
      ])
    ])
    return true;
  }
}