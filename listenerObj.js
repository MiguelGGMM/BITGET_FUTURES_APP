const bitgetApi = require('bitget-api-node-sdk');
var AsyncLock = require('async-lock');

class ListennerObj extends bitgetApi.Listenner{
    constructor(_name, orderManagers){
        super();
        this.name = _name;
        this.lastUpdateAccInfo = 0;
        this.lastUpdatePosInfo = 0;
        this.ordersIds = {};
        this.orderManagers = orderManagers;
        this.orderLock = new AsyncLock();
        this.getDateMinutes = () => { return parseInt(Date.now()/60000); }
        this.printMsg = (msg) => { console.info(`${new Date().toLocaleTimeString('en-GB')} [Account: ${this.name}]\t>>> ${msg}`); }        
        this.eventType = (arg, data) => {
            // 0 unknown
            // 1 account
            // 2 position
            // 3 opened order
            // 4 closed order
            if(arg.instType == "umcbl" && data.marginCoin && data.available && data.maxOpenPosAvailable && data.equity){
                return 1;
            }
            if(arg.instType == "umcbl" && arg.channel == "positions"){
                return 2;
            }
            if(
                arg.instType == "umcbl" && (arg.channel == "orders" || arg.channel == "ordersAlgo") && 
                ((data.posSide == "long" && data.side == "buy") || (data.posSide == "short" && data.side == "sell"))
            ){
                return 3;
            }
            if(
                arg.instType == "umcbl" && (arg.channel == "orders" || arg.channel == "ordersAlgo") && 
                ((data.posSide == "long" && data.side == "sell") || (data.posSide == "short" && data.side == "buy"))
            ){
                return 4;
            }
            return 0;
        }
    }

    msgOrderFeedback = (orderObj, _new) => {
        let margin = (parseFloat(orderObj.notionalUsd)/parseInt(orderObj.lever)).toFixed(3) 
        let configPos = `${orderObj.posSide} x${orderObj.lever} (${orderObj.tdMode}) ${orderObj.instId}`;
        if(_new){
            return `[NEW ORDER ${_d.ordId}] ${configPos}: ${_d.tgtCcy} (${margin})`;    
        }else{
            return `[CLOSED ORDER ${_d.ordId}] ${configPos}: ${_d.tgtCcy} (${margin})`;    
        }
    }
    reveice = async (message) => {
        try{
            if(message == "pong"){
                return;
            }
            let _obj = JSON.parse(message);

            // Basic check
            if(_obj.action && _obj.action == "snapshot" && _obj.arg && _obj.arg.instType && _obj.data && _obj.data.length >= 1)
            {
                for(const _d of _obj.data)
                {
                    switch(this.eventType(_obj.arg, _d)){
                        // Account data
                        case(1):
                            if(this.lastUpdateAccInfo < this.getDateMinutes()){
                                this.lastUpdateAccInfo = this.getDateMinutes();
                                this.printMsg(`${_d.marginCoin}: ${_d.equity} (Balance), ${_d.maxOpenPosAvailable} (Available)`);                        
                            }
                            break;                        
                        // Positions data
                        case(2):
                            if(this.lastUpdatePosInfo < this.getDateMinutes()){
                                this.lastUpdatePosInfo = this.getDateMinutes();
                                let configPos = `${_d.holdSide} x${_d.leverage} (${_d.marginMode}) ${_d.instId}`;
                                this.printMsg(`${configPos}: ${_d.margin} (${_d.marginCoin} margin), ${_d.upl}$ (PNL)`);
                            }
                            break;
                        // Open orders, open and link orders
                        case(3):          
                            let secondsSinceOrder = parseInt((Date.now() - _d.uTime)/1000);
                            if(secondsSinceOrder < 10)  
                            {
                                // LOCK
                                await this.orderLock.acquire(_d.ordId, async function() {
                                    let orderFeedback = this.msgOrderFeedback(_d, true);
                                    this.printMsg(orderFeedback);                            
                                    this.orderManagers.forEach(async (orderManager) => { 
                                        let orderOpenedId = -1;
                                        try{
                                            orderOpenedId = await orderManager.OpenOrderFather(_d.ordId, _d.posSide, _d.lever, _d.sz);
                                            this.printMsg(`${orderFeedback}, opened for ${orderManager.name} (${orderOpenedId})`);
                                        }catch(ex){
                                            this.printMsg(`Error opening order (${_d.ordId}) for ${orderManager.name}
                                            ERROR:
                                            ${ex.toString()}`);
                                        }
                                    });    
                                }, {}).catch(function(err) {
                                    if(err != undefined){
                                        throw err;
                                    }
                                });                    
                            }
                            else{
                                this.printMsg(`late order (> 10s: ${secondsSinceOrder}), ${_d.ordId} (order id), message: ${message}`);
                            }
                            break;
                        // Close orders, close linked orders
                        case(4):  
                            await this.orderLock.acquire(_d.ordId, async function() {
                                let orderFeedback = this.msgOrderFeedback(_d, false);
                                this.printMsg(orderFeedback);                  
                                this.orderManagers.forEach(async (orderManager) => {  
                                    try{
                                        let _sonOrder = await orderManager.CloseOrderFather(_d.orgId, _d.posSide, _d.lever, _d.sz); 
                                        this.printMsg(`${orderFeedback}, closed for ${orderManager.name} (${_sonOrder})`);  
                                    }catch(ex){
                                        this.printMsg(`Error closing order (${_d.ordId}) for ${orderManager.name}
                                        ERROR:
                                        ${ex.toString()}`);
                                    }
                                });     
                            }, {}).catch(function(err) {
                                if(err != undefined){
                                    throw err;
                                }
                            });                                                     
                            break;
                        default:
                            this.printMsg(`unknown event, message received: ${message}`);
                            break;
                    }
                }
            }
        }
        catch(ex)
        {
            this.printMsg(` 
            ERROR, 
            message received: ${message}, 
            error message: ${ex.toString()}`);
        }
    }
}

exports.ListennerObj = ListennerObj;