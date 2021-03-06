const R = require('ramda')

const variableList = function (metaField, callPath, valField, titleField) {
    return function (metadata, callData) {
        var index = metadata.columns.findIndex(function (el) {
            return el.name == metaField
        })
        if (index < 0) { return metadata }

        var column = metadata.columns[index]
        //var list = resolve(callPath, callData);
        const list = R.path(callPath.split('.'), callData)

        column.items = list && list.map( el => ({ val: el[valField], lab: el[valField] + ' - ' + el[titleField] }) )

        return metadata
    }
}

const expenseType = variableList('Comments13', 'tab6.KATHGORIES_DAPANON_OBJ.KATHGORIES_DAPANON_LIST', 'AA', 'title')
const criterionType = variableList('Comments1', 'tab8.critiria', 'aa', 'name')
const onOffType = variableList('Comments1', 'tab8.onOff', 'aa', 'name')


const ratio = function ratio(metadata, callData) {
        var ratioList = callData.tab3;
        var ratioListSize = ratioList.length;
        var columnTypeInfo = [
            { name: "Comments", length: 13 },
            { name: "DecVal", length: 10 },
            { name: "CpCode", length: 10 }
        ];

 

        if (ratioListSize == 0) {
            return metadata;
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

 

        columnTypeInfo.map(function hideColumns(el) {
            ratioListSize = (el.name === "CpCode") ? (ratioListSize + 1) : ratioListSize
            for (var i = ratioListSize; i < el.length; i++) {
                var nameOfIndex1 = el.name + (i + 1);
                var index1 = metadata.columns.findIndex(function (el1) {
                    return el1.name == nameOfIndex1;
                });
                var columnToHide = metadata.columns[index1];
                columnToHide.view = '';
                columnToHide.edit = '';
            }
            return metadata;
        });

 

        return metadata;
    }
	
var specialMerge = R.curry(function specialMerge(callData, metadata) {
    var transformationArray = {
        GenericCheckpoints_qCategory74_c204: [ratio]
        , GenericCheckpoints_qCategory74_c204_p2061: [ratio]
        , GenericCheckpoints_qCategory74_c204_p2073: [ratio]
        , GenericCheckpoints_qCategory74_c204_p2125: [ratio]
        , GenericCheckpoints_qCategory74_c204_p2178: [ratio]
        , GenericCheckpoints_qCategory74_c204_p2179: [ratio]
        // , GenericCheckpoints_qCategoryPreLast_c204: [attachmentInfo]
        , GenericCheckpoints_qCategory81_c204: [expenseType] //, budgetRules]
        , GenericCheckpoints_qCategory411_c204: [onOffType]
        , GenericCheckpoints_qCategory412_c204: [criterionType] //, evaluation]
        , GenericCheckpoints_qCategory411_c204_p2073: [onOffType] //, evaluation]
        , GenericCheckpoints_qCategory412_c204_p2073: [criterionType] //, evaluation]
        , GenericCheckpoints_qCategory411_c204_p2125: [onOffType] //, evaluation]
        , GenericCheckpoints_qCategory412_c204_p2125: [criterionType] //, evaluation]
    }

    var transformationChain = transformationArray[metadata.customise] || []
    transformationChain.push(mergeCompiledData(metadata.customise));

    (metadata.extraCustomise || []).map(function (customiser) {
        transformationChain.push(mergeCompiledData(customiser))
    })

    //call each function in transformationChain and transform metadata sequentially
    return transformationChain.reduce(function (res, transformation) {
        return transformation(res, callData)
    }, metadata)

})

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

    // if hiddenColumns, hide all weakColumns
    // exclude from hiding the columns that are in showColumns
    // exclude from hiding the columns that are explicitly declared
    // default to [] when columns undefined
    const hiddenColumns = strong.hiddenColumns == '*' ? R.pluck('name', weak.columns || []) : strong.hiddenColumns || []
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
const mergeCompiledData = function (mergeWith) {
    const merged = function (metaData, callData) {
        return merge(metaData, callData.compiled[mergeWith])
    }

    if (merged.hidden == '1') {
        merged.columns = R.map(a => ({name: a.name, view: '', edit: ''}))(merged.columns || [])
    }
    return merged
}

module.exports = {specialMerge}
