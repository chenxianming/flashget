/*
    High performance get source
    
    Author:chenxianming
    Example:
    
    // options: maxRedirects:number timeout:number(ms) headers:object output:string(fetch file path) url:string
    
    const fetchUrl = 'https://github.com/chenxianming/sqapi/archive/master.zip';
    
    let fetchSource = new Fetch({
        url:fetchUrl,
        timeout: 6000,
        output: './temp',
        onProgress(len, cur, tol) {
            console.log( ~~( cur / tol * 100 ) + '%' );
            console.log( len, cur, tol );
        }
    });
    
    // By chain called
    fetchSource.then( ( request ) => {
        console.log('The file save as ./temp');
    } ).catch( e => console.log );
    
    
    // By async/await
    ( async() => {
        try{
            await fetchSource;
            console.log('The file save as ./temp');
        }catch(e){
            console.log(e);
        }
    } )();
    
*/

const fs = require('fs'),
    http = require('http'),
    https = require('https'),
    url = require('url');

const officialObject = (object) => {
    for (let key in object) {
        object[key.toLocaleLowerCase()] = object[key];
    }

    return object;
}

const protocols = {
    'http:': http,
    'https:': https
};

const mobileUa = 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1';

class Fetch {
    constructor(props) {
        this.maxRedirects = props.maxRedirects || 10;
        this.timeout = props.timeout || 15 * 1000;
        this.headers = props.headers || {};
        this.output = props.output || '';
        this.location = props.url || '';
        this.url = url.parse(this.location);
        
        this.request = null;
        this.timmer = null;
        this.isFetch = false;
        this.flowRedirect = 0;
        this.total = 0;

        this.progress = props.onProgress || function () {};

        return new Promise((resolve, reject) => this.fetch(resolve, reject));
    }

    rq(location, callback) {
        let headers = {
                Referer: this.url.protocol + '//' + this.url.hostname,
                'User-Agent': mobileUa
            },
            self = this,
            options = url.parse(location);
        
        this.headers = Object.assign(this.headers, headers);
        options.headers = this.headers;
        
        // reject check certificate
        (this.url.protocol == 'https:') && (options.agent = new protocols[this.url.protocol].Agent({
            rejectUnauthorized: false
        }));
        
        // abort each request when over time
        clearTimeout(this.timmer);
        this.timmer = setTimeout(() => {
            if (!self.isFetch) {
                self.request.abort();
                callback(null);
            };
        }, this.timeout);
        
        const response = (response) => {
            let headers = officialObject(response.headers),
                redirect = headers['location'];
            
            // flowrredirect
            if (response.statusCode >= 300 && response.statusCode < 400 && redirect) {
                if (self.flowRedirect <= self.maxRedirects) {
                    self.flowRedirect++;
                    self.request.abort();
                    return self.rq(redirect, callback);
                } else {
                    return callback(null);
                }
            }
            
            self.total = headers['content-length'] * 1;
            fs.existsSync(self.output) && fs.unlinkSync(self.output);
            
            // create / append source
            let wsm = fs.createWriteStream(self.output);
            
            response.on('data', (data) => {
                wsm.write(data);

                if( fs.statSync(self.output).size > self.total ){ // some server limit connection, breaktransfer and retry
                        self.request.abort();
                        wsm.end();

                        fs.existsSync(self.output) && fs.unlink(self.output, () => {
                            console.log('writestream sync faild, try again.');
                            setTimeout( () => self.rq(location, callback), 5000 );
                        });

                        return ;
                 }

                // created files was slow when parallel mode
                setTimeout( () => {
                    fs.existsSync(self.output) && ( self.progress(data.length, fs.statSync(self.output).size, self.total || 'Unkown size') );
                }, 50 );
            });

            
            response.on('end', () => {
                // That's important delay, continue transfering must waiting for disk write completed
                setTimeout( () => {
                    // veryfy file size
                    if( !self.total ){
                        return callback(self.request);
                    }
                    
                    if( fs.statSync(self.output).size != self.total ){
                        self.request.abort();
                        wsm.end();
                        
                        fs.existsSync(self.output) && fs.unlink(self.output, () => {
                            console.log('writestream sync faild, try again.');
                            setTimeout( () => self.rq(location, callback), 5000 );
                        });
                        
                        return ;
                    }
                    
                    callback(self.request);
                }, 50 );
            });
            
            self.isFetch = true;
            clearTimeout(self.timmer);
        }
        
        // sending request
        this.request = protocols[this.url.protocol].request(options, response);
        this.request.end();
        
        this.request.on('error', (err) => setTimeout( () => {
            // self.rq(location, callback)
            fs.existsSync(self.output) && fs.unlink(self.output, () => {
                console.log('writestream sync faild, try again.');
                setTimeout( () => self.rq(location, callback), 5000 );
            });
        }, 5000 ));
    }
    
    fetch(resolve, reject) {
        if (!this.url.protocol) {
            return reject('invalid url');
        }

        let self = this;

        this.rq(this.location, (request) => {
            request ? resolve(request) : reject('connection timeout or networking error');
        });
    }
}

module.exports = Fetch;
