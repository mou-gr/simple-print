'use strict'
const R = require('ramda')
const xml2js = require('xml-to-json-promise')

const getStep = function (s) {
    const type = R.last(s.$.url.split('/'), 1)
    return controls[type] && controls[type](s)
}

// parse all elements of CompositeControl
const WizardCompositeControl = R.pipe(
    R.path(['parameters', '0', 'user-control-param'])
    , R.map(getStep)
)

const SamisDataTable = function (s) {
    const ret = { type: 'SamisDataTable', description: s.$.description }
    s.parameters[0].param.forEach(el => ret[el.$.id] = el.$.value)
    ; [ret.table, ret.xmlDataset] = ret.FullTableName.split('.')

    return ret
}

var controls = {
    'WizardCompositeControl.ascx': WizardCompositeControl,
    'SamisDataTable.ascx': SamisDataTable,
    'FlowLayoutCompositeControl.ascx': WizardCompositeControl
}

const parse = function (wizard) {
    return xml2js.xmlDataToJSON(wizard)
        .then(
            R.pipe(
                R.path(['wizard-defs', 'wizard-flow', 0, 'step'])
                , R.map(getStep)
                , R.flatten
                , R.filter(R.identity)
            )
        )
}

module.exports = {parse}
