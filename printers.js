'use strict'
const R = require('ramda');
const moment = require('moment');
const db = require('./data')
const xml2js = require('xml-to-json-promise');
const Promise = require("bluebird");

const currency = s => typeof s === 'string' ? s.replace('.', ',') : s.toFixed(2).replace('.', ',');
const withStyle = (s, t) => ({style: s, text: t})


const variableList = function (metaField, callPath, valField, titleField) {
        return function (metadata, callData) {
            var index = metadata.columns.findIndex(function (el) {
                return el.name == metaField;
            });
            if (index < 0) { return metadata }

            var column = metadata.columns[index];
            //var list = resolve(callPath, callData);
            const list = R.path(callPath.split('.'), callData)

            column.items = list.map(function (el, i) { return {val: el[valField], lab: el[valField] + ' - ' + el[titleField]} });

            return metadata;
        }
    }

    const expenseType = variableList('Comments13', 'tab6.KATHGORIES_DAPANON_OBJ.KATHGORIES_DAPANON_LIST', 'AA', 'title')
    const criterionType = variableList('Comments1', 'tab8.critiria', 'aa', 'name')
    const onOffType = variableList('Comments1', 'tab8.onOff', 'aa', 'name')


    const ratio = function ratio(metadata, callData) {
        var ratioList = callData.tab3;
        var ratioListSize = ratioList.length;

        if (ratioListSize == 0) {
            return metadata;
        }

        for (var i = ratioListSize; i < 13; i++) {
            var nameOfIndex1 = "Comments" + (i+1);
            var index1 = metadata.columns.findIndex(function (el1) {
                return el1.name == nameOfIndex1;
            });
            var columnToHide = metadata.columns[index1];
            columnToHide.view = 0;
            columnToHide.edit = 0;
        }

        for (var r = 0; r < ratioListSize; r++) {
            var nameOfIndex2 = "Comments" + (r + 1);
            var index2 = metadata.columns.findIndex(function (el2) {
                return el2.name == nameOfIndex2;
            });
            var columnToRename = metadata.columns[index2];
            var columnWithName = callData.tab3[r];
            columnToRename.label = columnWithName.ONOMASIA_DEIKTH.split('&&')[1];
        }
        return metadata;
    }
    var specialMerge = function specialMerge(metadata, callData, data) {
        // if ( $.isEmptyObject(callData) ) { return metadata }

       var transformationArray = {
           GenericCheckpoints_qCategory74_c204: [ratio]
           , GenericCheckpoints_qCategory74_c204_p2061: [ratio]
           , GenericCheckpoints_qCategory74_c204_p2073: [ratio]
           // , GenericCheckpoints_qCategoryPreLast_c204: [attachmentInfo]
           , GenericCheckpoints_qCategory81_c204: [expenseType] //, budgetRules]
           , GenericCheckpoints_qCategory411_c204: [onOffType]
           , GenericCheckpoints_qCategory412_c204: [criterionType] //, evaluation]
        }

        var transformationChain = transformationArray[metadata.customise] || [];
        transformationChain.push(mergeCompiledData);

        //call each function in transformationChain and transform metadata sequentially
        return transformationChain.reduce(function (res, transformation) {
            return transformation(res, callData, data);
        }, metadata)

    };

