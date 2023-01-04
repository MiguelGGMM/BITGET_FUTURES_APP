const bitgetApi = require('bitget-api-node-sdk');
const orderManager = require('./orderManager.js');
const listenerObj = require('./listenerObj');

class AccountListener {
    constructor(_accountData, debug) {
        this.name = _accountData.name;
        this.apiKey = _accountData.apiKey;
        this.secretKey = _accountData.secretKey;
        this.passPhrase = _accountData.passPhrase;
        this.accountsReply = _accountData.accountsReply;
        this.debug = debug;
        this.orderManagers = [];
        this.listener = undefined;
        this.wsClient = undefined;
    } 
    initialize = async () => {
        await this.initializeOrderManagers();
        await this.initializeWsClient();
    }
    initializeOrderManagers = async () => {
        await this.accountsReply.forEach(async (_accountDataReply) => { 
            let _orderManager = new orderManager.OrderManager(_accountDataReply, this.debug)
            await _orderManager.Initialize();
            this.orderManagers.push(_orderManager); 
        }); 
        this.listener = new listenerObj.ListennerObj(this.name, this.orderManagers);
    }   
    initializeWsClient = async () => {    
        if(this.wsClient != undefined){
            console.log(`RECONNECTING...`);
        }
        
        this.wsClient = new bitgetApi.BitgetWsClient(this.listener,this.apiKey,this.secretKey,this.passPhrase);
        this.wsClient.on('close', () => this.initializeWsClient());
        const subArr = new Array();

        const subscribeAcc = new bitgetApi.SubscribeReq("UMCBL", "account", "default");
        const subscribeOrders = new bitgetApi.SubscribeReq("UMCBL", "orders", "default");        
        const subscribeOrdersAlgo = new bitgetApi.SubscribeReq("UMCBL", "ordersAlgo", "BTCUSDT_UMCBL");        
        const subscribePostions = new bitgetApi.SubscribeReq("UMCBL", "positions", "BTCUSDT_UMCBL");

        subArr.push(subscribeAcc);
        subArr.push(subscribeOrders);
        subArr.push(subscribeOrdersAlgo);
        subArr.push(subscribePostions);
        
        this.wsClient.subscribe(subArr);
        this.wsClient.login();

        return this.wsClient;
    }
}
exports.AccountListener = AccountListener;