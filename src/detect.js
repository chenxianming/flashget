/*
    Simple http/https detector(get response headers)
    Author:chenxianming
    
    Example:1 (async/await)
    
    (async () => {
        try{
            let info = await detect({
                url: 'https://www.78pan.com/api/stats/hls/2018/05/22/aDeuR3Zp/out005.ts',
                timeout:20000
            });
            console.log(info);
        }catch(e){
            console.log(e);
        }
    })();
    
    
    Example:2 (chain called)
    
    detect({
        url: 'https://www.78pan.com/api/stats/hls/2018/05/22/aDeuR3Zp/out005.ts',
        timeout:20000
    }).then( (info) => {
        console.log( info );
    } ).catch( e => console.log );
*/

const http = require('http'),
    https = require('https'),
    Url = require('url');

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

const detect = (options) => new Promise((resolve, reject) => {
    let maxRedirects = options.options || 10,
        timeout = options.timeout || 6000,
        headers = options.headers || {},
        url = options.url || null,
        timmer = null,
        flowRedirect = 0,
        isFetch = false,
        request = null;

    const rq = (url, callback) => {
        let opt = Url.parse(url);

        (opt.protocol == 'https:') && (opt.agent = new protocols[opt.protocol].Agent({
            rejectUnauthorized: false
        }));
        
        opt.headers = {
            Referer: opt.protocol + '//' + opt.hostname,
            'User-Agent': mobileUa
        };

        clearTimeout(timmer);
        timmer = setTimeout(() => {
            if (!isFetch) {
                request.abort();
                callback('connection timeout');
            };
        }, timeout);
        
        const response = (response) => {
            let headers = officialObject(response.headers),
                redirect = headers['location'];
            
            if (response.statusCode >= 300 && response.statusCode < 400 && redirect) {
                if (flowRedirect <= maxRedirects) {
                    flowRedirect++;
                    request.abort();
                    return rq(redirect, callback);
                } else {
                    return callback('networking error');
                }
            }
            
            request.abort();
            isFetch = true;
            callback( response.headers );
        }

        request = protocols[opt.protocol].request(opt, response);
        request.end();

        request.on('error', (err) => callback( err.toString() ));
    }
    
    rq( url, ( result ) => {
        ( typeof result == 'object' ) ? resolve( result ) : reject( result );
    } );
});

module.exports = detect;