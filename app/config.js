//jshint esversion: 6
const { BrowserWindow, ipcMain } = require('electron');
let window = () => BrowserWindow.getAllWindows()[0];
let listeners = [];

ipcMain.on('config:changed', (event, key, value) => {
    console.log(`config:changed ${key} ${value}`);
    for(let listener of listeners) {
        listener(key, value);
    }
});

module.exports = {
    get(key) {
        return new Promise((resolve, reject) => {
            ipcMain.once('config:reply:' + key, (event, value) => {
                console.log('config:reply:%s %s', key, value);
                resolve(value);
            });
            window().webContents.send('config:get', key);
            console.log('config:get ' + key);
        });
    },

    set(key, value) {
        window().webContents.send('config:set', key, value);
        console.log('config:set ' + key + ' ' + value);
    },

    changed(list) {
        if('function' === typeof list)
            listeners.push(list);
    }
};
