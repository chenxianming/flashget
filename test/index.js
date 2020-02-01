
const Downloader = require('../index');

let task = new Downloader({
    url: 'http://www.mirrorservice.org/sites/releases.ubuntu.com/18.04.3/ubuntu-18.04.3-desktop-amd64.iso', // url
    currency: 5, // parallel thread
    output: './ubuntu-18.04.3-desktop-amd64.iso' // save as
});

task.on('error', (err) => console.log(err) );

task.on('end', (exportname) => console.log(`your file download here ${ exportname }`) );

/*
    progress.current
    progress.total
    progress.progress
    progress.speed
*/
task.on('progress', (progress) => console.log( progress ) );

task.begin();