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
        console.log('%s : %fms', req.path, elapsedTimeInMs, `, serverTime: ${req.body.time}ms , env: ${app.settings.env}, activity: ${req.ActivityID}`)
    })
    next()
}

var app = express()
app.use(logResponseTime)

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

app.use(bodyParser.json({ limit: '50mb' }))
app.use(bodyParser.urlencoded({
    extended: true,
    limit: '50mb'
}))

app.post('/pdf', function (req, res) {
    req.body.jsonLookUp = jsonLookUp
    var binary = pdf.createDoc(req.body)
    res.contentType('application/pdf')
    binary.pipe(res)
})
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
var port = process.env.PORT || 2000
server.listen(port)

console.log('http server listening on %d', port)
