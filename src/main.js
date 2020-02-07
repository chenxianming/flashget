/*
    Author: Chenxianming
    parallel download module & command line tool ( largesize file supported )
    command line running on process.cwd()
    module export on current path
    
    Example:(running on nodejs)
    
    let task = new Downloader({
        url: 'http://www.mirrorservice.org/sites/releases.ubuntu.com/18.04.3/ubuntu-18.04.3-desktop-amd64.iso',
        currency: 5, // default is 3
        output: './ubuntu-18.04.3-desktop-amd64.iso'
    });

    task.on('error', (err) => {
        console.log(err);
    });

    task.on('end', (path) => {
        console.log(`your file download here ${ path }`);
    });

    task.on('progress', (pro, speed) => {
        console.log('progress', pro);
        console.log('speed', speed + ' kb/s');
    });

    task.begin();
    
    
    Example:(running on commandline)
    option -c parallel threads, if your server is hhd drive, recommended set 2 threads.( -c 2 )
    
    get http://www.mirrorservice.org/sites/releases.ubuntu.com/18.04.3/ubuntu-18.04.3-desktop-amd64.iso
    downloading( 3%) ⸨=-------------------⸩ 6060kb/s
*/

const Async = require('async'),
    checkDiskSpace = require('check-disk-space'),
    detect = require('./detect'),
    fs = require('fs'),
    Fetch = require('./fetch'),
    path = require('path'),
    url = require('url');

const getRoot = (location) => {
    let u = url.parse(location);

    return u.protocol + '//' + u.host;
}

const splitThread = (size, count) => {
    var count = count || 3,
        avg = parseInt(size / (count)),
        parts = [],
        tavg = parseInt((size - avg) / (count - 1));

    let c = 0;

    for (let i = 0; i < (count - 1); i++) {
        parts.push(tavg * i);
    }

    parts.push(size);

    return parts;
}

const ranstr = (len) => {
    var len = len || 8,
        arr = 'qwertyuiopasdfghjklzxcvbnm1234567890'.split(''),
        i = -1,
        chunk = '';

    while (i++ < len - 1) {
        chunk += arr[~~(Math.random() * arr.length)];
    }

    return chunk;
}

const officialObject = (object) => {
    for (let key in object) {
        object[key.toLocaleLowerCase()] = object[key];
    }

    return object;
}

const rmdirp = (dir) => new Promise((resolve) => {
    fs.stat(dir, function (err, status) {
        if (err) {
            return resolve();
        }

        if (status.isDirectory()) {
            fs.readdir(dir, function (err, file) {
                let res = file.map((item) => rmdirp(path.join(dir, item)))
                Promise.all(res).then(() => {
                    fs.rmdir(dir, resolve);
                })
            })
        } else {
            fs.unlink(dir, resolve);
        }
    });
});

const checkThread = (arr) => {
    let isPass = true;

    arr.forEach((a) => ((a < 1) && (isPass = false)));

    return isPass;
}

class Event {
    constructor() {
        this.events = {};
    }

    on(name, callback) {
        if (!arguments[0]) {
            return;
        }

        this.events[name] = callback;
    }

    emit() {
        let args = [];

        for (let i = 0; i < Object.keys(arguments).length; i++) {
            args[i] = arguments[i];
        }

        const handler = args[0];

        if (!handler) {
            return;
        }

        const evts = args.filter((n, i) => (i != 0));

        (this.events[handler]) && (this.events[handler].apply(null, evts));
    }
}

class Downloader {
    constructor(props) {
        this.url = props.url;
        this.headers = props.headers || {};
        this.timeout = props.timeout || 6000;

        this.bar = null;

        this.file = props.file;
        this.size = 0;
        this.current = 0;
        this.speed = 0;
        this.lastTick = {};

        this.stime = new Date().getTime();
        this.currency = Math.min(props.currency, 30) || 3;
        this.isEnded = false;
        this.isFinished = false;

        this.ticks = [];
        this.retry = new Uint8Array(this.currency);

        this.events = new Event();
        this.taskId = ranstr(11);

        this.resolve = path.resolve();
        this.output = props.output || this.taskId;

        this.listen = this.listen.bind(this);
        this.exit = this.exit.bind(this);
        this.stop = this.stop.bind(this);
        this.clear = this.clear.bind(this);
        this.on = this.on.bind(this);
    }

    detectFile() {
        let self = this;
        return new Promise((resolve) => {
            detect({
                url: self.url,
                timeout: self.timeout
            }).then((headers) => {
                resolve(headers);
            }).catch((e) => {
                resolve(false);
            });
        });
    }

    progress() {
        if (!fs.existsSync(`${ this.resolve }/${ this.taskId }`)) {
            return this.isEnded = true;
        }

        let files = fs.readdirSync(`${ this.resolve }/${ this.taskId }`),
            ff = (files && files.length) ? (files.filter((n) => (n.includes('.pt')))) : [],
            fSzie = ff.map((f) => fs.statSync(`${ this.resolve }/${ this.taskId }/${ f }`).size),
            current = 0,
            timestamp = new Date().getTime();

        fSzie.forEach((size) => (current += size));

        this.speed = ~~((current - this.lastTick.size) / (timestamp - this.lastTick.timestamp));
        this.speed = Math.max(this.speed, 0);

        this.current = (!current) ? this.current : (current / this.size).toFixed(2);
        
        this.lastTick = {
            timestamp: timestamp,
            size: current
        };

        return {
            current: current,
            total: this.size,
            progress: this.current * 1,
            speed: this.speed
        };
    }

