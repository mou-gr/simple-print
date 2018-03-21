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
    console.log(JSON.stringify(req.body))
    pdf.createDoc(req.body.contractActivityId, req.body.wizard, jsonLookUpFolder, req.body.type)
        .then( binary => {
            res.contentType('application/pdf')
            binary.pipe(res)
        })
        .catch(error => {
            console.log(error)
            res.send('error:' + error)
        })
    , function(error) {
        res.send('ERROR:' + error)
    }
})

var server = http.createServer(app)
var port = process.env.PORT || 1234
server.listen(port)

console.log('http server listening on %d', port)
