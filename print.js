/*jslint node:true*/
'use strict'
const R = require('ramda')
const jsonExport = require('./jsonExport')
const oldFs = require('fs')
const printers = require('./printers')

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

const printDate = date => {
    // const val = moment.utc(date)
    // return val.isValid() ? val.format(' DD-MM-Y, HH:mm:ss ') : ' Σχέδιο'
    return date
}

const footer = R.curry(function (extra, page, pages) {
    return page === 1 ? {
        text: 'Με τη συγχρηματοδότηση της Ελλάδας και της Ευρωπαϊκής Ένωσης',
        alignment: 'center'
    } : {
        columns: [
            [`Κωδικός πράξης: ${extra.cnCode}`, `Ημερομηνία Οριστικοποίησης: ${printDate(extra.dateFinished)}`],
            { text: `σελ. ${page} από ${pages}`, alignment: 'right' } ],
        margin: [40, 10, 40, 0]
    }
})
const signature = function () {
    return [
        {text: 'Ημερομηνία:', style: 'signature'}
        , {text: 'Υπογραφή', style: 'signature'}
        , ' '
        , ' '
        , ' '
        , ' '
        , {text: 'Σφραγίδα', style: 'signature'}
    ]
}
const frontPage = function (extra) {
    const generalInfo = extra.callData.tab1
    var imageObject, headerObject
    if ( oldFs.existsSync(`logos/${generalInfo.logo}`) ) {
        imageObject = {image: `logos/${generalInfo.logo}`, pageBreak: 'after', fit: [550, 80], absolutePosition: {x: 40, y: 700}, style: 'logo'}
    } else {
        imageObject = {text: `logos/${generalInfo.logo}`, pageBreak: 'after', absolutePosition: {x: 40, y: 750}, style: 'logo'}
    }
    if ( oldFs.existsSync(`logos/${generalInfo.headerLogo}`) ) {
        headerObject = {image: `logos/${generalInfo.headerLogo}`, fit: [550, 80], alignment: 'center', style: 'logo'}
    } else {
        headerObject = {text: `logos/${generalInfo.headerLogo}`, style: 'logo'}
    }

    const contractor = extra.contractors || []

    return [
        // {text: `${activity.docType}`, style: 'coverHeader'}
        headerObject
        , {text: `${generalInfo.title1 || ''}`, style: 'cover'}
        , {text: `${generalInfo.title2 || ''}`, style: 'cover'}
        , {text: `${generalInfo.title3 || ''}`, style: 'cover'}
        , {text: `${generalInfo.TITLOS_PROSKLHSHS}`, style: 'cover'}
        , {text: `${extra.docType}`, style: 'coverBold'}
        , {text: `Κωδικός πράξης: ${extra.cnCode}`, style: 'cover'}
        , {text: `Δικαιούχος: ${contractor.join(', ')}`, style: 'cover'}
        , imageObject
    ]
}
const printTab = function printTab(extra, tab) {
    const metadata = jsonExport.specialMerge(extra.callData, JSON.parse(tab.metadata || '{}'))
    const dataString = tab.data || '[]'
    const data = JSON.parse(dataString.replace(/(\r\n|\n|\r|\t)/gm,' '))
    
    return printers.renderDataSet(metadata, data, extra, tab.type)
}
const print = function print(tabArray, extra) {
    var counter = 0
    const content = R.pipe(
        R.map(a => printTab(extra, a)),
        JSON.stringify,
        str => str.replace(/{{rank}}/g, () => {
            counter += 1
            return counter
        }),
        JSON.parse
    )(tabArray)
    const cover = frontPage(extra)
    const last = signature()

    return {
        styles: styles,
        defaultStyle: styles.default,
        content: [cover, ...content, ...last],
        footer: footer(extra)
    }
} 
const createDoc = function (request) {
    const callData = JSON.parse(request.invitationJson)
    const compiled = JSON.parse(callData.compiled || '{}')
    callData.compiled = compiled
    //if following params exisit in the request overwrite relevant callData fields
    ; ['logo', 'headerLogo', 'TITLOS_PROSKLHSHS', 'title1', 'title2', 'title3'].map(a =>
        request[a] && (callData.tab1[a] = request[a])
    )
    request.logo && (callData.tab1.logo = request.logo)
    const tabArray = JSON.parse(request.tabArray)
    var extra = {
        docType: request.type,
        lookUps: request.jsonLookUp,
        cnCode: request.cnCode,
        dateFinished: request.dateFinished,
        callData: callData
    }

    const definition = print(tabArray, extra)

    var pdfDoc = printer.createPdfKitDocument(definition)
    pdfDoc.end()
    return pdfDoc
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
    , coverBold: {
        fontSize: 16,
        alignment: 'center',
        bold: true,
        margin: [0, 0, 0, 20]
    }
    , coverHeader: {
        fontSize: 8,
        italics: true,
        margin: [0, 0, 0, 0]
    }
    , logo: {
        margin: [0, 0, 0, 30]
    }
    , signature: {
        alignment: 'center',
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
