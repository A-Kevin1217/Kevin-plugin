export class 猫猫糕 extends plugin{
    constructor(){
        super({
            name: '猫猫糕',
            dsc: '猫猫糕',
            event: 'message',
            priority: 1000,
            rule: [{
                reg: /^(#|\/)?(今日猫猫糕)$/,
                fnc: 'TODAY_MMG'
            }]
        })
    }
    async TODAY_MMG(e){
        const today = new Date()
        const todayMMG = await this.getTodayMMG()
    }
}