const mergeColumns = function mergeColumns(weak, strong) {
    /** merges two sets of columns, priority to the latter*/
    const weakOnly = R.differenceWith((a, b) => a.name === b.name, weak, strong)
    const strongOnly = R.differenceWith((a, b) => a.name === b.name, strong, weak)
    const common = R.pipe(
        R.filter(a => a[0].name === a[1].name),
        R.map(a => R.merge(a[0], a[1]))
    )(R.xprod(weak, strong)) // take the cross product of all columns, keep the tuples with the same name, merge them

    return [...weakOnly, ...strongOnly, ...common] //append everything
}
const merge = function merge (weak, strong) {
    /** merges two sets of metadata. Priority to the latter */
    if (!strong) { return weak }
    if (strong.hidden == '1') {
        const cols = R.map(a => ({name: a.name, view: '', edit: ''}))(weak.columns || [])
        weak.columns = cols
        return weak
    }
    // if hiddenColumns hide all weakColumns
    // exclude from hiding the columns that are in showColumns
    // exclude from hiding the columns that are explicitly declared
    // default to [] when columns undefined
    const hiddenColumns = strong.hiddenColumns === '*' ? R.pluck('name', weak.columns || []) : strong.hiddenColumns || []
    const showColumns = strong.showColumns || []
    const declaredColumns = R.pluck('name', strong.columns || [])
    const finalHiddenColumns = R.difference(hiddenColumns, [...showColumns, ...declaredColumns])

    const hidden = R.map(a => ({'name': a, 'view': '', 'edit': ''}), finalHiddenColumns)

    const mergedHidden = mergeColumns(weak.columns || [], hidden)
    const columns = mergeColumns(mergedHidden, strong.columns || [])

    var merged = R.merge(weak, strong)
    merged.columns = columns

    return merged
}
const mergeCompiledData = function (metaData, callData) {
    const compiled = JSON.parse(callData.compiled)
    return merge(metaData, compiled[metaData.customise])
}
const getMetaData = function (tableName, qualifier, callId, callPhaseId, metaDataTables) {

    const dataKey = (tableName, qualifier, callId, callPhaseId) => tableName
    	+ (qualifier ? '_q' + qualifier : '')
    	+ (callId ? '_c' + callId : '')
    	+ (callPhaseId ? '_p' + callPhaseId : '');

    const parseMetaData = function (el) {
        if (el && el.Data) {
            try {
                return JSON.parse(el.Data
                    .replace(/\t+/g, " ")
                    .replace(/(\r\n|\n|\r)/gm," ")
                )
            } catch (e) {
                return ['Invalid Json MetaData'];
            }
        } else {
            return {};
        }
    }

    const records = [];
    records.push(R.filter(el => el.DataKey == dataKey(tableName), metaDataTables)[0]);
    records.push(R.filter(el => el.DataKey == dataKey(tableName, qualifier), metaDataTables)[0]);
    records.push(R.filter(el => el.DataKey == dataKey(tableName, qualifier, callId), metaDataTables)[0]);
    records.push(R.filter(el => el.DataKey == dataKey(tableName, qualifier, callId, callPhaseId), metaDataTables)[0]);

    const recordJson = records.map(parseMetaData);
    const finalObj = R.reduce(merge, {}, recordJson)
    return finalObj;
}

