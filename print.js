/*jslint node:true*/
'use strict'
const db = require('./data')
const wiz = require('./wizard.js')
const R = require('ramda')
const printers = require('./printers.js')
const Promise = require('bluebird')
const xml2js = require('xml-to-json-promise')
const moment = require('moment')
const oldFs = require('fs')

const fonts = {
    Roboto: {
        normal: 'fonts/Roboto-Regular.ttf',
        bold: 'fonts/Roboto-Medium.ttf',
        italics: 'fonts/Roboto-Italic.ttf',
        bolditalics: 'fonts/Roboto-MediumItalic.ttf'
    }
}

const PdfPrinter = require('pdfmake/src/printer')
const printer = new PdfPrinter(fonts)
const fs = Promise.promisifyAll(oldFs)

//flipping the arguments of Promise.mao so that my eys don't hurt
const pMap = R.curry((a, b) => Promise.map(b, a))

const jsonDir = async function(dirName) {
    const ret = {}
    const files = await fs.readdirAsync(dirName)
    await Promise.all(files.map(async el => {
        const s = await fs.readFileAsync(dirName + el, 'utf8')
        ret[el] = JSON.parse(R.trim(s))
    }))
    return ret
}
const printDate = date => {
    const val = moment(date)
    return val.isValid() ? val.format(' DD-MM-Y, HH:mm:ss ') : ' Σχέδιο'
}

const footer = R.curry((activity, page, pages) => ({
    columns: [
        [`Κωδικός Ενέργειας: ${activity.activityId}`, `Ημερομηνία Οριστικοποίησης: ${printDate(activity.dateFinished)}`],
        { text: `σελ. ${page} από ${pages}`, alignment: 'right' } ],
    margin: [40, 10, 40, 0]
}))

const frontPage = function (activity, generalInfo) {
    var imageObject
    if ( oldFs.existsSync(`logos/${generalInfo.logo}`) ) {
        imageObject = {image: `logos/${generalInfo.logo}`, pageBreak: 'after', fit: [800, 80], absolutePosition: {x: 40, y: 700}, style: 'logo'}
    } else {
        imageObject = {text: `logos/${generalInfo.logo}`, pageBreak: 'after', absolutePosition: {x: 40, y: 750}, style: 'logo'}
    }
    return [
        {text: `${activity.docType}`, style: 'coverHeader'}
        , {text: `Δράση: ${generalInfo.TITLOS_PROSKLHSHS}`, style: 'cover'}
        , {text: `${generalInfo.title1 || ''}`, style: 'cover'}
        , {text: `${generalInfo.title2 || ''}`, style: 'cover'}
        , {text: `${generalInfo.title3 || ''}`, style: 'cover'}
        , {text: `Κωδικός έργου: ${activity.cnCode}`, style: 'cover'}
        , imageObject
    ]
}

const print = function print(activity, extra, pool) {
    const content = Promise.all(R.map(printers.renderDataSet(activity, extra, pool), extra.wizard))
    const cover = frontPage(activity, extra.callData.tab1)

    return Promise.props ({
        styles: styles,
        defaultStyle: styles.default,
        content: content.then(doc => [cover, ...doc]),
        footer: footer(activity)
    })
}

const createDoc = async function (contractActivity, wizard, jsonLookUpFolder, type) {
    try {
        const pool = await db.getConnection()
        var activity = await db.getCallCallPhase(contractActivity, pool)

        const extra = await Promise.props({
            wizard: wiz.parse(wizard),
            jsonLookUps: jsonDir(jsonLookUpFolder),
            // lookUps: db.getLookUps(pool),
            // countries: db.getCountries(pool),
            callData: db.getCallData(activity.contractId, pool),
            dataSet: db.getXmlData(contractActivity, pool)
                .then(pMap(xml2js.xmlDataToJSON))
                .then(objArray => Object.assign({}, ...objArray))
        })

        activity.activityId = contractActivity
        activity.docType = type
        const docDefinition = await print(activity, extra, pool)
        db.closeConnection()

        const pdfDoc = await printer.createPdfKitDocument(docDefinition)
        // await pdfDoc.pipe(fs.createWriteStream(output))
        //pdfDoc.pipe(process.stdout)
        // await pdfDoc.end()
        pdfDoc.end()
        return (pdfDoc)
    } catch (e) {
        db.closeConnection()
        throw(e)
    }
}

const styles = {
    h1: {
        fontSize: 16,
        bold: true
    }
    , cover: {
        fontSize: 16,
        alignment: 'center',
        margin: [0, 0, 0, 20]
    }
    , coverHeader: {
        fontSize: 8,
        italics: true,
        margin: [0, 0, 0, 50]
    }
    , logo: {

    }
    , h2: {
        fontSize: 16,
        bold: true
    }
    , default: {
        fontSize: 9
    }
    , label: {
        fontSize: 9
        , fillColor: '#e2e5e0'
    }
    , headerRow: {
        fontSize: 8
        , fillColor: '#b7bab6'
    }
    , sumRow: {
        fontSize: 9
        , fillColor: '#efd294'
    }
    , partialSumRow: {
        fontSize: 9
        , fillColor: '#efdeba'
    }
}

module.exports = {createDoc}
