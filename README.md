# FlashGet
#### Parallel download module & command line tool ( largesize file supported )
FlashGet use http/https module to redirect source url and split file fragment when parallel threads download.
fs.writeStream was very smooth running on SolidStateDrive, but if on your iot device, u really need to set low currency.

[![NPM version](https://img.shields.io/npm/v/flashget.svg)](https://www.npmjs.com/package/flashget)
[![License](https://img.shields.io/badge/License-MIT-brightgreen.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/dt/flashget.svg)](https://www.npmjs.com/package/flashget)
[![node](https://img.shields.io/node/v/flashget.svg)](https://nodejs.org/en/download/)


# How to use?

## Command line tool

``` 
npm i flashget -g
``` 

flashget url -c currency threads
option -c parallel threads, if your server is hhd, recommended set 2 threads.

``` 
flashget -c 20 http://www.mirrorservice.org/sites/releases.ubuntu.com/18.04.3/ubuntu-18.04.3-desktop-amd64.iso
``` 

Or u can ignored c param, default is 3
``` 
flashget http://www.mirrorservice.org/sites/releases.ubuntu.com/18.04.3/ubuntu-18.04.3-desktop-amd64.iso
``` 

downloading( 3%) ⸨=-------------------⸩ 6060kb/s [1000/2000]


## Node module
Import flashget to your project, very easy.
```
npm i flashget
```

```
const Downloader = require('flashget');

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
```

# Test

``` 
npm run test
``` 


