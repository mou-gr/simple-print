'use strict'
const R = require('ramda')
const moment = require('moment')
const db = require('./data')
const xml2js = require('xml-to-json-promise')
const Promise = require('bluebird')
const jsonExport = require('./jsonExport')

const checkbox = function (el, dataSet) {
    if (dataSet && dataSet[el.name] && dataSet[el.name][0] == 'true') {
        return 'NAI'
    } else {
        return 'ΟΧΙ'
    }
}
const date = function (el, dataSet) {
    const val = (dataSet[el.name] && dataSet[el.name][0]) || ''
    const date = moment(val)
    return date.isValid() ? date.format('DD - MM - Y') : val
}
const number = function (el, dataSet) {
    if (dataSet && dataSet[el.name] && typeof dataSet[el.name][0] !== 'object') {
        return `${currency('' + dataSet[el.name][0])} `
    } else {
        return ' '
    }
}
const jsonlkp = R.curry(function (lookUps, column, row) {
    const val = (row[column.name] && row[column.name][0]) || ''
    const table = lookUps[column.lookupaction].data
        .filter(i => i[0] == val)
    var ret = ' '
    if (table.length >= 1) {
        ret = table[0][1]
    }
    return ret
})

const findInItems = (items, val) => R.path([0, 'lab'])(items.filter(i => i.val == val))
const findInCountries = (countries, column, val) => R.path([0, column.labcol])(countries.filter(i => i[column.valcol] == val))
const findInSelf = (dataSet, column, val) => {
    if (column.njoin) {
        const refArray = R.path(column.njoin.coords[0].jointable.split('.'), dataSet)
        const refValue = refArray.filter(i => i[column.njoin.coords[0].joincols[0]][0] == dataSet[column.njoin.coords[0].sourcecols[0]][0])[0][column.valcol][0]
        val = refValue
    }
    const table = R.path(column.lkptable.split('.'), dataSet)
    if (table) {
        const element = table.filter(i => i[column.valcol] == val)
        const ret = R.path([0, column.labcol.split(';').reverse()[0], 0])(element)
        return ret
    }
}

const select = R.curry(function (extra, el, dataSet) {
    var val = (dataSet[el.name] && dataSet[el.name][0]) || ''
    var ret = undefined

    Array.isArray(el.items) && (ret = findInItems(el.items, val))
    ret === undefined && el.lookup == 'dblkp' && (ret = findInCountries(extra.countries, el, val))
    ret === undefined && el.lookup == 'slflkp' && (ret = findInSelf(extra.dataSet, el, val))

    // // } else if (el.lookup == 'dblkpgrp') {
    // //     ret = R.path([0, 'LU_LookUpDescription'])(extra.lookUps.filter(item => item[el.valcol] == val))
    return R.defaultTo(val)(ret)
})

const getData = function (row, column, extra) {
    const otherwise = (row, column) =>  R.cond([
        [val => typeof val == 'object', R.always(' ')],
        [R.isNil,                       R.always(' ')],
        [R.isEmpty,                     R.always(' ')],
        [R.T,                           R.identity]
    ])(R.path([column.name, 0], row))

    const readers = {
        select: select(extra)
        , radio: select(extra)
        , checkbox: checkbox
        , jsonlkp: jsonlkp(extra.jsonLookUps)
        , date2: date
        , date: date
        , number: number
        , posamount: number
        , amount: number
    }

    if (typeof readers[column.etype] === 'function') {
        return readers[column.etype](column, row)
    } else {
        return otherwise(row, column)
    }
}

const strip = str => str.replace(/(&nbsp;|<ol>|<li>|<\/ol>|<\/li>)/g, ' ')

const currency = s => typeof s === 'string' ? s.replace('.', ',') : s.toFixed(2).replace('.', ',')

const withStyle = (s, t) => ({style: s, text: t})

const renderHeader = function renderHeader (column) {
    if (column.header.length === 1) {
        return [{style:'headerRow', text: strip(column.header[0].lab || ' '), colSpan: 2, alignment: 'center'}, ' ']
    }

    return [
        withStyle('headerRow', R.path(['header', '0', 'lab'], column) || ' '),
        {
            margin: [-5, -3],
            table: {
                widths: R.map(() => '*', R.tail(column.header)),
                body: [ R.map(a => withStyle('headerRow', a.lab))(R.tail(column.header)) ]
            }
        }
    ]
}

const mergeWithPrev = function (acc, value) {
    if (value[2] != '1') { return R.append(R.slice(0, 2, value), acc) } // no merge needed, just remove the inline flag
    const lastRow = R.last(acc)
    if (typeof(lastRow[1]) === 'string') { //merge with normal cell (not already merged)
        lastRow[1] = {
            margin: [-5, -3, -5, -4],
            table: {
                widths: ['*', '*'],
                body: [[ lastRow[1], value[1] ]]
            }
        }
    } else { // merge with already merged cell
        lastRow[1].table.body[0].push(value[1])
        lastRow[1].table.widths.push('*')
    }
    return acc
}

const renderLabel = label => withStyle('label', label && label != '' ? strip(label) : ' ')

const getDataTable = async function (metaData, data, activityId, pool) {
    var dataSet
    if (metaData.datafilter) {
        const xml = await db.getFilteredDataSet(activityId, metaData, pool)
        const pXml = xml.recordset.length > 0 && await Promise.all(xml.recordset.map(i => xml2js.xmlDataToJSON(i.value) ))
        pXml && (dataSet = pXml.map(el => el[Object.keys(el)[0]]))
    }  else {
        dataSet = R.path(metaData.name.split('.'), data)
    }
    return dataSet
}
const renderCell = R.curry(function renderCell(extra, row, column){
    const value = getData(row, column, extra)
    var cell = []
    column.header && column.header != '' && cell.push(renderHeader(column))
    cell.push([renderLabel(column.label), value, column.inline]) //mark at 3rd position if it needs to be merged with the previous
    return cell
})

const renderRow = R.curry(function renderRow (extra, columns, row) {
    const rows = R.unnest(R.map(renderCell(extra, row), columns))
    const body = R.reduce(mergeWithPrev, [], rows) // merge inline fields
    return [{
        table: {
            widths: [200, 300],
            body: body
        }
    }
        , ' '
    ]
})

const renderSection = R.curry(async function renderSection (activity, extra, pool, metaData) {

    if (R.filter(a => a.view !== '' || a.edit !== '', metaData.columns).length <= 0) { return '' }

    const dataTable = await getDataTable(metaData, extra.dataSet, activity.activityId, pool)

    const title = {style: 'h1', text: metaData.title}
    const body = !dataTable ? ['-----------------'] //empty dataSet
        : R.map(renderRow(extra, metaData.columns), dataTable)

    return [title, ...body]
})

const samisDataTable = R.curry(async function (activity, extra, pool, section) {
    var metaData = await jsonExport.getSectionDescription(activity, extra.callData, section, pool)

    const columns = R.pipe(
        R.filter(column => column.view !== '' || column.edit !== ''),
        R.filter(column => column.virtual != 1),
        R.sortBy(column => 1 * column.vord || 0)
    )(metaData.columns)
    metaData.columns = columns

    return renderSection(activity, extra, pool, metaData)
})

const printers = {
    SamisDataTable: samisDataTable
}

//gets a dataSet description from wizard section, calls the corresponding function from the printers array
const renderDataSet = R.curry(function (activity, extra, pool, dataSet) {
    return printers[dataSet.type](activity, extra, pool, dataSet)
})


module.exports = {renderDataSet}
