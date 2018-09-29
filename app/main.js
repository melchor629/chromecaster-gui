//jshint esversion: 6
const electron = require('electron');
const BrowserWindow = electron.BrowserWindow;
const app = electron.app;
const c = require('chromecaster-lib');
const lame = require('lame');
const flac = require('flac-bindings');
const wav = require('wav');
const CATray = require('./tray.js');
const config = require('./config.js');

let mainWindow = null;
let menu = null;
let tray = null;
let tt = {};
let crashes = 0, onReadyApp, quitApp;

app.on('ready', onReadyApp = () => {
    mainWindow = new BrowserWindow({
        width: 300,
        height: 500,
        minWidth: 300,
        minHeight: 500,
        maxWidth: 300,
        maxHeight: 500,
        frame: false,
        titleBarStyle: 'hidden-inset',
        maximizable: false,
        fullscreenable: false,
        resizable: false,
        title: 'Chromecaster',
        webgl: false,
        webaudio: false,
        show: false
    });
    mainWindow.loadURL(`file://${__dirname}/index.html`);
    mainWindow.on('close', () => {
        mainWindow = null;
    });

    mainWindow.webContents.on('crashed', () => {
        let msg = '';
        if(crashes === 0) {
            msg = 'If it crashes again, the app will close.';
        } else {
            msg = 'The app will close';
        }
        electron.dialog.showErrorBox('Chromecaster window has crashed',
            `The window has crashed. ${msg}`);
        crashes++;
        if(crashes === 1) {
            let lewin = mainWindow;
            tray.destroy();
            onReadyApp();
            lewin.destroy();
        } else {
            quitApp();
        }
    });

    mainWindow.on('unresponsive', () => {
        electron.dialog.showMessageBox({
            type: 'warning',
            buttons: [ 'Wait', 'Quit' ],
            defaultId: 0,
            cancelId: 1,
            title: 'Chromecaster window not responds',
            message: 'The window become unresponsive. You could wait until gets'+
                ' responsive again or close the app.'
        }, (r) => {
            if(r === 1) {
                quitApp();
            }
        });
    });

    process.on('uncaughtException', (error) => {
        console.log(error);
        electron.dialog.showErrorBox('Chromecaster had an internal error',
            'The app has an internal unrecoverable error and must be closed.');
        quitApp();
    });

    const template = [
        {
            label: 'View',
            submenu: [
                {
                    label: 'Reload',
                    accelerator: 'CmdOrCtrl+R',
                    click(item, window) {
                        if(window) window.reload();
                    }
                },
                {
                    label: 'Toggle Developer Tools',
                    accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
                    click (item, focusedWindow) {
                        if (focusedWindow) focusedWindow.webContents.toggleDevTools();
                    }
                }
            ]
        },
        {
            role: 'window',
            submenu: [
                { role: 'minimize' },
                { role: 'close' }
            ]
        }
    ];
    if(process.platform === 'darwin') {
        template.unshift({
            label: electron.app.getName(),
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideothers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        });
        template[template.length - 1].submenu = [
            {
                label: 'Close',
                accelerator: 'CmdOrCtrl+W',
                role: 'close'
            },
            {
                label: 'Minimize',
                accelerator: 'CmdOrCtrl+M',
                role: 'minimize'
            },
            {
                label: 'Zoom',
                role: 'zoom'
            },
            {
                type: 'separator'
            },
            {
                label: 'Bring All to Front',
                role: 'front'
            }
        ];
    }
    if(process.argv[process.argv.length - 1] !== '--dev') {
        require('./updater.js');
        template.splice(template.length - 2, 1);
    } else {
        mainWindow.webContents.openDevTools();
    }

    menu = electron.Menu.buildFromTemplate(template);
    electron.Menu.setApplicationMenu(menu);
    tray = new CATray(mainWindow, tt);

    const path = require('path');
    if('function' === typeof flac.bindings.load) {
        console.log('Loading libFLAC from resources');
        if(process.platform === 'darwin') {
            flac.bindings.load(__dirname + '/../lib/mac/libFLAC.dylib');
        } else if(process.platform === 'linux') {
            flac.bindings.load(__dirname + '/../lib/linux/libFLAC.so');
        } else if(process.platform === 'windows' || process.platform === 'win32') {
            flac.bindings.load(path.dirname(__dirname) + '\\lib\\win\\libFLAC');
        }
    }

    if(!c.AudioInput.isNativeLibraryLoaded()) {
        console.log('Loading libportaudio from resources');
        if(process.platform === 'darwin') {
            c.AudioInput.loadNativeLibrary(__dirname + '/../lib/mac/libportaudio.dylib');
        } else if(process.platform === 'linux') {
            c.AudioInput.loadNativeLibrary(__dirname + '/../lib/linux/libportaudio.so');
        } else if(process.platform === 'windows' || process.platform === 'win32') {
            c.AudioInput.loadNativeLibrary(path.dirname(__dirname)+'\\lib\\win\\portaudio_x64');
        }
    }

    electron.ipcMain.once('windowLoaded', () => {
        config.get('showWindow').then(value => value && mainWindow.show());
        tray.loadConfig();
    });
});

