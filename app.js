const express = require('express')
const bodyParser = require('body-parser')
const pdf = require('./print')
const moment = require('moment')
const app = express()

const jsonLookUpFolder = `/inetpub/wwwroot/AuditorCIS_13/SAMIS/Common/Resources/json/`

//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({ extended: true }))

app.get('/', function (req, res) {
    res.redirect('/index.html')
})
app.post('/', function (req, res){
    const activity = req.body.activity
    const wizard = req.body.wizard
    //generate filename
    const filename = `${wizard.split(/[\\\/.]/).reverse()[1]}-${activity}-${moment().format('YYYYMMDDHHmmss')}.pdf`
    //create document
    pdf.createDoc(activity, wizard, jsonLookUpFolder, 'public/' + filename).then(r => {
        if (r === 'success') {
            res.send({status:1, filename: filename})
        } else {
            res.send({status:-1, error: JSON.stringify(r)})
            process.exit()
        }
    }).catch(e => {
        res.send({status:-2, error: JSON.stringify(e)})
        process.exit(-3)
    })

})
app.use(express.static('public'))
app.listen(3000, function () {
    console.log('Example app listening on port 3000!')
})
