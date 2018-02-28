'use strict'
const R = require('ramda');
const xml2js = require('xml-to-json-promise');
const Promise = require('bluebird');

var getStep = function (s) {
   var type = R.last(s.$.url.split('/'), 1);
   return {
     id: s.$.id,
     url: s.$.url,
     type: type,
     control: controls[type] && controls[type](s)
   };
};

var WizardCompositeControl = function (s) {
    var ret = s.parameters[0]['user-control-param'].map(getStep);
    return ret;
}
var FlowLayoutCompositeControl = WizardCompositeControl;

var SamisDataTable = function (s) {
    var ret = {
      description: s.$.description
    };
    s.parameters[0].param.forEach(el => ret[el.$.id] = el.$.value);
    var table = ret.FullTableName.split('.');
    ret.table = table[1];
    ret.xmlDataset = table[0];
    return ret;
}

var controls = {
    'WizardCompositeControl.ascx': WizardCompositeControl,
    'SamisDataTable.ascx': SamisDataTable,
    "FlowLayoutCompositeControl.ascx": FlowLayoutCompositeControl
}

const parse = async function (path) {
  const json = await xml2js.xmlFileToJSON(path);
  return json["wizard-defs"]["wizard-flow"][0].step.map(getStep).filter(el => el != '');
}

module.exports = {parse}