const samisDataTable = R.curry(async function (activity, extra, pool, el) {
    const getData = function (el, dataSet) {
        const select = function (el, dataSet) {
            var val = (dataSet[el.name] && dataSet[el.name][0]) || '';
            var ret = val;
            if (Array.isArray(el.items)) {
                ret = R.path([0, 'lab'])(el.items.filter(i => i.val == val))
            } else if (el.lookup == 'dblkpgrp') {
                ret = R.path([0, 'LU_LookUpDescription'])(extra.lookUps.filter(item => item[el.valcol] == val))
            } else if (el.lookup == 'dblkp') {
                ret = R.path([0, el.labcol])(extra.countries.filter(i => i[el.valcol] == val));
            } else if (el.lookup == 'slflkp') {
                if (el.njoin) {
                    const refArray = R.path(el.njoin.coords[0].jointable.split('.'), extra.dataSet);
                    const refValue = refArray.filter(i => i[el.njoin.coords[0].joincols[0]][0] == dataSet[el.njoin.coords[0].sourcecols[0]][0])[0][el.valcol][0]
                    val = refValue;
                }
                const table = R.path(el.lkptable.split('.'), extra.dataSet);
                if (table) {
                    const element = table.filter(i => i[el.valcol] == val);
                    ret = R.path([0, el.labcol.split(';').reverse()[0], 0])(element);
                }
            }
            return R.defaultTo('')(ret);
        }
        const checkbox = function (el, dataSet) {
            if (dataSet && dataSet[el.name] && dataSet[el.name][0] == 'true') {
                return 'NAI'
            } else {
                return 'ΟΧΙ';
            }
        }
        const jsonlkp = function (el, dataSet) {
            const val = (dataSet[el.name] && dataSet[el.name][0]) || '';
            const table = extra.jsonLookUps[el.lookupaction].data
                .filter(i => i[0] == val);
            var ret = '';
            if (table.length >= 1) {
                ret = table[0][1];
            }
            return ret;
        }
        const date = function (el, dataSet) {
            const val = (dataSet[el.name] && dataSet[el.name][0]) || '';
            const date = moment(val);
            return date.isValid() ? date.format('DD - MM - Y') : val;
        }
        const otherwise = function (el, dataSet) {
            if (dataSet && dataSet[el.name] && typeof dataSet[el.name][0] !== 'object') {
                return `${dataSet[el.name][0]} `;
            } else {
                return ' ';
            }
        }

        const readers = {
            select: select
            , radio: select
            , checkbox: checkbox
            , jsonlkp: jsonlkp
            , date2: date
            , date: date
        }

        if (typeof readers[el.etype] === 'function') {
            return readers[el.etype](el, dataSet)
        } else {
            return otherwise(el, dataSet)
        }
    };
    const renderExpenses = function (metaData, dataSet) {

        const defaultItems = ['CID_ContractOfferID', 'CID_CallExpenseID', 'CID_Description', {name: 'Value', label: 'Δαπάνη', value: dataSet.CID_Quantity[0] * dataSet.CID_Value[0]} ];
        const category = {
            "ΕΡ1": ['CID_ContractOfferID', 'CID_CallExpenseID', 'CID_Description', 'CID_CommercialName', 'CID_Value', 'CID_Quantity', {name: 'Value', label: 'Συνολική Δαπάνη', value: dataSet.CID_Quantity[0] * dataSet.CID_Value[0]}]
            , "ΕΡ2": ['CID_ContractOfferID', 'CID_CallExpenseID', 'CID_Description', 'CID_Comments', {name: 'CID_CommercialName', label: 'Τύπος/Μοντέλο'}, 'CID_Supplier', 'CID_SupplierAFM', 'CID_SerialNumber', {name: 'CID_Value', label:'Αξία Απόσβεσης'}]
            , "ΕΡ3": ['CID_ContractOfferID', 'CID_CallExpenseID', 'CID_Description', 'CID_Comments', 'CID_SupplierAssessment', {name: 'CID_Value', label: 'Δαπάνη'}]
            , "ΕΡ4": defaultItems
            , "ΕΜΕΟ": defaultItems
            , "ΜΕ1": defaultItems
            , "ΚΑ1": defaultItems
            , "ΕΚ1": defaultItems
            , 'other': defaultItems
        }
        const defaultLabel = function (metaData, dataSet, el) {
            return R.filter(i => i.name === el || i.name === el.name)(metaData.columns)[0].label
        }
        const defaultValue = function (metaData, dataSet, el) {
            return getData(R.filter(i => i.name === el || i.name === el.name)(metaData.columns)[0], dataSet)
        }
        const writeData = R.curry(function (metaData, dataSet, el) {
            const lab = el.label || defaultLabel(metaData, dataSet, el);
            const val = el.value || defaultValue(metaData, dataSet, el);
            return [withStyle('label', lab), val];
        })
        const cat = dataSet.CEE_Code[0] ? R.trim(dataSet.CEE_Code[0]) : 'other';
        const types = category[cat] || category['other'];
        var content = R.map(writeData(metaData, dataSet))(types);

        var doc = [
            {
            //   layout: 'lightHorizontalLines',
              table: {
                widths: [ 200, 300 ],
                dontBreakRows: true,
                body: content
              }
          },
          "  "
       ]
       return doc;

    }

    const renderBudgetSummary = function (metaData, dataSet, extra) {
        const institutions = extra.dataSet.ContractModificationDataSet.ModificationContractor.map(el => [R.path(['ContractorID', 0])(el), R.path(['CNT_DistinctName', 0])(el)])
        const expenses = R.groupBy(el => el.CA_CallActionCategoryID)(extra.dataSet.ContractItemDataSet.CallExpense)
        const length = institutions.length;

        const filterSumExpense = function (filter) {
            return dataSet.filter(filter).map(c => c.Value[0]).reduce((a, b) => a + b, 0);
        }
        const content = [['Κατηγορία Δαπάνης', ...institutions.map(el => el[1] || ''), 'Σύνολο Επιλέξιμου Π/Υ']]
        R.map(el => {
            const exp = institutions.map(i => filterSumExpense(c => c.CID_ContractOfferID[0] == i[0] && c.CA_CallActionCategoryID[0] == el[0].CA_CallActionCategoryID[0]))
            content.push([withStyle('partialSumRow', el[0].CAD_Description[0]), ...(exp.map(t => withStyle('partialSumRow', t))), withStyle('partialSumRow', R.sum(exp))])
            el.map(t => {
                const exp = institutions.map(i => filterSumExpense(c => c.CID_ContractOfferID[0] == i[0] && c.CEE_Code[0] == t.CEE_Code[0]))
                content.push([t.CEE_Description[0], ...exp, R.sum(exp)])
            })
        })(expenses)

        const exp = institutions.map(i => filterSumExpense(c => c.CID_ContractOfferID[0] == i[0]))
        content.push(['Σύνολο', ...exp, R.sum(exp)])

        var doc = [
            {
              layout: budgetLayout,
              table: {
                widths: [ 180, ...institutions.map(() => 180 / length), 80 ],
                // dontBreakRows: true,
                body: content
              }
          },
          "  "
       ]
       return doc;
    }
    const getRegion = function (extra, civicCompartment) {
        return R.pipe(
            R.filter(el => el[0] == civicCompartment)
            , R.path(['0', '1'])
            , R.defaultTo('')
            , R.split('/')
            , R.last
        )(extra.jsonLookUps['AgroL3L1N2TopikesKoinotites.json'].data)
    }

    const renderBudgetSummaryFromWp = function (metaData, dataSet, extra) {
        if (!dataSet) {
            return 'NO DATASET';
        }
        const columns = ['Α/Α Φορέα', 'Συντομογραφία Φορέα', 'Είδος Φορέα', 'Προϋπολογισμός', 'Δημόσια Δαπάνη', 'Δημόσια Δαπάνη (%)', '(%) Δ.Δ. επί της συνολικής Δ.Δ.', 'Περιφέρειες']

        const columnWidth = 58;
        const institutionTypes = metaData.columns.filter(el => el.name == 'CNT_ImplementationCarrierTypeEnum_Code')[0].items;
        const totalBudget = R.sum(dataSet.map(el => 1*el.Budget[0]))
        const totalFunded = R.sum(dataSet.map(el => 1*el.PublicExpenditure[0]))

        const c = R.groupBy(el => el.ContractorID)(extra.dataSet.ContractModificationDataSet.ModificationContractor);
        const content = R.pipe(
            R.groupBy(el => el.ContractorID[0])
            , R.mapObjIndexed((val, key, obj) => [
                c[key][0].CNT_AssociationNumber[0]
                , c[key][0].CNT_DistinctName[0]
                , institutionTypes.filter(i => i.val == c[key][0].CNT_ImplementationCarrierTypeEnum_Code[0])[0].lab
                , val.map(i => 1 * i.Budget[0]).reduce((a, b) => a + b, 0)
                , val.map(i => 1 * i.PublicExpenditure[0]).reduce((a, b) => a + b, 0)
                , 5
                , 6
                , getRegion(extra, c[key][0].CNT_CivicCompartment[0])
            ])
            , R.toPairs
            , R.map(i => i[1])
            , R.map(i => R.update(5, (100 * i[4] / i[3]).toFixed(2))(i))
            , R.map(i => R.update(6, (100 * i[4] / totalFunded).toFixed(2))(i))
        )(dataSet);
        const total = ['', 'Σύνολο', '', totalBudget, totalFunded, (100 * totalFunded / totalBudget).toFixed(2), '100.00', ''];

        var doc = [
            {
              layout: budgetLayout,
              table: {
                widths: [ ...columns.map(() => columnWidth)],
                // dontBreakRows: true,
                body: [columns, ...content, total]
              }
          },
          "  "
       ]
       return doc;
    }

    const getLabel = label => label && label != '' ? strip(label) : ' '

    const strip = str => str.replace(/(&nbsp;|<ol>|<li>|<\/ol>|<\/li>)/g, ' ')

    const renderHeader = function renderHeader (column) {
        if (!column.header || column.header == '') { return undefined }

        if (column.header.length === 1) {
            return [{style:'headerRow', text: strip(column.header[0].lab), colSpan: 2, alignment: 'center'}, ' ']
        }

        return [
                withStyle('headerRow', R.path(['header', '0', 'lab'], column) || ' '),
                {
                    margin: [-5, -3],
                    table: {
                        widths: R.map(a => '*', R.tail(column.header)),
                        body: [ R.map(a => withStyle('headerRow', a.lab))(R.tail(column.header)) ]
                    }
                }
            ]
    }

    const renderDataSet = function (metaData, dataSet) {
        const renderColumn = function (el) {
            return [renderHeader(el), [withStyle('label', getLabel(el.label)), getData(el, dataSet), el.inline]]
        }
        const mergeInline = function (columns) {
            return R.reduce(
                (acc, value) => {
                    if (value[2] != '1') { return R.append(R.slice(0, 2, value), acc) }
                    const lastRow = R.last(acc)
                    if (typeof(lastRow[1]) === 'string') {
                        lastRow[1] = {
                            margin: [-5, -3, -5, -4],
                            table: {
                                widths: ['*', '*'],
                                body: [[ lastRow[1], value[1] ]]
                            }
                        }
                    } else {
                        lastRow[1].table.body[0].push(value[1])
                        lastRow[1].table.widths.push('*')
                    }
                    return acc
                }
                ,[]
                , columns)
        }

        const vertical = function (metaData, dataSet) {
            var content = R.pipe(
                R.filter(el => el.view + el.edit !== '')
                , R.filter(el => el.virtual != 1)
                , R.sortBy(el => 1 * el.vord)
                , R.map(renderColumn)
                , R.unnest
                , R.filter(R.identity)
            )(metaData.columns);

            var doc = [
                {
                //   layout: 'lightHorizontalLines',
                  table: {
                    widths: [ 200, 300 ],
                    // dontBreakRows: true,
                    body: mergeInline(content)
                  }
              },
              "  "
           ]

            return doc;
        }

        if (metaData.customise && metaData.customise === 'ContractorBudgetSummary') {
            return renderBudgetSummaryFromWp(metaData, dataSet, extra);
        }
        if (metaData.customise && metaData.customise.startsWith('BudgetSummary_')) {
            return renderBudgetSummary(metaData, dataSet, extra);
        }
        if (metaData.customise && metaData.customise === 'ContractItemDetail_TDE') {
            return renderExpenses(metaData, dataSet);
        }
        return vertical(metaData, dataSet);
    }

    const jsonData = getMetaData(el.table, el.Qualifier, activity.callId, activity.callPhaseId, extra.metaData)

    // const callData = extra.callData[jsonData.customise]
    // const metaData = merge(jsonData, callData)

    const callData = extra.callData
    const metaData = specialMerge(jsonData, callData)

    const sortedColumns = R.sort((a, b) => 1 * (a.vord || 0) - 1 * (b.vord || 0), metaData.columns)
    metaData.columns = sortedColumns

    //check for inactive tab
    if (R.filter(a => a.view !== '' || a.edit !== '', metaData.columns).length <= 0) { return '' }

    const getDataSet = async function (metaData, data, contractId) {
        var dataSet;
        if (metaData.customise === 'ContractItemDetail_TDE') {
            dataSet = await db.getContractItemDetail(contractId, metaData.datafilter, pool);
        } else if (metaData.datafilter) {
            const xml = await db.getFilteredDataSet(activity.activityId, metaData, pool);
            const pXml = xml.recordset.length > 0 && await Promise.all(xml.recordset.map(i => xml2js.xmlDataToJSON(i.value) ));
            pXml && (dataSet = pXml.map(el => el[Object.keys(el)[0]]));
        }  else {
            dataSet = R.path(metaData.name.split('.'), data);
        }
        return dataSet;
    }
    const dataSet = await getDataSet(metaData, extra.dataSet, activity.contractId);

    var doc;
    doc = [
            {style: 'h1', text: metaData.title}
          ]
    if (!dataSet) {
        doc.push('-------------')
    } else {
        if (metaData.single == 1) {
            doc = doc.concat(renderDataSet(metaData, dataSet[0]))
        } else {
            dataSet.forEach(function (el) {
                doc = doc.concat(renderDataSet(metaData, el));
            });
        }
    }
    return doc;
});

const styles = {
    h1: {
        fontSize: 18,
        bold: true
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
const budgetLayout = {
    fillColor: (i, node) => {
        if (i === 0) {
            return styles.headerRow.fillColor
        }
        if (i === node.table.body.length - 1)
            return styles.sumRow.fillColor
    }
}

module.exports = {samisDataTable, styles, getMetaData}
