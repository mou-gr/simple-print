'use strict'
const R = require('ramda');
const moment = require('moment');
const db = require('./data')
const xml2js = require('xml-to-json-promise');
const Promise = require("bluebird");

const currency = s => typeof s === 'string' ? s.replace('.', ',') : s.toFixed(2).replace('.', ',');
const withStyle = (s, t) => ({style: s, text: t})

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
    const mergeColumns = function (objArr) {
        const cols = R.pipe(
            R.filter(el => el.columns)
            , R.map(function (c) {
                var merged = {};
                c.columns.forEach(function (col) {
                    (merged[col.name] = col);
                });
                return merged;
            }))(objArr);
        const colKeys = Object.keys(Object.assign({}, ...cols));
        return colKeys.map(el => Object.assign({}, ...R.pluck(el, cols)));
    }

    const records = [];
    records.push(R.filter(el => el.DataKey == dataKey(tableName), metaDataTables)[0]);
    records.push(R.filter(el => el.DataKey == dataKey(tableName, qualifier), metaDataTables)[0]);
    records.push(R.filter(el => el.DataKey == dataKey(tableName, qualifier, callId), metaDataTables)[0]);
    records.push(R.filter(el => el.DataKey == dataKey(tableName, qualifier, callId, callPhaseId), metaDataTables)[0]);

    const recordJson = records.map(parseMetaData);
    var finalObj = Object.assign({}, recordJson[0], recordJson[1], recordJson[2], recordJson[3]);
    var colArr = [];
    R.map(el => {colArr.push(el)}, mergeColumns(recordJson));
    finalObj.columns = colArr;
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
                // dontBreakRows: true,
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

    const renderDataSet = function (metaData, dataSet) {
        const getLabel = function (label) {
            return label && label != '' ? label.replace(/&nbsp;/g, ' ') : ' ';
        }
        const vertical = function (metaData, dataSet) {
            var content = R.pipe(
                R.filter(el => el.view + el.edit !== '')
                , R.filter(el => el.virtual != 1)
                , R.sortBy(el => 1 * el.vord)
                , R.map(el => [withStyle('label', getLabel(el.label)), getData(el, dataSet)])
            )(metaData.columns);

            var doc = [
                {
                //   layout: 'lightHorizontalLines',
                  table: {
                    widths: [ 200, 300 ],
                    // dontBreakRows: true,
                    body: content
                  }
              },
              "  "
           ]

            return doc;
        }
        const horizontal = function (metaData, dataSet) {
            var i, doc = [];
            var cols = R.pipe(
                R.filter(el => el.view + el.edit !== '')
                , R.filter(el => el.virtual != 1)
                , R.sortBy(el => 1 * el.vord)
            )(metaData.columns);
            var content = []
            for (i = 0; i < cols.length; i++) {
                const el = cols[i];
                if (el.header && el.header[1]) {
                    break;
                }
                content.push([getLabel(el.label), getData(el, dataSet)]);
            }
            const header = cols[i].header;
            var subContent = [
                {
                    colSpan: 2,
                    table: {
                        body: [
                            header.map(el => withStyle('headerRow', el.lab))
                        ]
                    }
                }
            ];
            for (i; i < cols.length; i+= header.length - 1) {
                const el = [withStyle('label', cols[i].label)].concat(R.range(0, header.length - 1).map(r => getData(cols[i + r], dataSet) ))
                subContent[0].table.body.push(el);
            }
            content.push(subContent);
            var doc = [
                {
                  layout: 'noBorders',
                  table: {
                    widths: [ 200, 300 ],
                    // dontBreakRows: true,
                    body: content
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
        if (metaData.columns.filter(el => el.header && el.header[1] ).length > 0) {
            return horizontal(metaData, dataSet)
        } else {
            return vertical(metaData, dataSet);
        }
    }

    const metaData = getMetaData(el.table, el.Qualifier, activity.callId, activity.callPhaseId, extra.metaData)
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
        doc.push('NO DATASET')
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
        fontSize: 22,
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
        fontSize: 12
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
