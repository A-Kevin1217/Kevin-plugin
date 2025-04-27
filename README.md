# 小丞插件

[Kevin-plugin 仓库主页（含README）](https://github.com/A-Kevin1217/Kevin-plugin)

> 仅兼容 TRSS-Yunzai 框架

## 插件简介

小丞插件是专为 TRSS-Yunzai 框架开发的多功能群管与娱乐插件，支持多群管理、自动进群审核、吃喝推荐、点歌、娱乐互动等功能，注重结构化与用户体验。

## 主要功能
- 多群统一管理
- 自动进群审核（支持自定义问题与答案、等级验证、白名单）
- 吃喝推荐（支持自定义添加、审核）
- 点歌（支持多平台）
- 恶魔轮盘等娱乐功能
- 群成员重复加群检测
- 群进退通知

## 安装方法
1. 将本插件文件夹放入 Yunzai-Bot 的 `plugins` 目录下。
2. 重启 Yunzai-Bot。
3. 按需配置 `config/config.yaml`。

### 推荐使用git安装

使用Github：
```
git clone --depth=1 https://github.com/A-Kevin1217/Kevin-plugin.git ./plugins/Kevin-plugin/
```
使用Gitee：
```
git clone --depth=1 https://gitee.com/Kevin1217/Kevin-plugin.git ./plugins/Kevin-plugin/
```

### 使用 pnpm 安装依赖

如果你使用 pnpm 管理依赖，在 Yunzai-Bot 根目录下运行：

```bash
pnpm install --filter=Kevin-plugin
```

这样只会为 Kevin-plugin 安装/更新依赖，速度更快且不会影响其他插件。

## 配置说明
- 所有群号、群名、白名单、审核问题等均在 `config/config.yaml` 统一管理。
- 吃喝推荐数据存放于插件 `data/food_drink_data.json` 文件中。

## 注意事项
- 本插件仅适配 TRSS-Yunzai 框架，其他框架无法保证兼容性。
- 插件所有功能仅供学习与交流，禁止用于商业用途。

## 开发者
- 作者：小丞
- QQ：1354903463

---
如有问题或建议，欢迎联系作者。
