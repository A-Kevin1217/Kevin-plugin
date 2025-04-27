import path from "path";
import setting from "./model/setting.js";

const _path = process.cwd() + "/plugins/Kevin-plugin";

/**
 *  小丞插件支持锅巴配置
 */
export function supportGuoba() {
  return {
    pluginInfo: {
      name: "Kevin-plugin",
      title: "小丞插件",
      author: "小丞",
      authorLink: "https://github.com/A-Kevin1217/Kevin-plugin",
      link: "https://github.com/A-Kevin1217/Kevin-plugin",
      isV3: true,
      isV2: false,
      description: "多群管理、自动审核、吃喝推荐、点歌、娱乐等功能",
      icon: "mdi:stove",
      iconColor: "#d19f56",
      iconPath: path.join(_path, "resources/img/logo.png"),
    },
    // 配置项信息
    configInfo: {
      // 配置项 schemas
      schemas: [
        { label: '吃喝推荐', component: 'SOFT_GROUP_BEGIN' },
        {
          field: 'config.allow_user_add',
          label: '是否允许用户投稿',
          component: 'Select',
          componentProps: {
            options: [
              { label: "否", value: false },
              { label: "是", value: true },
            ],
            placeholder: "请选择",
          },
        },
        { label: '点歌功能', component: 'SOFT_GROUP_BEGIN' },
        {
          field: 'config.music_enable',
          label: '是否启用点歌功能',
          component: 'Select',
          componentProps: {
            options: [
              { label: "否", value: false },
              { label: "是", value: true },
            ],
            placeholder: "请选择",
          },
        },
        {
          field: 'config.wyck',
          label: '网易云音乐cookie',
          bottomHelpMessage: '如需全局统一配置可填写，否则留空',
          component: 'Input',
          required: false,
          componentProps: { placeholder: '请输入cookie' },
        },
        { label: '自动审核', component: 'SOFT_GROUP_BEGIN' },
        {
          component: 'Divider',
          label: '自动审核设置',
          componentProps: {
            orientation: 'left',
            plain: true
          }
        },
        {
          field: 'config.audit_group_mode',
          label: '群审核模式',
          component: 'RadioGroup',
          componentProps: {
            options: [
              { label: '群号与群名映射（group_map）', value: 'group_map' },
              { label: '群白名单（group_whitelist）', value: 'group_whitelist' }
            ],
            placeholder: '请选择群审核模式'
          },
          required: true
        },
        {
          field: 'config.level_check',
          label: '是否启用等级验证',
          component: 'Select',
          componentProps: {
            options: [
              { label: "关闭", value: false },
              { label: "开启", value: true },
            ],
            placeholder: "请选择",
          },
        },
        {
          field: 'config.exact_match',
          label: '答案是否精确匹配',
          component: 'Select',
          componentProps: {
            options: [
              { label: "否", value: false },
              { label: "是", value: true },
            ],
            placeholder: "请选择",
          },
        },
        {
          field: 'config.wenti',
          label: '入群问题',
          component: 'Input',
          required: false,
          componentProps: { placeholder: '如：光是遇见下一句？' },
        },
        {
          field: 'config.answer_list',
          label: '正确答案列表',
          component: 'Input',
          required: false,
          componentProps: { placeholder: '如：就很美好' },
        },
        {
          field: 'config.request_timeout',
          label: '审核请求超时（毫秒）',
          component: 'Input',
          required: false,
          componentProps: { placeholder: '如30000' },
        },
        {
          field: 'config.group_map',
          label: '群号与群名映射',
          component: 'GSubForm',
          componentProps: {
            multiple: true,
            schemas: [
              {
                field: 'group_id',
                label: '群号',
                component: 'Input',
                required: true
              },
              {
                field: 'group_name',
                label: '群名',
                component: 'Input',
                required: true
              }
            ]
          }
        },
        {
          component: 'Divider',
          label: '自动审核白名单设置',
          componentProps: {
            orientation: 'left',
            plain: true
          }
        },
        {
          field: 'config.group_whitelist',
          label: '群白名单',
          component: 'Input',
          required: false,
          componentProps: { placeholder: '[群号, ...]' },
        },
        {
          field: 'config.member_whitelist',
          label: '成员白名单',
          component: 'Input',
          required: false,
          componentProps: { placeholder: '[QQ号, ...]' },
        },
        { label: '多群广播', component: 'SOFT_GROUP_BEGIN' },
        {
          field: 'broadcast.sourceGroupId',
          label: '源群号',
          component: 'Input',
          required: true,
          componentProps: { placeholder: '请输入源群号' }
        },
        {
          field: 'broadcast.destinationGroupIds',
          label: '目标群号列表',
          component: 'GSubForm',
          componentProps: {
            multiple: true,
            schemas: [
              {
                field: 'group_id',
                label: '群号',
                component: 'Input',
                required: true
              }
            ]
          }
        },
        {
          field: 'broadcast.bloggers',
          label: '博主QQ号列表',
          component: 'GSubForm',
          componentProps: {
            multiple: true,
            schemas: [
              {
                field: 'qq',
                label: 'QQ号',
                component: 'Input',
                required: true
              }
            ]
          }
        },
        {
          field: 'broadcast.admins',
          label: '管理员QQ号列表',
          component: 'GSubForm',
          componentProps: {
            multiple: true,
            schemas: [
              {
                field: 'qq',
                label: 'QQ号',
                component: 'Input',
                required: true
              }
            ]
          }
        },
      ],
      getConfigData() {
        return setting.getConfigData();
      },
      setConfigData(data, { Result }) {
        return setting.setConfigData(data, { Result });
      }
    }
  }
}
