const bitgetApi = require('bitget-api-node-sdk');

class ListennerObj extends bitgetApi.Listenner{
    constructor(_name){
        this.name = _name;
    }
    reveice(message){
        console.info(`[Account: ${this.name}] >>> ${message}`);
    }
}

class AccountListener {
    constructor(_accountData) {
        this.name = _accountData.name;
        this.apiKey = _accountData.apiKey;
        this.apiSecret = _accountData.apiSecret;
        this.passphrase = _accountData.passphrase;
    }    
    subscribeEvents() {
        const listenner = new ListennerObj(this.name);
        const bitgetWsClient = new bitgetApi.BitgetWsClient(listenner,apiKey,secretKey,passphrase);
        const subArr = new Array();
        
        //https://bitgetlimited.github.io/apidoc/en/mix/#account-channel
        const subscribeAcc = new bitgetApi.SubscribeReq("UMCBL", "account", "default");
        
        subArr.push(subscribeAcc);
        
        bitgetWsClient.subscribe(subArr);
    }
}
exports.AccountListener = AccountListener;