app.on('window-all-closed', quitApp = () => {
    tray.destroy();
    if(client !== null) {
        ai.close();
        enc.end();
        web.stop();
        client.close();
    }
    app.quit();
});

app.on('activate', () => {
    if(mainWindow === null) {
        app.emit('ready');
    }
});


let browser = null, browserTimeout = null;
let client = null;
let ai = null, enc = null, web = null;
let powerSaveId = null;

electron.ipcMain.on('getAudioDevices', (event) => {
    event.returnValue = c.AudioInput.getDevices();
});

electron.ipcMain.on('discoverChromecasts', (event) => {
    if(browserTimeout !== null) {
        clearTimeout(browserTimeout);
        browserTimeout = null;
    }

    browser = new c.ChromecastDiscover();
    console.log('discoverChromecasts called');
    browser.on('device', (device) => {
        if(device.name !== undefined) {
            event.sender.send('discoverChromecasts:reply', device.name);
            tray.addChromecast(device.name);
            console.log('discoverChromecasts:reply sent with ' + JSON.stringify(device));
        }
    });
    browser.start();
    tray._clearChromecasts();
    tray.searchChromecastsItemEnabled = false;
    browserTimeout = setTimeout(() => {
        browser.stop();
        tray.searchChromecastsItemEnabled = true;
        event.sender.send('discoverChromecasts:end');
        console.log('discoverChromecasts:end sent');
    }, 10000);
});

