'use strict'
const R = require('ramda')
const currencyFormatter = require('currency-formatter')

const string2num = str => 1 * str.replace(/\./g, '').replace(/,/g, '.')
const checkbox = function (el, dataSet) {
    if (dataSet && dataSet[el.name] == 'true') {
        return 'NAI'
    } else {
        return 'ΟΧΙ'
    }
}
const date = function (el, dataSet) {
    // const val = dataSet[el.name] || ''
    // const date = moment(val)
    // return date.isValid() ? date.format('DD - MM - Y') : val

    return dataSet[el.name] || ''
}
const number = function (el, dataSet) {
    if (dataSet && typeof dataSet[el.name] !== 'object') {
        return `${el.name.startsWith('Comments') || el.name.startsWith('CS_RelativeStudiesInfo') ? dataSet[el.name] : currency(string2num(dataSet[el.name]))} `
    } else {
        return ' '
    }
}
const jsonlkp = R.curry(function (lookUps, column, row) {
    const val = row[column.name] || ''
    const table = lookUps[column.lookupaction]
        .data
        .filter(i => i[0] == val)
    var ret = ' '
    if (table.length >= 1) {
        ret = table[0][1]
    }
    return ret
})


const select = function (el, dataSet) {
    const val = dataSet[el.name] || ''
    const ret = R.path([0, 'lab'])(el.items.filter(i => i.val == val))

    return R.defaultTo(val)(ret)
}

const getData = function (extra, row, column) {
    const otherwise = (row, column) =>  R.cond([
        [val => typeof val == 'object', R.always(' ')],
        [R.isNil,                       R.always(' ')],
        [R.isEmpty,                     R.always(' ')],
        [R.T,                           R.identity]  //always true 
    ])(R.path([column.name], row))

    const readers = {
        select: select
        , radio: select
        , checkbox: checkbox
        , jsonlkp: jsonlkp(extra.lookUps)
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

const currency = s => currencyFormatter.format(s, {
    decimal: ',',
    thousand: '.',
    precision: 2,
    format: '%v' // %s is the symbol and %v is the value
})
// const currency = s => typeof s === 'string' ? s.replace('.', ',') : s.toFixed(2).replace('.', ',')

const withStyle = R.curry((s, t) => ({style: s, text: t}))

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

const renderCell = R.curry(function renderCell(extra, row, column){
    if (column['no-print'] == '1') { return [] }
    if (column['no-print-tp'] == '1' && extra.docType == 'Τεχνικό Παράρτημα') { return [] }
    const value = getData(extra, row, column)
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

const budgetSummary = function budgetSummary (dataSet, extra) {

    const getExpenses = function (dataSet) {
        const sumProp = prop => R.pipe(
            R.pluck(prop),
            R.map(a => string2num(a) || 0),
            R.sum
        )
        const eligible = sumProp('DecVal1')(dataSet)
        const nonEligible = sumProp('DecVal5')(dataSet)
        const publicExpenditure = sumProp('DecVal2')(dataSet)
        const total = eligible + nonEligible

        return [total, nonEligible, eligible, publicExpenditure]
    }
    const getExpenseCategory = R.curry(function (dataSet, category) {
        const categoryLabel = category.title
        const expenses = getExpenses(dataSet.filter(el => el.Comments13 == category.AA))
        const formatExpenses = R.map(currency, expenses)

        return [categoryLabel, ...formatExpenses]
    })

    const expenseCategories = extra.callData.tab6.KATHGORIES_DAPANON_OBJ.KATHGORIES_DAPANON_LIST
    const total = getExpenses(dataSet, 1)

    const budgetAnalysis = R.map(getExpenseCategory(dataSet), expenseCategories)

    return [
        {style: 'h1', text: '{{rank}}. ΣΥΓΚΕΝΤΡΩΤΙΚΟΣ ΠΙΝΑΚΑΣ ΔΑΠΑΝΩΝ'},
        {
            table: {
                widths: ['*', 80, 80, 80, 80],
                body: [
                    R.map(withStyle('headerRow'))(['Κατηγορία Δαπάνης', 'Συνολικό Κόστος(€)', 'Μη Επιλέξιμο Κόστος(€)', 'Επιλέξιμο Κόστος(€)', 'Δημόσια Δαπάνη (€)']),
                    ...budgetAnalysis,
                    ['Συνολικά', ...total.map(currency)]
                ]
            }
        }, ' ']
}

const registerContractor = (dataSet, extra) => {
    extra.contractors = R.pluck('P_LegalName', dataSet)
    return ''
}

const afterRender = {
    GenericCheckpoints_qCategory81_c204: budgetSummary,
    ModificationContractor_qMulti_c204: registerContractor,
    ModificationContractor_qMulti_c204_p2177: registerContractor
}

const renderSection = function renderSection (metaData, data, extra) {
    if (metaData.columns.length <= 0) { return '' }
    if (metaData['no-print'] == '1') { return '' }
    if (metaData['no-print-tp'] == '1' && extra.docType == 'Τεχνικό Παράρτημα') { return '' }

    const title = {style: 'h1', text: '{{rank}}. ' + metaData.title}
    const body = data.length == 0 ? ['-----------------'] //empty dataSet
        : R.map(renderRow(extra, metaData.columns), data)

    const append = data.length > 0 && typeof afterRender[metaData.customise] == 'function' ? afterRender[metaData.customise](data, extra) : ''

    return [title, ...body, append]
}

const samisDataTable = function samisDataTable (metaData, data, extra) {

    const columns = R.pipe(
        R.filter(column => column.view !== '' || column.edit !== ''),
        R.filter(column => column.virtual != 1),
        R.sortBy(column => 1 * column.vord || 0)
    )(metaData.columns)
    metaData.columns = columns

    return renderSection(metaData, data, extra)
}
const raw = function raw (metadata, data, extra) {
    return data
}
const printers = {
    samis: samisDataTable,
    raw: raw
}

//gets a dataSet description from wizard section, calls the corresponding function from the printers array
const renderDataSet = function renderDataSet(metadata, data, extra, type) {
    if (typeof(printers[type]) !== 'function') return ''

    return printers[type](metadata, data, extra)
}

module.exports = {renderDataSet}
