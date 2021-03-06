var http = require('http')
var express = require('express')
var bodyParser = require('body-parser')
const pdf = require('./print')
const fs = require('fs')
const R = require('ramda')

const logResponseTime = function logResponseTime(req, res, next) {
    const startHrTime = process.hrtime()
    res.on('finish', () => {
        const elapsedHrTime = process.hrtime(startHrTime)
        const elapsedTimeInMs = elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6
        console.log('%s : %fms', req.path, elapsedTimeInMs, `, serverTime: ${req.body.time}ms, activity: ${req.body.activityId}`)
    })
    next()
}

var app = express()

const jsonLookUpFolder = './jsonLookUp/'

const jsonDir = function (dirName) {
    const lookUps = {}
    const files = fs.readdirSync(dirName)

    files.map(el => {
        const s = fs.readFileSync(dirName + el, 'utf8')
        lookUps[el] = JSON.parse(R.trim(s))
    })
    return lookUps
}

const jsonLookUp = jsonDir(jsonLookUpFolder)

app.use(logResponseTime)
app.use(bodyParser.json({ limit: '500mb' }))

/** basic route that handles print requests*/
app.post('/pdf', function (req, res) {

    req.body.jsonLookUp = jsonLookUp //read files for jsonlkp
    var binary = pdf.createDoc(req.body)
    res.contentType('application/pdf')
    binary.pipe(res)
})

/** shutdown server - not required anymore */
app.post('/close', function () {
    console.log('stop accepting connections')
    server.close(function () {
        console.log('shuting down server gracefully')
        process.exit(1)
    })
    setTimeout(function () {
        console.log('shuting down server')
        process.exit(2)
    }, 4000)
})

var server = http.createServer(app)

var port = process.env.PORT || 2001
server.listen(port)

console.log(`env: ${app.settings.env}, http server listening on port ${port}`)
