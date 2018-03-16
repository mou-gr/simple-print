'use strict'
const sql = require('mssql')
const R = require ('ramda')
const Promise = require('bluebird')
const credentials = require('./config')
sql.Promise = Promise

const config = credentials.config

const getConnection = function () {
    return sql.connect(config)
}
const closeConnection = function () {
    return sql.close()
}

const query = function (str, pool) {
    return pool.request().query(str)
        .catch(e => {
            e.query = str
            throw(e)
        })
}

const getJsonData = function (table, qualifier, callId, callPhaseId, pool) {
    const q = `select Data from JsonData
            where TableName = '${table}' and Qualifier is null and CallID is null and CallPhaseID is null
            or TableName = '${table}' and Qualifier = '${qualifier}' and CallID is null and CallPhaseID is null
            or TableName = '${table}' and Qualifier = '${qualifier}' and CallID = '${callId}' and CallPhaseID is null
            or TableName = '${table}' and Qualifier = '${qualifier}' and CallID = '${callId}' and CallPhaseID = '${callPhaseId}'
            order by DataKey`
    return query(q, pool).then(R.pipe(
        R.prop('recordset')
        , R.pluck('Data')
    ))
}

const getTableData = function (contractActivityId, dataSet, path, pool) {
    var q = `select
	    CMH_WorkingCopyData.query('${path}')
      from ContractModificationHistory
      WHERE
      CMH_ContractActivityID = ${contractActivityId}
	    AND  CMH_DataSetType = '${dataSet}'`
    return query(q, pool)
}

const getTableMetaData = function (callPhaseId, table, qualifier, pool) {
    var q = `select Data from JsonData
        where callPhaseId = ${callPhaseId}
        and TableName = '${table}'`
    if (qualifier) {
        q += ` and Qualifier = '${qualifier}'`
    }
    return query(q, pool)
}

const getAllTables =  function (tables, pool) {
    const tableString = (tables.map(t => `'${t}'`)).join()
    var q = `select * from JsonData where TableName in (${tableString})`
    return query(q, pool)
}

const getXmlData =  function (activityId, pool) {
    return query (`select CMH_WorkingCopyData from ContractModificationHistory where cmh_contractActivityID = ${activityId}`, pool)
        .then(R.pipe(
            R.prop('recordset')
            , R.pluck('CMH_WorkingCopyData')
        ))
}

const getLookUps = async function  (pool) {
    const res = await query (`select * from LookUps `, pool)
    return res.recordset
}
const getCountries = async function  (pool) {
    const res = await query (`select * from CountryISO`, pool)
    return res.recordset
}
const getFilteredDataSet = function (activityId, metaData, pool) {
    var str
    var filter = metaData.datafilter
    const field = '/' + metaData.name.replace('.', '/')
    if (filter) {
        var column = filter.split(/[\s=]+/)[0]
        str = `select value from (
        	SELECT
        		${column} = XC.value('(${column})[1]', 'varchar(50)'),
        		value = XC.query('.')
        	FROM
        		ContractModificationHistory
        	CROSS APPLY
        		CMH_WorkingCopyData.nodes('${field}') AS XT(XC)
        	 where cmh_contractActivityID = ${activityId}
        	 ) a
        where ${filter}`
    }
    return query(str, pool)
}
const getCallCallPhase = async function (activityId, pool) {
    const str = `select p.CallPhaseID as callPhaseId, p.CP_CallID as callId, ca.CA_ContractID as contractId, co.CN_Code as cnCode, ca.CA_DateFinished as dateFinished
    from contractActivity ca
    join CallPhase p on p.callPhaseID = ca.CA_CallPHaseID
    join Contract co on co.ContractID = ca.CA_ContractID
    where ContractActivityID = ${activityId}`
    const ret = await query(str, pool)
    return ret.recordset[0]
}
const getContractId = async function (activityId, pool) {
    const str = `select CA_ContractID from ContractActivity where ContractActivityID = ${activityId}`
    const res = await query(str, pool)
    return res.recordset[0].CA_ContractID
}
const getCallData = async function (contractId, pool) {
    const str = `select JsonData from
        Invitation i join Invitation_Contract ic on i.ID = ic.INV_InvitationID
        where ic.CO_ContractID = ${contractId}`
    const res = await query(str, pool)
    return JSON.parse(res.recordset[0].JsonData)
}
const getContractItemDetail = async function (contractId, datafilter, pool) {
    const str = `SELECT cid.*, cac.CAD_Description, ca.CallActionID , ca.CA_CallActionCategoryID, ca.CA_Description, cee.CEE_Code, cee.CEE_Description, ce.CE_CallExpenseEnumID
FROM ContractItem ci
join ContractItemDetail cid on ci.contractItemID = cid.CId_contractItemID
join callExpense ce on ce.callExpenseID = cid.CID_CallExpenseID
join callExpenseEnum cee on cee.callExpenseEnumID = ce.CE_CallExpenseEnumID
join CallAction ca on ce.CE_CallActionID = ca.CallActionID
join CallActionCategory cac on cac.CallActionCategoryID = ca.CA_CallActionCategoryID
where ci.CI_contractID = ${contractId} and ${datafilter || '1=1'}`
    const res = await query(str, pool)
    return R.map(el => R.map(i => [i])(el))(res.recordset)
}
const getCallExpenseDescription = async function (callId, pool) {
    const res = await query(`select  cac.CAD_Description, ca.CallActionID , ca.CA_CallActionCategoryID, ca.CA_Description, CallExpenseID, CEE_Code, CEE_Description from CallExpense ce
join CallExpenseEnum cee on ce.CE_CallExpenseEnumID = cee.CallExpenseEnumID
join CallAction ca on ce.CE_CallActionID = ca.CallActionID
join CallActionCategory cac on cac.CallActionCategoryID = ca.CA_CallActionCategoryID
where cee.CEE_CallID = ${callId}`, pool)
    return res.recordset.map(el => R.map(i => [i])(el))
}
const getCallAction = async function (pool) {
    const res = await query('select CallActionID, CA_Description from CallAction', pool)
    return res.recordset.map(el => R.map(i => [i])(el))
}
const getBudgetSummary = async function (contractId, pool) {
    const res = await getContractItemDetail(contractId, 'CID_Deleted = 0', pool)
    const resObject = R.pipe(
        // R.map(R.pickAll(['CEE_Code', 'CEE_Description', 'CID_ContractOfferID', 'CE_CallExpenseEnumID', 'CID_Quantity', 'CID_Value']))
        R.map(el => R.assoc('Value', [el.CID_Quantity * el.CID_Value])(el))
        // , R.groupBy(el => el.CEE_Code[0])
        // , R.map(R.groupBy(el => el.CID_ContractOfferID[0]))
        // , R.map(R.map(R.reduce(R.mergeWithKey((k, l, r) => k === 'Value' ? [l[0] + r[0]] : l), {})))
    )(res)
    return [resObject]
}

module.exports = {getConnection, query, getJsonData, getTableData, getTableMetaData, getAllTables
    , getXmlData, getLookUps, getCountries, getFilteredDataSet, closeConnection
    , getCallCallPhase, getContractId, getContractItemDetail
    , getCallExpenseDescription, getCallAction, getBudgetSummary
    , getCallData
}
