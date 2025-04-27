/*
* 小丞插件系统帮助配置
* 此文件为系统自动生成，请勿手动修改
*/

export const helpCfg = {
  title: '小丞插件帮助',
  subTitle: 'TRSS-Yunzai 专用插件',
  columnCount: 2,
  colWidth: 300,
  theme: 'all',
  themeExclude: ['default'],
  style: {
    fontColor: '#ceb78b',
    descColor: '#eee',
    contBgColor: 'rgba(6, 21, 31, .5)',
    contBgBlur: 3,
    headerBgColor: 'rgba(6, 21, 31, .4)',
    rowBgColor1: 'rgba(6, 21, 31, .2)',
    rowBgColor2: 'rgba(6, 21, 31, .35)'
  }
}

export const helpList = [
  {
    group: '基础功能',
    list: [
      {
        icon: 1,
        title: '多群管理',
        desc: '统一管理多个群，支持群名映射、白名单、黑名单等'
      },
      {
        icon: 2,
        title: '自动进群审核',
        desc: '自定义入群问题、答案、等级验证、超时处理'
      },
      {
        icon: 3,
        title: '吃喝推荐',
        desc: '随机推荐食物/饮品，支持自定义添加、审核'
      },
      {
        icon: 4,
        title: '点歌',
        desc: '支持QQ、酷狗、网易云等平台点歌'
      },
      {
        icon: 5,
        title: '娱乐功能',
        desc: '恶魔轮盘、群成员重复加群检测、进退群通知等'
      }
    ]
  },
  {
    group: '管理命令',
    auth: 'master',
    list: [
      {
        icon: 10,
        title: '审核管理',
        desc: '查看/通过/拒绝待审核食物饮品'
      },
      {
    icon: 11,
        title: '群成员管理',
        desc: '初始化/检测群成员、白名单、黑名单等'
      },
      {
        icon: 12,
        title: '插件配置',
        desc: '修改config.yaml统一配置，支持热更新'
      }
    ]
  }
]

export const isSys = true
