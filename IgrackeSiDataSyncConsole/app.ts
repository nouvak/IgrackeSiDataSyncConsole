var Promise = require('promise');
var util = require('util');
var mssql = require('mssql');
var logger = require('./log');

var config = require('./config');

mssql.connect(config).then(function () {
    logger.info('Connected to database.');
    loadCategories()
        .then(function (recordset) {
            console.dir(recordset);
        })
        .catch(function (error) {
            logger.error('Igracke.si data sync failed: %s', error);
        });

}).catch(function (err) {
    logger.error('Error connecting to database: %s', err);
});


function loadCategories() {
    var promise = new Promise(function (resolve, reject) {
        new mssql.Request()
            .query('select * from tHE_SetItemCateg')
            .then(function (recordset) {
                var primaryCategories = recordset
                    .filter(function (record) {
                        return record.acShowAtena === 'T' && record.acType === 'P';
                    })
                    .sort(categoryRecordCompare)
                    .map(mapToCategory);
                var secondaryCategories = recordset
                    .filter(function (record) {
                        return record.acShowAtena === 'T' && record.acType === 'S';
                    })
                    .sort(categoryRecordCompare)
                    .map(mapToCategory);
                var mappingIdToIndex = {};
                primaryCategories.forEach(function (primaryCategory, index) {
                    mappingIdToIndex[primaryCategory.id] = index;
                });
                secondaryCategories.forEach(function (secondaryCategory) {
                    var tokens = secondaryCategory.id.split('_');
                    var primaryCategoryId = tokens[0];
                    var primaryCategoryIndex = mappingIdToIndex[primaryCategoryId];
                    primaryCategories[primaryCategoryIndex].subcategories.push(secondaryCategory);
                });
                resolve(primaryCategories);
            })
            .catch(function (err) {
                reject(util.format('Categories load failed: %s', err));
            });
    });
    return promise;
}

function mapToCategory(record) {
    return {
        id: record.acClassif.trim(),
        name: record.acName.trim(),
        subcategories: []
    };
}

function mapToSubcategory(record) {
    return {
        id: record.acClassif.trim(),
        name: record.acName.trim()
    };
}

function categoryRecordCompare(record1, record2) {
    var orderDiff = record1.acATOrder - record2.acATOrder;
    if (orderDiff !== 0) {
        return orderDiff;
    } else {
        return record1.acName.localeCompare(record2.acName);
    }
}

