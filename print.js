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

const ignore = R.always('')

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
const getJsonMetaData = async function (wizard, pool) {
    const parseElement = function (el) {
        return typeof parsers[el.type] === 'function' ? parsers[el.type](el.control) : ignore()
    }
    const parsers = {
        'SamisDataTable.ascx': R.identity
        , 'WizardCompositeControl.ascx': R.map(parseElement)
        , 'FlowLayoutCompositeControl.ascx': R.map(parseElement)
    }
    const elements = wizard.map(parseElement)
    const tables = R.pipe(
        R.flatten,
        R.uniqBy(el => el.table),
        R.filter(el => el.table),
        R.map(el => el.table)
    )(elements)

    const jsonData = tables.length > 0 ? await db.getAllTables(tables, pool) : {recordset:[]}
    return jsonData.recordset
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
        imageObject = {text: 'nologo', pageBreak: 'after', absolutePosition: {x: 40, y: 750}, style: 'logo'}
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

const print = async function (activity, extra, pool) {
    const otherwise = function (el) {
        return JSON.stringify(el, null, 2)
    }
    const parseElement = async function (el) {
        return typeof parsers[el.type] === 'function' ? await Promise.all(parsers[el.type](el.control)) : otherwise(el)
    }
    const parsers = {
        'SamisDataTable.ascx': printers.samisDataTable(activity, extra, pool)
        , 'WizardCompositeControl.ascx': R.map(parseElement)
        , 'FlowLayoutCompositeControl.ascx': R.map(parseElement)
        , 'Submission_ViewTOC.ascx': ignore
        , 'Evaluation_ViewTOC.ascx': ignore
        , 'WizardContractActivitySummary.ascx': ignore
        , 'InfoPanel.ascx': ignore
        , 'AccompanyingDocs.ascx': ignore
        , 'ContractUploadsComposite.ascx': ignore
        , 'TimePlans.ascx': ignore
    }
    const content = await Promise.all(extra.wizard.map(parseElement))
    return {
        styles: printers.styles,
        defaultStyle: printers.styles.default,
        content: [frontPage(activity, extra.callData.tab1), ...content],
        footer: footer(activity)
    }
}

const createDoc = async function (contractActivity, wizardFile, jsonLookUpFolder, output, type) {
    const pool = await db.getConnection()
    var activity = await db.getCallCallPhase(contractActivity, pool)

    activity.activityId = contractActivity
    activity.docType = type
    const extra = await Promise.props({
        wizard: wiz.parse(wizardFile),
        lookUps: db.getLookUps(pool),
        jsonLookUps: jsonDir(jsonLookUpFolder),
        countries: db.getCountries(pool)
    })

    extra.callData = await db.getCallData(activity.contractId, pool)
    extra.metaData = await getJsonMetaData(extra.wizard, pool)

    const xmlData = await db.getXmlData(contractActivity, pool)
    const dataSet = await Promise.all(xmlData.recordset.map(el => xml2js.xmlDataToJSON(el.CMH_WorkingCopyData) ))
    extra.dataSet = Object.assign({}, ...dataSet)
    extra.dataSet.ContractItemDataSet = {}
    extra.dataSet.ContractItemDataSet.CallExpense = await db.getCallExpenseDescription(activity.callId, pool)
    extra.dataSet.ContractItemDataSet.CallAction = await db.getCallAction(pool)

    extra.dataSet.ComputedDataSet = {}
    extra.dataSet.ComputedDataSet.BudgetSummary = await db.getBudgetSummary(activity.contractId, pool)
    extra.dataSet.ComputedDataSet.BudgetSummaryFromWPs = [extra.dataSet.CommonDataSet.ContractorWorkPackages]

    const docDefinition = await print(activity, extra, pool)

    db.closeConnection()

    const pdfDoc = printer.createPdfKitDocument(docDefinition)
    pdfDoc.pipe(fs.createWriteStream(output))
    pdfDoc.end()

    return ('success')
}
module.exports = {createDoc}
