//jshint esversion: 6
const { BrowserWindow, ipcMain } = require('electron');
const logger = require('./logger.js');

let window = () => BrowserWindow.getAllWindows()[0];
let listeners = [];

ipcMain.on('config:changed', (event, key, value) => {
    logger.info(`config:changed ${key} ${value}`);
    for(let listener of listeners) {
        listener(key, value);
    }
});

module.exports = {
    get(key) {
        return new Promise((resolve) => {
            ipcMain.once('config:reply:' + key, (event, value) => {
                logger.info(`config:reply:${key} ${value}`);
                resolve(value);
            });
            window().webContents.send('config:get', key);
            logger.info('config:get ' + key);
        });
    },

    set(key, value) {
        window().webContents.send('config:set', key, value);
        logger.info(`config:set ${key} ${value}`);
    },

    changed(list) {
        if('function' === typeof list) {
            listeners.push(list);
        }
    }
};