    checkFreespace (path) {
        return new Promise( (resolve) => checkDiskSpace( path ).then( (diskSpace) => resolve( diskSpace.free ) ) );
    }

    listen(delay) {
        var delay = delay || 1000;

        let progress = this.progress();

        if (this.isEnded) {
            return ;
        }
        
        this.events.emit('progress', progress);

        setTimeout(this.listen, delay);
    }

    clear() {
        ( fs.existsSync(this.output) && !this.isFinished ) && (fs.unlinkSync(this.output));
        (fs.existsSync(`${ this.resolve }/${ this.taskId }`)) && (rmdirp(`${ this.resolve }/${ this.taskId }`));
    }

    exit() {
        process.on('exit', this.clear);
        process.on('SIGINT', this.stop);
    }

    stop() {
        this.isEnded = true;
        this.events.emit('error', '\nnetworking error, please try again, or try to set low currency.')
        this.ticks.forEach(t => t.abort());
        setTimeout(this.clear, 500);
        setTimeout(process.exit, 1000);
    }

    begin() {
        if (fs.existsSync(this.output)) {
            return this.events.emit('error', 'file already exist.');
        }

        let sTime = (new Date()).getTime();

        let self = this;

        const fn = async () => {
            let info = await this.detectFile();

            if (!info) {
                return this.events.emit('error', 'unable to fetch infomation.');
            }

            info = officialObject(info);

            if (!info['content-length']) {
                return this.events.emit('error', 'unable to fetch file size.');
            }

            this.size = info['content-length'] * 1;
            
            if ( this.size <= this.currency ) {
                return this.events.emit('error', 'file size too small, please use single thread mode to download.');
            }

            (!fs.existsSync(`${ this.resolve }/${ this.taskId }`)) && (fs.mkdirSync(`${ this.resolve }/${ this.taskId }`));

            this.listen();
            this.exit();

            let splits = splitThread(info['content-length'] * 1, (this.currency + 1)),
                threads = [];

            if (checkThread(splits)) {
                return this.events.emit('error', 'too many connections.');
            }

            for (let i = 0; i < splits.length; i++) {
                if (!splits[i + 1]) {
                    break;
                }

                threads.push({
                    s: splits[i] + (i == 0 ? 0 : 2),
                    e: splits[i + 1] + 1,
                    i: i
                });
            }

            const errorEvt = (url, range, idx, callback) => {
                if (this.retry[idx] >= 10) {
                    return this.stop();
                }

                this.retry[idx]++;
                this.events.emit('error', `\nthread error retry again( thread-${ idx }(${ this.retry[idx] }) )`);
                singlePart(url, range, idx, callback);
            }

            const singlePart = async (url, range, idx, callback) => {
                
                if ( await this.checkFreespace( this.resolve ) < this.size * 2) {
                    this.stop();
                    return this.events.emit('error', 'Required more disk space left.');
                }

                let headers = Object.assign(this.headers, {
                        Range: ` bytes=${ range }`,
                    }),
                    filePath = `${ this.resolve }/${ this.taskId }/${ idx }.pt`;

                fs.existsSync(filePath) && fs.unlinkSync(filePath);

                let fetchSource = new Fetch({
                        url: url,
                        timeout: 8000,
                        output: filePath,
                        headers: headers
                    }),
                    size = 0,
                    isCalled = false;

                fetchSource.then((request) => {
                    self.ticks[idx] = request;
                    (!isCalled) && callback();
                }).catch((e) => {
                    if (!isCalled) {
                        isCalled = true;
                        setTimeout(() => errorEvt(url, range, idx, callback), 5000);
                    }
                });
            }

            Async.eachLimit(threads, self.currency, (thread, callback) => {
                singlePart(self.url, `${ thread.s }-${ thread.e }`, thread.i, (data) => {
                    callback();
                });
            }, () => {
                // send end, we can't detect progress when data was writing
                self.events.emit('progress', {
                    current: self.size,
                    total: self.size,
                    progress: 1,
                    speed: self.speed
                });
                
                self.isEnded = true;
                self.merge(self.taskId, function () {
                    self.events.emit('end', self.output, ((new Date()).getTime() - sTime));
                });
            });
        }

        fn();
    }
    
    merge(taskId, callback) {
        console.log('\nmerge split fragment.');

        let files = fs.readdirSync('./' + taskId).sort((a, b) => parseInt(a) - parseInt(b)),
            self = this;

        fs.existsSync(self.output) && fs.unlinkSync(self.output);
        
        let wts = fs.createWriteStream(self.output, {
            flags: 'a'
        });

        Async.eachLimit(files, 1, (f, cb) => {
            let stream = fs.createReadStream('./' + self.taskId + '/' + f);

            stream.on('data', data => wts.write(data) );

            stream.on('end', () => {
                stream = null;
                cb();
            });

            stream.on('error', function (err) {
                console.log(err);
                self.stop();
            });
            
        }, () => {
            self.isFinished = true;
            rmdirp(`${ self.resolve }/${ self.taskId }`).then(callback);
        });
    }

    on(ename, callback) {
        this.events.on(ename, callback);
        return this;
    }
}

module.exports = Downloader;