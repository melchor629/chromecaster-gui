//jshint esversion: 6
try { require('devtron').install(); } catch(e) { console.log('No devtron installed'); }
const { ipcRenderer, remote, shell } = require('electron');
const $ = require('jquery');
window.$ = window.jQuery = $;
require('bootstrap');
require('angular');
require('angular-route');
require('angular-local-storage');
require('./material-kit/assets/js/material.min.js');
require('./material-kit/assets/js/nouislider.min.js');

const audioDevices = ipcRenderer.sendSync('getAudioDevices');

window.addEventListener('blur', (e) => {
    console.log(e.type);
    $('.navbar').addClass('unfocused');
});

window.addEventListener('focus', (e) => {
    console.log(e.type);
    $('.navbar').removeClass('unfocused');
});

let app = angular.module('ChromecasterGui', ['ngRoute', 'LocalStorageModule']);

app.config(($routeProvider, localStorageServiceProvider) => {
    $routeProvider
        .when('/home', {
            templateUrl: 'views/home.html',
            controller: 'HomeController'
        })
        .when('/config', {
            templateUrl: 'views/config.html',
            controller: 'ConfigController'
        })
        .when('/about', {
            templateUrl: 'views/about.html',
            controller: 'AboutController'
        })
        .otherwise('/home');
    localStorageServiceProvider.setPrefix('chromecaster-gui');
});

app.controller('WindowController', function($scope, $rootScope, $location, localStorageService) {
    $scope.platform = process.platform;
    if(localStorageService.get('selectedAudioDevice') === null) {
        localStorageService.set('selectedAudioDevice', ''); //Default value
    }
    if(audioDevices.indexOf(localStorageService.get('selectedAudioDevice')) === -1) {
        localStorageService.remove('selectedAudioDevice'); //Get back to default value
    }
    if(localStorageService.get('selectedQuality') === null) {
        localStorageService.set('selectedQuality', 320); //Default value MP3-320Kbps
    }
    if(localStorageService.get('showWindow') === null) {
        localStorageService.set('showWindow', true); //Default value Show
    }
    if(localStorageService.get('showWindow') !== true) {
        remote.getCurrentWindow().hide(); //Hide if showWindow is not true
    }

    //Send to main process the desired configuration
    ipcRenderer.on('config:get', (event, type) => {
        let value = localStorageService.get(type);
        console.log('config:get %s => %s', type, value);
        ipcRenderer.send('config:reply:' + type, value);
    });

    //Change the configuration from main process
    ipcRenderer.on('config:set', (event, type, value) => {
        console.log('config:set %s %s', type, value);
        $rootScope.$apply(() => localStorageService.set(type, value));
        $rootScope.$apply(() => $rootScope.$emit('chromecaster:changedValue', { key: type, newvalue: value }));
    });

    //Trick for the header navbar
    $rootScope.$on('$locationChangeSuccess', () => {
        $scope.url = $location.path();
    });

    //Show/Hide window depending on the Tray menu option
    $rootScope.$on('LocalStorageModule.notification.setitem', (event, a) => {
        if(a.key === 'showWindow') {
            if(a.newvalue === 'true') {
                remote.getCurrentWindow().show();
            } else {
                remote.getCurrentWindow().hide();
            }
        }
    });

    //If something was changed, get back to the main process and get
    //reflected the changes on the Tray Menu
    $rootScope.$on('chromecaster:changedValue2', (event, a) => {
        ipcRenderer.send('config:changed', a.key, a.value);
        localStorageService.set(a.key, a.value);
    });

    $scope.closeApp = () => {
        remote.getCurrentWindow().close();
    };

    $scope.minimizeApp = () => {
        remote.getCurrentWindow().minimize();
    };

    ipcRenderer.send('windowLoaded');
});

