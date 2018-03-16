'use strict'
const pdf = require('./print')
const stdin = require('get-stdin')
// const path = require('path')

const argv = require('minimist')(process.argv.slice(2))

const contractActivityId = argv.a //|| 773156;
if (!contractActivityId) {
    console.log('ERROR: Specify contractActivityId with the -a option')
    process.exit(-1)
}

const jsonLookUpFolder = `jsonLookUp/`

const output = argv.o || 'public/print.pdf'

const type = argv.t

stdin()
    .then( wizard => pdf.createDoc(contractActivityId, wizard, jsonLookUpFolder, output, type) )
    .then(r => {
        console.log(JSON.stringify(r))
        // process.exit(0)
    })
    .catch(e => {
        console.log('ERROR:')
        console.log(e)
        process.exit(-3)
    })
