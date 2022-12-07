const bitgetApi = require('bitget-api-node-sdk');
const fs = require('fs');
const cachePrefix = "./cache/";
const cacheSufix = "_cache.json";

class OrderManager {    
    constructor(_accountData) {
        this.name = _accountData.name;        
        this.multiplier = _accountData.multiplier;
        this.mixOrderAPI = new bitgetApi.MixOrderApi(_accountData.apiKey,_accountData.secretKey,_accountData.passPhrase);
        this.mixAccountAPI = new bitgetApi.MixAccountApi(_accountData.apiKey,_accountData.secretKey,_accountData.passPhrase);
        this.fatherSonIds = {};
        this.ordersOpenedIds = [];
        this.cacheFile = `${cachePrefix}${this.name}${cacheSufix}`;
        this.isOwnOrder = (orderId) => { 
            return this.ordersOpenedIds.includes(orderId); 
        }
        this.isFatherRegistered = (orderId) => { 
            return this.fatherSonIds[orderId] != undefined; 
        }
    }
    LoadSnapshot = async () => {
        if(fs.existsSync(this.cacheFile)){
            var cacheObj = fs.readFileSync(this.cacheFile);
            this.fatherSonIds = JSON.parse(cacheObj).fatherSonIds;
            if(this.fatherSonIds.length > 0){
                console.log(`Successfully loaded cache for account: ${this.name} (${this.fatherSonIds.length})`);
            }
        }
    }
    SaveSnapshot = async () => {
        var cacheObj = { fatherSonIds: this.fatherSonIds };
        fs.writeFileSync(this.cacheFile, JSON.stringify(cacheObj));
    }
    Initialize = async () => {
        await this.LoadSnapshot();
        var answer = await this.mixOrderAPI.current("BTCUSDT_UMCBL");
        if(answer.data && answer.data.orderList){
            await answer.data.orderList.forEach(async (order) => {
                this.ordersOpenedIds.push(order.orderId);
            });
        }
        if(answer.code != "00000"){
            console.log(`ERROR INITIALIZING ACCOUNT: ${this.name}. Code: ${answer.code}. Msg: ${answer.msg}`);
        }
    }
    OpenOrder = async (side, leverage, size) => {
        // ACC API
        await this.mixAccountAPI.setLeverage({"symbol": "BTCUSDT_UMCBL","marginCoin": "USDT","leverage": leverage.toString()});
                
        // ORDER API   
        var answer = await this.mixOrderAPI.placeOrder({
            "symbol": "BTCUSDT_UMCBL", 
            "marginCoin": "USDT",
            "size": (0.001).toString(),//(parseFloat(size)*this.multiplier).toFixed(3),
            "side": `open_${side}`,
            "orderType":"market"
        });
        if(!(answer.data && answer.data.orderId)){
            console.log(`ERROR OPENING ORDER FOR ${this.name}. Code ${answer.code}. Msg: ${answer.msg}`);
        }

        return answer.data.orderId;
    }
    CloseOrder = async (orderId) => {
        await this.mixOrderAPI.cancelOrder({ orderId, symbol : "BTCUSDT_UMCBL", marginCoin : "USDT" });
    }
    SetSon = async (fatherId, sonId) => {
        this.fatherSonIds[fatherId] = sonId;
        await this.SaveSnapshot();
    }
    GetSon = (fatherId) => {
        return this.fatherSonIds[fatherId];
    }
    OpenOrderFather = async (fatherId, side, leverage, size) => {
        if(!this.isFatherRegistered(fatherId) && !this.isOwnOrder(fatherId)){
            await this.SetSon(fatherId, (await this.OpenOrder(side, leverage, size)));            
            this.ordersOpenedIds.push(this.GetSon(fatherId));            
            return this.GetSon(fatherId);
        }
    }
    CloseOrderFather = async (fatherId) => {
        if(this.isFatherRegistered(fatherId) && !this.isOwnOrder(fatherId)){
            await this.CloseOrder(this.GetSon(fatherId));
            await this.SetSon(fatherId, undefined);            
        }
    }
}
exports.OrderManager = OrderManager;