app.controller('ConfigController', function($scope, $timeout, localStorageService, $rootScope) {
    $scope.$on('$viewContentLoaded', function() {
        $.material.init();
    });

    $scope.scipe = 'Home';
    $scope.audioDevices = audioDevices;
    ipcRenderer.on('discoverChromecasts:reply', (event, name) => {
        $scope.$apply(() => {
            if($scope.chromecasts.indexOf(name) === -1) {
                $scope.chromecasts.push(name);
                if(localStorageService.get('selectedChromecast') === name) {
                    $scope.selectedChromecast = name;
                }
            }
        });
    });
    ipcRenderer.on('discoverChromecasts:end', () => $scope.$apply(() => $scope.isSearchingCAs = false));
    ipcRenderer.on('searchChromecasts', () => $scope.$apply(() => $scope.updateCAs()));

    $scope.$watch('selectedChromecast', (newValue) => {
        localStorageService.set('selectedChromecast', newValue);
    });

    $scope.updateCAs = () => {
        $scope.chromecasts = [];
        $scope.isSearchingCAs = true;
        ipcRenderer.send('discoverChromecasts');
    };

    $scope.$on('$locationChangeStart', () => {
        ipcRenderer.removeAllListeners('discoverChromecasts:reply');
        ipcRenderer.removeAllListeners('discoverChromecasts:end');
        ipcRenderer.removeAllListeners('searchChromecasts');
    });

    $rootScope.$on('chromecaster:changedValue', (event, change) => {
        if(change.key === 'selectedAudioDevice') {
            $scope.selectedAudioDevice = change.newvalue;
        } else if(change.key === 'selectedQuality') {
            $scope.selectedQuality = change.newvalue;
        } else if(change.key === 'selectedChromecast') {
            $scope.selectedChromecast = change.newvalue;
        }
    });

    $scope.selectedAudioDeviceChanged = newValue => {
        if(newValue) $rootScope.$emit('chromecaster:changedValue2', { key: 'selectedAudioDevice', value: newValue });
        else $scope.selectedAudioDevice = localStorageService.get('selectedAudioDevice') || '';
    };
    $scope.selectedQualityChanged = newValue => {
        if(newValue) $rootScope.$emit('chromecaster:changedValue2', { key: 'selectedQuality', value: newValue });
        else $scope.selectedQuality = localStorageService.get('selectedQuality') || 320;
    };
    $scope.selectedChromecastChanged = newValue => {
        if(newValue) $rootScope.$emit('chromecaster:changedValue2', { key: 'selectedChromecast', value: newValue });
        else $scope.selectedChromecast = '';
    };
    $scope.updateCAs();
});