electron.ipcMain.on('connectChromecast', tt.connectChromecast = (event, name, audioDevice, quality) => {
    console.log('connectChromecast called with args: \'%s\', \'%s\', \'%s\'', name, audioDevice, quality);
    if(client) {
        console.log('discoverChromecasts:error sent with ("Already connected")');
        return event.sender.send('connectChromecast:error', ('Already connected'));
    } else if(!browser) {
        console.log('discoverChromecasts:error sent with ("First search for a Chromecast")');
        return event.sender.send('connectChromecast:error', ('First search for a Chromecast'));
    }

    tray.startCastingVisibility = false;
    tray.setStatusMessage('Starting internal things...');
    let Client = browser.createClient(name);
    let contentType;
    if(quality === 'flac') {
        ai = new c.AudioInput({ deviceName: audioDevice, bps: 16, samplerate: 44100 });
        enc = new flac.StreamEncoder();
        contentType = 'audio/flac';
        console.log('Using FLAC encoder');
    } else if(quality === 'flac-hd') {
        ai = new c.AudioInput({ deviceName: audioDevice, bps: 24, samplerate: 96000 });
        enc = new flac.StreamEncoder({ bitsPerSample: 24, samplerate: 96000 });
        contentType = 'audio/flac';
        console.log('Using FLAC encoder with 96KHz and 24bit');
    } else if(quality === 'wav') {
        ai = new c.AudioInput({ deviceName: audioDevice, bps: 16, samplerate: 44100 });
        enc = new wav.Writer();
        contentType = 'audio/wav';
        console.log('Using WAV container, no encoding done');
    } else if(quality === 'wav-hd') {
        ai = new c.AudioInput({ deviceName: audioDevice, bps: 24, samplerate: 96000 });
        enc = new wav.Writer({ sampleRate: 96000, bitDepth: 24 });
        contentType = 'audio/wav';
        console.log('Using WAV container, no encoding done');
    } else {
        ai = new c.AudioInput({ deviceName: audioDevice });
        contentType = 'audio/mp3';
        console.log('Using lame encoder');
        enc = new lame.Encoder({
            channels: 2,
            bitDepth: 16,
            sampleRate: 44100,
            bitRate: Number(quality),
            outSampleRate: 44100,
            mode: lame.JOINTSTEREO
        });
    }
    web = new c.Webcast({ port: 9876, contentType });

    ai.open();
    web.on('connected', () => {
        console.log('Chromecast connected to the stream');
        tray.setStatusMessage('buffering...');
        ai.on('data', enc.write.bind(enc));
        enc.on('data', web.write.bind(web));
    });
    Client.setWebcast(web);
    tray.setStatusMessage('connecting...');
    Client.connect((err, status) => {
        if(err) {
            tray.startCastingVisibility = true;
            tray.setStatusMessage();
            event.sender.send('connectChromecast:error', err);
            console.log('connectChromecast:error sent with ' + JSON.stringify(err));
            ai.close();
            enc.end();
            web.stop();
            ai = enc = web = null;
        } else {
            tray.setStatusMessage(status);
            tray.stopCastingVisibility = true;
            event.sender.send('connectChromecast:ok', status);
            console.log('connectChromecast:ok sent');
            powerSaveId = electron.powerSaveBlocker.start('prevent-app-suspension');
            client = Client;
            client.on('status', (status) => {
                tray.setStatusMessage(status);
                event.sender.send('chromecast:status', status);
                console.log('chromecast:status sent with ' + JSON.stringify(status));
            });
            client.on('error', (error) => {
                ai.close();
                enc.end();
                web.stop();
                tray.setStatusMessage();
                tray.startCastingVisibility = true;
                tray.stopCastingVisibility = false;
                event.sender.send('chromecast:error', error);
                console.log('chromecast:error sent with ' + JSON.stringify(error));
            });
        }
    });
});

electron.ipcMain.on('volume:get', (event) => {
    console.log('volume:get called');
    if(client) {
        client.getVolume((err, volume) => {
            if(err) event.sender.send('volume:error', err);
            else event.sender.send('volume:reply', volume);
        });
    } else event.sender.send('volume:error', ('Not connected to a Chromecast'));
});

electron.ipcMain.on('volume:set', (event, volume) => {
    console.log('volume:set called with args: %d', volume);
    if(client) {
        client.setVolume(volume, (err, volume) => {
            if(err) event.sender.send('volume:error', err);
            else event.sender.send('volume:reply', volume);
        });
    } else event.sender.send('volume:error', ('Not connected to a Chromecast'));
});

electron.ipcMain.on('muted:get', (event) => {
    console.log('volume:get called');
    if(client) {
        client.isMuted((err, muted) => {
            if(err) event.sender.send('muted:error', err);
            else event.sender.send('muted:reply', muted);
        });
    } else event.sender.send('muted:error', ('Not connected to a Chromecast'));
});

electron.ipcMain.on('muted:set', (event, muted) => {
    console.log('muted:set called with args: %s', muted);
    if(client) {
        client.setMuted(muted, (err, muted) => {
            if(err) event.sender.send('muted:error', err);
            else event.sender.send('muted:reply', muted);
        });
    } else event.sender.send('muted:error', ('Not connected to a Chromecast'));
});

electron.ipcMain.on('disconnectChromecast', tt.disconnectChromecast = (event) => {
    console.log('disconnectChromecast called');
    if(!client) return event.sender.send('disconnectChromecast:error', ('Not connected to a Chromecast'));
    ai.close();
    enc.end();
    web.stop();
    client.close();
    electron.powerSaveBlocker.stop(powerSaveId);
    client = ai = web = enc = powerSaveId = null;
    tray.startCastingVisibility = true;
    tray.stopCastingVisibility = false;
    tray.setStatusMessage();
    event.sender.send('disconnectChromecast:reply');
    console.log('disconnectChromecast:reply sent');
});

electron.ipcMain.on('isConnected', (event) => {
    event.returnValue = !!client;
});
