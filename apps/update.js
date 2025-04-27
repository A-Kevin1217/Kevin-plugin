import { update } from "../../other/update.js"
export class tkupdate extends plugin {
  constructor() {
    super({
      name: "[小丞插件]更新",
      event: "message",
      priority: 1145,
      rule: [
        {
          reg: "^#*小丞(插件)?(强制)?更新$",
          fnc: "update"
        }
      ]
    })
  }
  async update(e = this.e) {
    e.msg = `#${e.msg.includes("强制") ? "强制" : ""}更新 Kevin-plugin https://gitee.com/Kevin1217/Kevin-plugin`
    const up = new update(e)
    up.e = e
    return up.update()
  }
}