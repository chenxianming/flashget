#!/usr/bin/env node

const Downloader = require('../index'),
      path = require('path'),
      Url = require('url');

const renderProgressBar = (pro) => {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    
    let percent = ((pro.progress < .1 ? ' ' : '') + ~~(pro.progress * 100)),
        speed = pro.speed,
        current = pro.current,
        total = pro.total,
        barLen = 20,
        chunk = '';
    
    for( let i = 0; i < barLen; i++ ){
        chunk += ( i < Math.ceil(pro.progress * barLen) ? '=' : '-' );
    }
    
    process.stdout.write(`downloading(${ percent }%) ⸨${ chunk }⸩ ${ speed }kb/s [${ current }/${ total }]`);
}

const getArgv = ( argv ) => {
    
    let result = {};
    
    argv.forEach( ( arg, idx ) => {
        let up = Url.parse( arg );
        
        if( up.protocol ){
            result['url'] = arg;
        }
        
        if( arg == '-c' && argv[idx+1] ){
            result['currency'] = argv[idx+1] * 1;
        }
    } );
    

    if( !result['currency'] ){
        result['currency'] = 3;
    }

    result['currency'] = Math.max( result['currency'], 1 );
    result['currency'] = Math.min( result['currency'], 50 );
    
    result['output'] = path.basename( result.url || '' );
    
    return result;
}

const params = getArgv( process.argv );
    
if( !params.url ){
    return console.log('Invalid url.');
}

let task = new Downloader({
    url: params.url, // url
    currency: params.currency, // parallel thread
    resolve: process.cwd(),
    output: params.output // save as
});

task.on('error', (err) => console.log(err) );

task.on('end', (exportname) => console.log(`your file download here ${ exportname }`) );

/*
    progress.current
    progress.total
    progress.progress
    progress.speed
*/
task.on('progress', (progress) => renderProgressBar( progress ) );

task.begin();