app.controller('HomeController', function($scope, $timeout, $animate, localStorageService, $rootScope) {
    $scope.$on('$viewContentLoaded', function() {
        $.material.init();
        $('#slideVolume').noUiSlider({
            start: 0,
            range: { min: 0, max: 100 },
            connect: 'lower',
            step: 5
        }).on('change', (event, value) => {
            if($scope.castState === 'connected') {
                ipcRenderer.send('volume:set', value / 100);
            }
        });
        $animate.enabled($('#muteButtons > button')[0], false);
        $animate.enabled($('#muteButtons > button')[1], false);
        $animate.enabled($('center > button')[0], false);
        $animate.enabled($('center > button')[1], false);
    });

    $scope.$on('$locationChangeStart', (event) => {
        if($scope.castState === 'searching' || $scope.castState === 'connecting') {
            //TODO Mostrar mensaje de que no se puede ir
            event.preventDefault();
        } else {
            ipcRenderer.removeAllListeners('startCasting');
            ipcRenderer.removeAllListeners('searchChromecasts');
        }
    });

    let showError = (title, error, link) => {
        let n = new Notification(title, { body: error, silent: true });
        n.onclick = () => {
            n.close();
            if(link) {
                window.location.hash = link;
            }
        };
    };

    $scope.castState = ipcRenderer.sendSync('isConnected') ? 'connected' : 'ready';
    $scope.muted = false;
    $scope.castName = localStorageService.get('selectedChromecast');
    $scope.audioDevice = localStorageService.get('selectedAudioDevice');
    $scope.startCasting = () => {
        if(!localStorageService.get('selectedChromecast')) {
            return showError('No Chromecast have been selected', 'Go to Configuration to select one', '#/config');
        } else if(!localStorageService.get('selectedAudioDevice')) {
            return showError('No Audio Device selected to capture', 'Select one on Configuration', '#/config');
        } else if(!localStorageService.get('selectedQuality')) {
            return showError('No quality selected', 'Select one on Configuration', '#/config');
        }

        $scope.castName = localStorageService.get('selectedChromecast');
        $scope.audioDevice = localStorageService.get('selectedAudioDevice');
        ipcRenderer.send('connectChromecast', localStorageService.get('selectedChromecast'), localStorageService.get('selectedAudioDevice'), localStorageService.get('selectedQuality'));
        listenConnection();
    };

    function listenConnection() {
        $scope.castState = 'connecting';
        ipcRenderer.on('connectChromecast:ok', (event, status) => {
            $scope.$apply(() => $scope.castState = 'connected');
            $scope.$apply(() => $scope.connexionStatus = status.playerState);
            listenConnected();
        });
        ipcRenderer.on('connectChromecast:error', (event, error) => {
            ipcRenderer.removeAllListeners('chromecast:status');
            ipcRenderer.removeAllListeners('chromecast:error');
            console.log(error);
            if(error === 'First search for a Chromecast') {
                $scope.$apply(() => $scope.castState = 'searching');
                ipcRenderer.send('discoverChromecasts');
                ipcRenderer.on('discoverChromecasts:reply', (event, name) => {
                    if(name === $scope.castName) {
                        $scope.$apply(() => $scope.startCasting());
                    }
                });
                ipcRenderer.on('discoverChromecasts:end', () => {
                    if($scope.castState === 'searching') {
                        $scope.$apply(() => {
                            $scope.castState = 'ready';
                            showError(`Could not find ${$scope.castName}...`, 'The chromecast is not available anymore. Try again...');
                        });
                    }
                });
            } else if('object' === typeof error) {
                if(error.num === 1) {
                    $scope.$apply(() => showError(`Could not capture audio: ${error.reason}`,
                                                  `Device: '${error.config.deviceName}'\n`+
                                                  `Sample Rate: ${error.config.samplerate || 44100}\n`+
                                                  `Bit Depth: ${error.config.bps || 16}`));
                    $scope.$apply(() => $scope.castState = 'ready');
                } else if(error.num === 2) {
                    $scope.$apply(() => showError(error.what,
                                                  error.reason));
                    $scope.$apply(() => $scope.castState = 'ready');
                }
            } else {
                $scope.$apply(() => showError(`Could not connect to the Chromecast.\n${error}`));
                $scope.$apply(() => $scope.castState = 'ready');
            }
        });
    }

    function listenConnected() {
        ipcRenderer.send('volume:get');
        ipcRenderer.send('muted:get');
        ipcRenderer.on('volume:reply', (event, volume) => {
            $('#slideVolume').val(volume * 100);
        });
        ipcRenderer.on('muted:reply', (event, muted) => {
            $scope.$apply(() => $scope.muted = muted);
        });
        ipcRenderer.on('chromecast:status', (event, status) => $scope.$apply(() => $scope.connexionStatus = status.playerState));
        ipcRenderer.on('chromecast:error', (event, error) => {
            console.log(error);
            $scope.$apply(() => showError(`An error has occurred while casting. Casting is going to be stopped...<br>${error}`));
            ipcRenderer.send('disconnectChromecast');
        });
        ipcRenderer.on('disconnectChromecast:reply', () => {
            $scope.$apply(() => $scope.castState = 'ready');
            ipcRenderer.removeAllListeners('connectChromecast:ok');
            ipcRenderer.removeAllListeners('connectChromecast:error');
            ipcRenderer.removeAllListeners('volume:reply');
            ipcRenderer.removeAllListeners('muted:reply');
            ipcRenderer.removeAllListeners('disconnectChromecast:reply');
            ipcRenderer.removeAllListeners('chromecast:status');
            ipcRenderer.removeAllListeners('chromecast:error');
        });
    }

    $scope.mute = (mute) => {
        if($scope.castState === 'connected') {
            ipcRenderer.send('muted:set', mute);
        }
    };

    $scope.stopCasting = () => {
        ipcRenderer.send('disconnectChromecast');
    };

    if(ipcRenderer.sendSync('isConnected')) {
        $scope.connexionStatus = 'BUFFERING';
        $scope.castState = 'connected';
        listenConnected();
    }

    ipcRenderer.on('startCasting', () => {console.log('startCasting');$scope.$apply(listenConnection);});
    ipcRenderer.on('searchChromecasts', () => {console.log('searchChromecasts');ipcRenderer.send('discoverChromecasts');});

    $rootScope.$on('chromecaster:changedValue', (event, change) => {
        if(change.key === 'selectedAudioDevice') {
            $scope.audioDevice = change.newvalue;
        } else if(change.key === 'selectedChromecast') {
            $scope.castName = change.newvalue;
        }
    });
});

app.controller('AboutController', function($scope) {
    $scope.goto = (url) => {
        shell.openExternal(url);
    };
});
