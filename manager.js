const accountsData = require('./config/accounts.json').accounts_data;
const debugMode = require('./config/accounts.json').debug;
const accountListener = require('./accountListener.js');

//BASIC
Array.prototype.at = function (pos) { return pos >= 0 ? this[pos] : this[this.length + pos]; };

var accountListeners = new Array();

// Subscribe accounts events, orders/positions data
accountsData.forEach(accountData => {
    accountListeners.push(new accountListener.AccountListener(accountData, debugMode));
    accountListeners.at(-1).initialize();
});