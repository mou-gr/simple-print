'use strict'
const pdf = require('./print')
const stdin = require('get-stdin')
// const argv = require('minimist')(process.argv.slice(2))


stdin()
    .then(JSON.parse)
    .then( pdf.createDocRaw )
    .then(binary => {
        binary.pipe(process.stdout)
    })
    .catch(e => {
        console.error('ERROR:')
        console.error(e)
        process.exit(-3)
    })
