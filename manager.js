const bitgetApi = require('bitget-api-node-sdk');//require('bitget-openapi');
const { test, describe, expect } = require('@jest/globals')

const accountsData = require('./accounts.json').accounts_data;
const accountListener = require('./accountListener.js'); // Listeners

var accountListeners = [];
var mixAccountsAPIs = [];
var mixOrdersAPIs = [];

// Subscribe accounts events, orders/positions data
accountsData.forEach(accountData => {
    accountListeners.push(new accountListener.AccountListener(accountData));
    accountListeners.at(-1).subscribeEvents();

    mixAccountsAPIs.push(new bitgetApi.default.MixAccountApi(accountData.apiKey,accountData.secretKey,accountData.passPhrase));
    mixAccountsAPIs.at(-1).accounts('umcbl').then((data) => {
        console.info(`Account '${accountData.name}' data: ${data}`);
    });

    mixOrdersAPIs.push(new bitgetApi.default.MixOrderApi(accountData.apiKey,accountData.secretKey,accountData.passPhrase));
    //ModifyPlanPresetReq
});

// Open order
const OpenOrder = async (accountsApply, side, leverage, amount) => {
    // ACC API
    mixAccountsAPIs.forEach(mixAccountAPI => {
        //{"symbol": "BTCUSDT_UMCBL","marginCoin": "USDT","leverage": "20"}
        await mixAccountAPI.setLeverage({"symbol": "BTCUSDT_UMCBL","marginCoin": "USDT","leverage": leverage.toString()});
        //{"symbol": "BTCUSDT_UMCBL","marginCoin": "USDT","amount": "-10"}
        await mixAccountAPI.setMargin({"symbol": "BTCUSDT_UMCBL","marginCoin": "USDT","amount": amount.toString()});
        //{"symbol": "BTCUSDT_UMCBL","marginCoin": "USDT","marginMode": "crossed"}
        await mixAccountAPI.setMarginMode({"symbol": "BTCUSDT_UMCBL","marginCoin": "USDT","marginMode": "crossed"});
        //{"symbol": "BTCUSDT_UMCBL","marginCoin": "USDT","holdMode": "double_hold"}        
        await mixAccountAPI.setPositionMode({"symbol": "BTCUSDT_UMCBL","marginCoin": "USDT","holdMode": "double_hold"});
    });
            
    // ORDER API   
    mixOrdersAPIs.forEach(mixOrderAPI => {     
        //{"symbol": "BTCUSDT_UMCBL","marginCoin": "USDT","size": "0.01","side":"open_long","orderType":"market","timeInForceValue":"normal","clientOid":"reverse@483939290002","reverse":true}
        await mixOrderAPI.placeOrder({
            "symbol": "BTCUSDT_UMCBL", 
            "marginCoin": "USDT",
            "size": amount,
            "side": `open_${side}`,
            "orderType":"market",
            // ???
            // "timeInForceValue":"normal",
            // "clientOid":"reverse@483939290002",
            // "reverse":true
        });        
    });
}

// Set SL/TP
const ModifyOrder = async (ordersApply, isSL, priceMark) => {
    //TODO
}

// Validate command
const ValidateCommand = async (command) => {
    var isValid = true;
    var chunks = command.split(' ');
    if(chunks.length == 4)
    {
        // Place order command
        if(chunks[0] != 'All'){
            console.log('Only "All" implemented for now');
            isValid = false;
        }
        if(chunks[1] != 'short' && chunks[1] != 'long'){
            console.log(`Only "short" or "long" allowed, received ${chunks[1]}`);
            isValid = false;
        }
        if(!(parseInt(chunks[2]) >= 1 && parseInt(chunks[2]) < 250)){
            console.log(`Only 1-250 leverage allowed, received ${chunks[2]}`);
            isValid = false;
        }
        if(parseInt(chunks[3]) >= 1){
            console.log(`Only >=1 values allowed, received ${chunks[3]}`);
            isValid = false;
        }
    }
    else if(chunks.length == 3)
    {
        // Set SL/TP command
        if(chunks[0] != 'All'){
            console.log('Only "All" implemented for now');
            isValid = false;
        }
        if(chunks[1] != 'sl' && chunks[1] != 'tp'){
            console.log(`Only "sl" or "tp" allowed, received ${chunks[1]}`);
            isValid = false;
        }
        if(!(parseInt(chunks[2]) >= 1 && parseInt(chunks[2]) < 250)){
            console.log(`Only >=1 price allowed, received ${chunks[2]}`);
            isValid = false;
        }
    }
    return isValid;
}

// Commands
console.log(`    
    [MAIN COMMAND]
    Main command format: All|AccountName|AccountsNames  short|long Leverage(number) Amount(number of dollars)    
    Main command example 1: All short 10 100 (open short position in all your account x10 leverage and 100 dollars)
    Main command example 2: Ac1 short 10 100 (open short position in all your account x10 leverage and 100 dollars)
    Main command example 3: Ac1,Ac2 short 10 100 (open short position in all your account x10 leverage and 100 dollars)

    [SECONDARY COMMAND (still not implemented)]
    Secondary command format: All|OrderId|OrderIds sl|tp Price(number)
    Secondary command example 1: All sl 16000 (set sl to 16000 for all your orders in all your accounts)
    Secondary command example 2: 12245 sl 16000 (set sl to 16000 for orderId 12245)
    Secondary command example 3: 12245,12247 sl 16000 (set sl to 16000 for orderIds 12245 and 12247)

    [EXIT COMMAND]
    'quit'
`);

() => {
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', function (text) {
        if (text.trim() === 'quit') {
            process.exit();
        }
        else{
            var parameters = text.split(' ');
            if((await ValidateCommand(text))){
                if(parameters.length == 4)
                {
                    await OpenOrder(parameters[0], parameters[1], parameters[2], parameters[3]);
                }else{
                    //await ModifyOrder(parameters[0], parameters[1], parameters[2]);
                }
            }
        }
    });
};