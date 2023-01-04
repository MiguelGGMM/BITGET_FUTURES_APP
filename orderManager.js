const bitgetApi = require('bitget-api-node-sdk');
const fs = require('fs');
const cachePrefix = "./cache/";
const cacheSufix = "_cache.json";
var AsyncLock = require('async-lock');

class OrderManager {    
    constructor(_accountData, debug) {
        this.name = _accountData.name;        
        this.multiplier = _accountData.multiplier;
        this.fixedAmountBTC = _accountData.fixedAmountBTC;
        this.mixOrderAPI = new bitgetApi.MixOrderApi(_accountData.apiKey,_accountData.secretKey,_accountData.passPhrase);
        this.mixAccountAPI = new bitgetApi.MixAccountApi(_accountData.apiKey,_accountData.secretKey,_accountData.passPhrase);
        this.fatherSonIds = {};
        this.ordersOpenedIds = [];
        this.cacheFile = `${cachePrefix}${this.name}${cacheSufix}`;
        this.debug = debug;
        this.orderLock = new AsyncLock();
        this.isOwnOrder = (orderId) => { 
            return this.ordersOpenedIds.includes(orderId); 
        }
        this.isFatherRegistered = (orderId) => { 
            return this.fatherSonIds[orderId] != undefined; 
        }
    }
    printDebug = (msg) => {
        if(this.debug){
            console.log(`[DEBUG] ${msg}`);
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
            "size": this.debug ? (0.001).toString() : (this.fixedAmountBTC != "" ? this.fixedAmountBTC : (parseFloat(size)*this.multiplier).toFixed(3)),
            "side": side,
            "orderType":"market"
        });
        if(!(answer.data && answer.data.orderId)){
            console.log(`ERROR OPENING ORDER (${side}) FOR ${this.name}. Code ${answer.code}. Msg: ${answer.msg}`);
        }

        return answer.data.orderId;
    }
    CloseOrder = async (orderId) => {
        var answer = await this.mixOrderAPI.cancelOrder({ orderId, symbol : "BTCUSDT_UMCBL", marginCoin : "USDT" });        
        if(debug){
            _this.printDebug(`Close order: ${answer.data.orderId}`);
        }
    }
    SetSon = async (fatherId, sonId) => {
        this.fatherSonIds[fatherId] = sonId;
        await this.SaveSnapshot();
    }
    GetSon = (fatherId) => {
        return this.fatherSonIds[fatherId];
    }
    OpenOrderFather = async (fatherId, side, leverage, size) => {
        let _this = this;
        await this.orderLock.acquire(fatherId, async function() {
            if(!_this.isFatherRegistered(fatherId) && !_this.isOwnOrder(fatherId)){
                await _this.SetSon(fatherId, (await _this.OpenOrder(`open_${side}`, leverage, size)));            
                _this.ordersOpenedIds.push(_this.GetSon(fatherId));            
            }
        }, {}).catch(function(err) {
            if(err != undefined){
                throw err;
            }
        });

        return this.GetSon(fatherId);
    }
    CloseOrderFather = async (fatherId, side, leverage, size) => {
        let _this = this;
        let _son = -1;
        await this.orderLock.acquire(fatherId, async function() {
            if(_this.isFatherRegistered(fatherId) && !_this.isOwnOrder(fatherId)){
                _this.printDebug(`CloseOrderFather is registered: fatherId -> ${fatherId}, sonId -> ${_son}`);
                _son = _this.GetSon(fatherId);
                _this.printDebug(`CloseOrderFather son id: fatherId -> ${fatherId}, sonId -> ${_son}`);
                await _this.CloseOrder(_son);
                await _this.SetSon(fatherId, undefined);            
            }
            else{
                _this.printDebug(`CloseOrderFather not registered: fatherId -> ${fatherId}, sonId -> ${_son}`);
                _this.printDebug(`Trying to close from amount...`);
                _son = await this.OpenOrder(`close_${side}`, leverage, size);
                if(_son != -1){
                    _this.printDebug(`Successful, orderId ${_son}`);
                }
            }
        }, {}).catch(function(err) {
            if(err != undefined){
                throw err;
            }
        });

        return _son;
    }
}
exports.OrderManager = OrderManager;