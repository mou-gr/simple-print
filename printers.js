'use strict'
const R = require('ramda')
const currencyFormatter = require('currency-formatter')
const T = require('./translation')

const string2num = str => 1 * str.replace(/\./g, '').replace(/,/g, '.')
const checkbox = function (el, dataSet, extra) {
    if (dataSet && (dataSet[el.name] == 'True' || dataSet[el.name] == 'true')) {
        return T.getTranslation(extra.language, 'NAI')
    } else {
        return T.getTranslation(extra.language, 'ΟΧΙ')
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
    const items = el.items || []
    const ret = R.path([0, 'lab'])(items.filter(i => i.val == val))

    return R.defaultTo(val)(ret)
}

/** extracts the data of a given cell
 * @param {Object} row - the row of the dataset that is being parsed
 * @param {Object} column - the column definition that will be printed 
 */
const getData = function (extra, row, column) {
    const otherwise = (row, column) => R.cond([
        [val => typeof val == 'object', R.always(' ')],
        [R.isNil, R.always(' ')],
        [R.isEmpty, R.always(' ')],
        [R.T, R.identity]  //always true 
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
        return readers[column.etype](column, row, extra)
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

/**global declaration so they can be used within readTransformation that is read as string from the DB */
global.num2string = function num2string(num) {
    return num.toFixed(2).replace('.', ',')
}
global.num2stringLocale = currency

global.defaultTo = function defaultTo(def, val) {
    return (val == null ? def : val)
}

const withStyle = R.curry((s, t) => ({ style: s, text: t }))

const renderHeader = function renderHeader(column) {
    if (column.header.length === 1) {
        return [{ style: 'headerRow', text: strip(column.header[0].lab || ' '), colSpan: 2, alignment: 'center' }, ' ']
    }

    return [
        withStyle('headerRow', R.path(['header', '0', 'lab'], column) || ' '),
        {
            margin: [-5, -3],
            table: {
                widths: R.map(() => '*', R.tail(column.header)),
                body: [R.map(a => withStyle('headerRow', a.lab))(R.tail(column.header))]
            }
        }
    ]
}
/**used for merging inline fields. Can merge multiple inline fields */
const mergeWithPrev = function (acc, value) {
    if (value[2] != '1') { return R.append(R.slice(0, 2, value), acc) } // no merge needed, just remove the inline flag
    const lastRow = R.last(acc)
    if (typeof (lastRow[1]) === 'string') { //merge with normal cell (not already merged)
        lastRow[1] = {
            margin: [-5, -3, -5, -4],
            table: {
                widths: ['*', '*'],
                body: [[lastRow[1], value[1]]]
            }
        }
    } else { // merge with already merged cell
        lastRow[1].table.body[0].push(value[1])
        lastRow[1].table.widths.push('*')
    }
    return acc
}

const renderLabel = label => withStyle('label', label && label != '' ? strip(label) : ' ')

let purchaseVoucherArray = [];

function resetPurchaseVoucherArray() {
    purchaseVoucherArray = [];
}
/** create special definition for cells of type jsonGrid */
const jsonGrid = function jsonGrid(row, column) {
    const grid = row[column.name]

    /** Fill purchaseVoucherArray while going over PurchaseVoucher rows. */
    if (column.name === 'PurchaseVoucherDetails_Grid') {
        
        const rowWithoutPurchaseVoucherGrid = { ...row };
        delete rowWithoutPurchaseVoucherGrid.PurchaseVoucherDetails_Grid;

        purchaseVoucherArray.push(rowWithoutPurchaseVoucherGrid);
    }
    /** Transform data to create a result identical to the original parsedGrid */
    if (column.name === 'PaymentVoucherDetails_Grid') {
        if (!row.PaymentVoucherDetails_Grid || row.PaymentVoucherDetails_Grid.length === 0) {
            // Create an empty table with headers only in the event that the user clicks + without filling form.
            var tableBody = [];
    
            return [
                renderHeader({ header: [{ lab: column.label }] }),
                [{
                    table: {
                        body: [
                            column.columnHeaders.map(h => h.replace(/<br>/g, ' ')),
                            ...tableBody
                        ]
                    },
                    colSpan: 2
                }]
            ];
        }else{
            const cellData = JSON.parse(grid);
            const transformedData = [];
        
            cellData.forEach((cellDataRow) => {
                purchaseVoucherArray.forEach((purchaseVoucher) => {
                    if (cellDataRow.PAVD_PurchaseVoucherID.toString() === purchaseVoucher.PurchaseVoucherID) {

                        const dateParts = purchaseVoucher.PV_IssueDate.split(' ');
                        const dateComponents = dateParts[0].split('/');
                        const formattedDate = `${dateComponents[0].padStart(2, '0')}/${dateComponents[1].padStart(2, '0')}/${dateComponents[2]}`;

                        const formattedPAVDValue = Number(cellDataRow.PAVD_Value).toFixed(2);    
                        const vatValueWithDot = purchaseVoucher.PV_VAT_Value.replace(',', '.');
                        const formattedVATValue = parseFloat(vatValueWithDot).toFixed(2).replace('.', ',');
                        const formattedPAVDValueWithDecimals = formattedPAVDValue.includes('.') ? formattedPAVDValue.replace('.', ',') : `${formattedPAVDValue},00`;
                        
                        /** desired output table format | default ΄Ναι΄ because if you find it in the new grid, its because it is in USE, otherwise it doesnt exist */
                        transformedData.push([
                            purchaseVoucher.PVT_Description,
                            purchaseVoucher.PV_VoucherNumber,
                            formattedDate,
                            purchaseVoucher.PV_Supplier,
                            formattedVATValue,
                            'Ναι',
                            formattedPAVDValueWithDecimals,
                        ]);
                    }
                });
            });
        
            const tableBody = [
                column.columnHeaders.map((h) => h.replace(/<br>/g, ' ')),
                ...transformedData,
            ];
            
            return [
                renderHeader({ header: [{ lab: column.label }] }),
                [
                    {
                        table: {
                            body: tableBody,
                        },
                        colSpan: 2,
                    },
                ],
            ];
        }

    }else{
        const data = JSON.parse(grid)
        const readTrasformation = new Function('row', column.readTransformation.join(''))

        const dataGrid = data.map(readTrasformation)
        const parsedGrid = dataGrid.map(row => {
            var deleteRow = false
            const retValue = R.zipWith((def, col) => {
                if (def.type != 'checkbox') { return col }
                deleteRow = col != 1
                return col == 1 ? 'Ναι' : 'Όχι'
            }, column.columnTypes, row)
            return deleteRow ? undefined : retValue
        }).filter(r => r !== undefined)

        return [
            renderHeader({ header: [{ lab: column.label }] }),
            [{
                table: {
                    body: [
                        column.columnHeaders.map(h => h.replace(/<br>/g, ' ')),
                        ...parsedGrid
                    ]
                },
                colSpan: 2
            }]
        ]
    }
}

/**create definition for a column of the dataSet
 * @param {Object} row - the row of the dataSet that is being processed
 * @param {Object} column - the definition of the column to be printed
 */
const renderCell = R.curry(function renderCell(extra, row, column) {
    if (column['no-print'] == '1') { return [] }
    if (column['no-print-tp'] == '1' && extra.docType == 'Τεχνικό Παράρτημα') { return [] }
    if (column.etype == 'jsonGrid') { return jsonGrid(row, column) }
    const value = getData(extra, row, column)
    var cell = []
    column.header && column.header != '' && cell.push(renderHeader(column))
    cell.push([renderLabel(column.label), value, column.inline]) //mark at 3rd position if it needs to be merged with the previous
    return cell
})

/** Generate pdfmake definition for a row of the dataset*/
const renderRow = R.curry(function renderRow(extra, columns, row) {
// map each column, take care of inline fields
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

/**After render function for the budget summary */
const budgetSummary = function budgetSummary(dataSet, extra) {

    /** get the totals from the dataset */
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

    /** Creates definition for each expense category
     * @param {Array} dataSet - the data to be printed
     * @param {string} category - the expense category to calculate
     */
    const getExpenseCategory = R.curry(function (dataSet, category) {
        const categoryLabel = category.title
        const expenses = getExpenses(dataSet.filter(el => el.Comments13 == category.AA))
        const formatExpenses = R.map(currency, expenses)

        return [categoryLabel, ...formatExpenses]
    })

    const expenseCategories = extra.callData.tab6.KATHGORIES_DAPANON_OBJ.KATHGORIES_DAPANON_LIST
    const total = getExpenses(dataSet, 1)

    //for each expense category as read from callData generate data to be printed
    const budgetAnalysis = R.map(getExpenseCategory(dataSet), expenseCategories)

    return [
        { style: 'h1', text: `{{rank}}. ${T.getTranslation(extra.language, 'ΣΥΓΚΕΝΤΡΩΤΙΚΟΣ ΠΙΝΑΚΑΣ ΔΑΠΑΝΩΝ')}` },
        {
            table: {
                widths: ['*', 80, 80, 80, 80],
                body: [
                    R.map(withStyle('headerRow'))(['Κατηγορία Δαπάνης', 'Συνολικό Κόστος(€)', 'Μη Επιλέξιμο Κόστος(€)', 'Επιλέξιμο Κόστος(€)', 'Δημόσια Δαπάνη (€)'].map(a => T.getTranslation(extra.language, a))),
                    ...budgetAnalysis,
                    [T.getTranslation(extra.language, 'Συνολικά'), ...total.map(currency)]
                ]
            }
        },
        ' ']
}

/**After render function that generates an extra table analyzing expenses */
const budgetOverview = function (dataSet, extra) {
    const columns = ['totalBudget', 'eligibleBudget', 'aidIntensity', 'publicExpenditure', 'totalBudgetFromVouchers', 'eligibleBudgetFromVouchers', 'aidIntensityFromVouchers', 'publicExpenditureFromVouchers']

    const budgetAnalysis = dataSet.map(el => [
        el.expenseCategory,
        ...columns.map(col => el[col]).map(string2num).map(currency)
    ])

    const total = columns.map(col => {
        if (['aidIntensity', 'aidIntensityFromVouchers'].includes(col)) { return ' ' }
        return R.pipe(
            R.pluck(col), // get an array of all the values of the needed column from the dataSet
            R.map(string2num), // format them as number
            R.sum, // add them
            currency // generate a string with currency format
        )(dataSet)
    })

    return [
        { style: 'h1', text: `{{rank}}. ${T.getTranslation(extra.language, 'Έλεγχος δαπανών βάσει Ισχύοντος Τεχνικού Παραρτήματος - Συγκεντρωτικά')}` },
        {
            table: {
                widths: ['*', 50, 50, 50, 50, 50, 50, 50, 50],
                body: [
                    [' ', { text: `{{rank}}. ${T.getTranslation(extra.language, 'Προϋπολογισμός Βάσει Ένταξης')}`, style: 'headerRow', colSpan: 4 }, {}, {}, {}, { text: `{{rank}}. ${T.getTranslation(extra.language, 'Προϋπολογισμός Βάσει Παραστατικών')}`, style: 'headerRow', colSpan: 4 }, {}, {}, {}],
                    [`{{rank}}. ${T.getTranslation(extra.language, 'Κατηγορία Δαπάνης')}`,`{{rank}}. ${T.getTranslation(extra.language, 'Συνολικό (€)')}`, `{{rank}}. ${T.getTranslation(extra.language, 'Επιλέξιμο (€)')}`, `{{rank}}. ${T.getTranslation(extra.language, 'Ποσοστό Δημόσιας Δαπάνης (%)')}`, `{{rank}}. ${T.getTranslation(extra.language, 'Δημόσια Δαπάνη (€)')}`, `{{rank}}. ${T.getTranslation(extra.language, 'Συνολικό (€)')}`, `{{rank}}. ${T.getTranslation(extra.language, 'Επιλέξιμο (€)')}`,`{{rank}}. ${T.getTranslation(extra.language, 'Ποσοστό Δημόσιας Δαπάνης (%)')}`, `{{rank}}. ${T.getTranslation(extra.language, 'Δημόσια Δαπάνη (€)')}`].map(withStyle('headerRow')),
                    ...budgetAnalysis,
                    [`{{rank}}. ${T.getTranslation(extra.language, 'Συνολικά')}`, ...total].map(withStyle('sumRow'))
                ]
            }
        },
        ' ',
    ]
}

/** After render function that gets the name of the constructor and appends it to the extra "object"
 * Used to pass the contractor name to cover, header, footer
 * Could be simplified if it is passed as request param by the caller
 */
const registerContractor = (dataSet, extra) => {
    extra.contractors = R.pluck('P_LegalName', dataSet)
    return ''
}

// Array of tabs (specified by customise) that will have an extra section appended
const afterRender = {
    ExpenseCategoriesBudget_qSingle_c204: budgetOverview,
    GenericCheckpoints_qCategory81_c204: budgetSummary,
    ModificationContractor_qMulti_c204: registerContractor,
    ModificationContractor_qMulti_c204_p2177: registerContractor,
    ModificationContractor_qMulti_c204_p2129: registerContractor,
    ModificationContractor_qMulti_c204_p2131: registerContractor,
    ModificationContractor_qMulti_c204_p2178: registerContractor,
    ModificationContractor_qMulti_c204_p2179: registerContractor,
    ModificationContractor_qMulti_c204_p2351: registerContractor
}

//var lastPurchaseVoucher = false;
/**Create pdfmake definition for specified tab */
const renderSection = function renderSection(metaData, data, extra) {
    if (metaData.columns.length <= 0) { return '' }
    if (metaData['no-print'] == '1') { return '' }
    if (metaData['no-print-tp'] == '1' && extra.docType == 'Τεχνικό Παράρτημα') { return '' }
    
    // Array of tabs (specified by customise) that will not have the normal definition 
    // but only the "appended one"
    const appendOnly = ['ExpenseCategoriesBudget_qSingle_c204'].includes(metaData.customise)

    // Array of tabs (specified by customise) that will have an extra section appended
    const append = data.length > 0 && typeof afterRender[metaData.customise] == 'function' ? afterRender[metaData.customise](data, extra) : ''

    if (appendOnly) { return [append] }

    // Add title with placeholder for serial number
    const title = { style: 'h1', text: '{{rank}}. ' + (metaData['print-title'] || metaData.title) }
    const body = data.length == 0 ? ['-----------------'] //empty dataSet
        : R.map(renderRow(extra, metaData.columns), data)

    
    
    return [title, ...body, append]
}

/** Generates declaration for a section of samisDataTable type */
const samisDataTable = function samisDataTable(metaData, data, extra) {
    //filter, sort columns and then generate definition

    const columns = R.pipe(
        R.filter(column => column.view !== '' || column.edit !== ''), 
        R.filter(column => column.virtual != 1),
        R.sortBy(column => 1 * column.vord || 0)
    )(metaData.columns)
    metaData.columns = columns

    return renderSection(metaData, data, extra)
}

/** the data is already compatible with pdfmake and will be sent without modification*/
const raw = function raw(metadata, data, extra) {
    return data
}

/** Hashmap of functions to use according to the declared type */
const printers = {
    samis: samisDataTable,
    raw: raw
}

/** gets a dataSet description from wizard section, calls the corresponding function from the printers array */

const renderDataSet = function renderDataSet(metadata, data, extra, type) {
    if (typeof (printers[type]) !== 'function') return ''

    return printers[type](metadata, data, extra)
}

module.exports = { renderDataSet, resetPurchaseVoucherArray };
