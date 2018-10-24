const http = require('http');
const wav = require('wav');
const logger = require('./logger');

class RawAudioServer {
    constructor({ ai, port , sampleRate, bitDepth}) {
        this._ai = ai;
        this._port = port || 3001;

        this._server = http.createServer((req, res) => {
            if(req.method === 'GET') {
                res.setHeader('Content-Type', 'audio/wav');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Date', new Date().toUTCString());
                res.setHeader('Expires', new Date(0).toUTCString());
                res.setHeader('Connection', 'close');

                const wavStream = new wav.Writer({
                    sampleRate,
                    bitDepth,
                });
                wavStream.pipe(res);
                const onData = (data) => {
                    wavStream.write(data);
                };
                ai.on('data', onData);
                logger.debug(`Somebody once told me that the ${req.socket.remoteAddress}:${req.socket.remotePort} is gonna roll me`);

                res.on('close', () => {
                    ai.off('data', onData);
                    wavStream.end();
                    logger.debug(`Se fué ${req.socket.remoteAddress}:${req.socket.remotePort} :_(`);
                });
            } else {
                res.status(400);
                res.end("Bad request");
            }
        });

        //Try ports until we get one that don't fail
        for(let i = 0; i < 1000; i++) {
            try {
                this._server.listen(this._port + i);
                this._port = this._port + i;
                logger.info(`Raw Audio server listening at http://localhost:${this._port}`);
                break;
            } catch(e) {
                if(e.code !== 'EADDRINUSE') {
                    break;
                }
            }
        }
    }

    stop() {
        try { this._server.close(); } catch(e) {}
    }
}

module.exports = RawAudioServer;
