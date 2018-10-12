const fs = require('fs');
const { app } = require('electron');
const winston = require('winston');
const { combine, timestamp, label, printf } = winston.format;

const myFormat = printf(info => {
    return `${info.timestamp} [${info.level}] ${info.message}`;
});

let logger;
if(!app.isPackaged) {
    logger = winston.createLogger({
        level: 'debug',
        format: winston.format.simple(),
        transports: [
            new winston.transports.Console()
        ]
    });
} else {
    let path = process.cwd() + '/logs';
    if(process.platform === 'darwin') {
        path = `${process.env['HOME']}/Library/Logs/Chromecaster`;
    } else if(process.platform === 'linux') {
        path = `${process.env['HOME']}/.local/share/chromecaster`;
    }

    if(!fs.existsSync(path)) {
        fs.mkdirSync(path);
    }

    logger = winston.createLogger({
        level: 'debug',
        format: combine(
            timestamp(),
            myFormat
        ),
        transports: [
            new winston.transports.File({ filename: `${path}/chromecaster.log` }),
            new winston.transports.Console()
        ]
    });

    process.stdout.pipe(fs.createWriteStream(`${path}/chromecaster.out.log`, { flags: 'a' }));
    process.stderr.pipe(fs.createWriteStream(`${path}/chromecaster.err.log`, { flags: 'a' }));

    console.warn(` > Logs can be found in ${path} <`);
}

module.exports = logger;
