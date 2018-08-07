var http = require('http')
var express = require('express')
var bodyParser = require('body-parser')
const pdf = require('./print')

var app = express()

app.use(bodyParser.json({ limit: '50mb' }))
app.use(bodyParser.urlencoded({
    extended: true
}))
const jsonLookUpFolder = `jsonLookUp/`

app.post('/pdf', function (req, res) {
    console.time('request ' + req.body.contractActivityId)
    pdf.createDoc(req.body.contractActivityId, req.body.wizard, jsonLookUpFolder, req.body.type)
        .then( binary => {
            res.contentType('application/pdf')
            binary.pipe(res)
            console.timeEnd('request ' + req.body.contractActivityId)
        })
        .catch(error => {
            res.status(500)
            res.send(error.toString())
            console.log('activity: ' + req.body.contractActivityId, error)
            process.exit(-1)
        })
})
app.post('/raw', function (req, res) {
    console.time('raw request ')
    var binary = pdf.createDocRaw(req.body)
    res.contentType('application/pdf')
    binary.pipe(res)
    console.timeEnd('raw request ')
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
var port = process.env.PORT || 1234
server.listen(port)

console.log('http server listening on %d', port)
