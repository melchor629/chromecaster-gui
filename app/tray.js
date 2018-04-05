//jshint esversion: 6
const { Menu, MenuItem, Tray, BrowserWindow } = require('electron');
const EventEmitter = require('events');
const config = require('./config.js');

class CATray extends EventEmitter {
    constructor(win, tt) {
        super();
        if(process.platform === 'windows') {
            this._tray = new Tray(__dirname + '/icons/icon.ico');
        } else if(process.platform === 'darwin') {
            let a = require('electron').nativeImage.createFromPath(__dirname + '/icons/trayTemplate.png');
            a.setTemplateImage(true);
            this._tray = new Tray(a);
        } else {
            this._tray = new Tray(__dirname + '/icons/icon-32.png');
        }

        const menu = [
            {
                label: 'Audio Devices',
                submenu: [ ]
            },
            {
                label: 'Chromecasts',
                submenu: [
                    {
                        label: 'Search',
                        enabled: true,
                        click: () => {
                            BrowserWindow.getAllWindows()[0].webContents.send('searchChromecasts');
                            console.log('searchChromecasts sent from Tray menu');
                            this.emit('searchChromecasts', this);
                        }
                    },
                    { type: 'separator' }
                ]
            },
            {
                label: 'Quality',
                submenu: [
                    {
                        label: 'FLAC HD (96KHz - 24bit)',
                        type: 'radio',
                        click: () => config.set('selectedQuality', 'flac-hd')
                    },
                    {
                        label: 'FLAC (44.1KHz - 16bit)',
                        type: 'radio',
                        click: () => config.set('selectedQuality', 'flac')
                    },
                    {
                        label: 'MP3 - 320Kbps',
                        type: 'radio',
                        click: () => config.set('selectedQuality', '320')
                    },
                    {
                        label: 'MP3 - 256Kbps',
                        type: 'radio',
                        click: () => config.set('selectedQuality', '256')
                    },
                    {
                        label: 'MP3 - 224Kbps',
                        type: 'radio',
                        click: () => config.set('selectedQuality', '224')
                    },
                    {
                        label: 'MP3 - 192Kbps',
                        type: 'radio',
                        click: () => config.set('selectedQuality', '192')
                    },
                    {
                        label: 'MP3 - 160Kbps',
                        type: 'radio',
                        click: () => config.set('selectedQuality', '160')
                    },
                    {
                        label: 'MP3 - 128Kbps',
                        type: 'radio',
                        click: () => config.set('selectedQuality', '128')
                    },
                    {
                        label: 'MP3 - 112Kbps',
                        type: 'radio',
                        click: () => config.set('selectedQuality', '112')
                    },
                    {
                        label: 'MP3 - 96Kbps',
                        type: 'radio',
                        click: () => config.set('selectedQuality', '96')
                    },
                    {
                        label: 'WAV HD (96KHz - 24bit)',
                        type: 'radio',
                        click: () => config.set('selectedQuality', 'wav-hd')
                    },
                    {
                        label: 'WAV (44.1KHz - 16bit)',
                        type: 'radio',
                        click: () => config.set('selectedQuality', 'wav')
                    }
                ]
            },
            {
                type: 'separator'
            },
            {
                label: 'Start casting',
                click: () => {
                    config.get('selectedAudioDevice').then(audioDevice => {
                        config.get('selectedQuality').then(quality => {
                            config.get('selectedChromecast').then(chromecast => {
                                if(chromecast) {
                                    BrowserWindow.getAllWindows()[0].webContents.send('startCasting');
                                    console.log('startCasting sent from Tray menu');
                                    tt.connectChromecast({sender: BrowserWindow.getAllWindows()[0].webContents}, chromecast, audioDevice, quality);
                                } else {
                                    BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(`
                                        (() => {
                                            let n = new Notification('Could not connect to Chromecast', {
                                                body: 'No Chromecast have been selected. Select one and try again.', silent: true
                                            });
                                            n.onclick = () => n.close();
                                        })();`, true);
                                }
                            });
                        });
                    });
                    this.emit('startCasting', this);
                }
            },
            {
                label: 'Stop casting',
                visible: false,
                click: () => {
                    tt.disconnectChromecast({sender: BrowserWindow.getAllWindows()[0].webContents});
                    this.emit('stopCasting', this);
                }
            },
            {
                label: 'Status',
                sublabel: 'No idea',
                enabled: false,
                visible: false
            },
            {
                type: 'separator'
            },
            {
                label: 'Toggle window',
                type: 'checkbox',
                click: (menuItem) => win.webContents.send('config:set', 'showWindow', menuItem.checked)
            },
            {
                label: 'Quit',
                click: () => win.close()
            }
        ];

        this._menu = Menu.buildFromTemplate(menu);
        this._tray.setContextMenu(this._menu);
    }

    loadConfig() {
        this.setAudioDevices(require('chromecaster-lib').AudioInput.getDevices());
        config.get('showWindow').then(value => this._menu.items[8].checked = value);
        config.get('selectedQuality').then(value => this.setQuality(value));

        config.changed((key, newValue) => {
            if(key === 'selectedQuality') {
                if(newValue) {
                    this.setQuality(newValue);
                }
            } else if(key === 'selectedAudioDevice') {
                if(newValue) {
                    let index = require('chromecaster-lib').AudioInput.getDevices().indexOf(newValue);
                    this._menu.items[0].submenu.items[index].checked = true;
                    if(process.platform === 'linux') this._tray.setContextMenu(this._menu);
                }
            } else if(key === 'selectedChromecast') {
                for(let item in this._menu.items[1].submenu.items) {
                    if(item.label === newValue) {
                        item.checked = true;
                    }
                }
                if(process.platform === 'linux') this._tray.setContextMenu(this._menu);
            }
        });
    }

    get searchChromecastsItemEnabled() {
        return this._menu.items[1].submenu.items[0].enabled;
    }

    set searchChromecastsItemEnabled(v) {
        this._menu.items[1].submenu.items[0].enabled = v;
        if(v) this._menu.items[1].submenu.items[0].label = 'Searching...';
        else this._menu.items[1].submenu.items[0].label = 'Search';
        if(process.platform === 'linux') this._tray.setContextMenu(this._menu);
    }

    setAudioDevices(devices) {
        let f = (device) => { return () => config.set('selectedAudioDevice', device); };
        config.get('selectedAudioDevice').then(selectedDevice => {
            for(let device of devices) {
                this._menu.items[0].submenu.append(new MenuItem({
                    label: device,
                    type: 'radio',
                    checked: selectedDevice === device,
                    click: f(device)
                }));
            }
            this._tray.setContextMenu(this._menu);
        });
    }

    addChromecast(ca) {
        this._menu.items[1].submenu.append(new MenuItem({
            label: ca,
            type: 'radio',
            click: () => config.set('selectedChromecast', ca)
        }));
        this._tray.setContextMenu(this._menu);
    }

    _clearChromecasts() {
        let i = 0;
        for(let item of this._menu.items[1].submenu.items) {
            if(i > 1) {
                item.visible = false;
            }
            i++;
        }
        this._tray.setContextMenu(this._menu);
    }

    get startCastingVisibility() {
        return this._menu.items[4].visible;
    }

    set startCastingVisibility(v) {
        this._menu.items[4].visible = v;
        this._tray.setContextMenu(this._menu);
    }

    get stopCastingVisibility() {
        return this._menu.items[5].visible;
    }

    set stopCastingVisibility(v) {
        this._menu.items[5].visible = v;
        this._tray.setContextMenu(this._menu);
    }

    setStatusMessage(m) {
        if(m) {
            this._menu.items[6].visible = true;
            this._menu.items[6].label = `Status: ${m}`;
        } else {
            this._menu.items[6].visible = false;
        }
        this._tray.setContextMenu(this._menu);
    }

    setQuality(q) {
        switch(q) {
        case 'flac-hd': this._menu.items[2].submenu.items[0].checked = true; break;
        case 'flac': this._menu.items[2].submenu.items[1].checked = true; break;
        case '320': this._menu.items[2].submenu.items[2].checked = true; break;
        case '256': this._menu.items[2].submenu.items[3].checked = true; break;
        case '224': this._menu.items[2].submenu.items[4].checked = true; break;
        case '192': this._menu.items[2].submenu.items[5].checked = true; break;
        case '160': this._menu.items[2].submenu.items[6].checked = true; break;
        case '128': this._menu.items[2].submenu.items[7].checked = true; break;
        case '112': this._menu.items[2].submenu.items[8].checked = true; break;
        case '96': this._menu.items[2].submenu.items[9].checked = true; break;
        case 'wav-hd': this._menu.items[2].submenu.items[10].checked = true; break;
        case 'wav': this._menu.items[2].submenu.items[11].checked = true; break;
        }
        if(process.platform === 'linux') this._tray.setContextMenu(this._menu);
    }

    destroy() {
        this._tray.destroy();
        this._tray = null;
    }
}

module.exports = CATray;
