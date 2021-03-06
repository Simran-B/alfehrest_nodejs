'use strict';

var cfg = framework.helpers.settings.get("database");
var modelHelper = framework.helpers.model;
var db = modelHelper.getDatabase();

function create(language, props) {

    var className = this.getEntityName().toLowerCase();

    props.id   = modelHelper.UID(this.getEntityName());
    try {
        props = modelHelper.cleanForm(this.getEntitySchema(), language, props);
    } catch(e) {
        return Promise.reject(e);
    }

    props._key = props.id;
    props._entity_type = className;

    return new Promise(function(resolve, reject){
        db.collection(cfg.entity_collection).save(props).then(
            result => { resolve({id : props.id}); },
            err => { reject(err); }
        );
    });
}

function update(language, id, data) {

    delete data['id'];

    var entityName = this.getEntityName();
    var eCol = cfg.entity_collection;

    try {
        data = JSON.stringify(modelHelper.cleanForm(this.getEntitySchema(), language, data, true));
    } catch(e) {
        return Promise.reject(e);
    }

    var query = `UPDATE '${id}' WITH ${data} IN ${eCol}`;

    return modelHelper.executeQuery(query);
}

function remove(id) {

    var eCol = cfg.entity_collection;
    var rCol = cfg.relation_collection;

    var queries = [];
    queries.push(`
        FOR r IN ${rCol}
            FILTER r._from == '${eCol}/${id}' || r._to == '${eCol}/${id}'
            REMOVE r IN ${rCol}`
    );
    queries.push(`REMOVE '${id}' IN ${eCol}`);

    return modelHelper.executeQueries(queries);
}

function getRelated(language, id, types) {

    var eCol = cfg.entity_collection;
    var rCol = cfg.relation_collection;

    let e1FilterClause = '';
    let e2FilterClause = '';
    let e1Filters = [];
    let e2Filters = [];
    for(let i=0; i<types.length; i++) {
        let t = types[i];
        e1Filters.push(`e1._entity_type == "${t}"`);
        e2Filters.push(`e2._entity_type == "${t}"`);
    }
    if(types.length) {
        e1FilterClause = " AND (" + e1Filters.join(" OR ") + ")";
        e2FilterClause = " AND (" + e2Filters.join(" OR ") + ")";
    }


    var query = `
        LET eid = '${id}'
        LET r_outgoing = (
            FOR r1 IN ${rCol} 
                FILTER r1._from == CONCAT('${eCol}/', eid) 
                FOR e1 IN ${eCol}
                    FILTER 
                        e1._key == r1.secondEntityId 
                    ${e1FilterClause}
            RETURN {'relationship': r1, 'entity': e1}
        )
        LET r_incoming = (
            FOR r2 IN ${rCol} 
                FILTER r2._to == CONCAT('${eCol}/', eid) 
                FOR e2 IN ${eCol}
                    FILTER 
                        e2._key == r2.firstEntityId 
                    ${e2FilterClause}
            RETURN {'relationship': r2, 'entity': e2}
        )
        
        LET e = (FOR e in ${eCol} FILTER e._key == eid RETURN e)
        RETURN {
            'entity': e[0],
            'relationships': {
                'incoming': r_incoming,
                'outgoing': r_outgoing
            }
        }`;

    return new Promise(function(resolve, reject){
        modelHelper.getOneRecord(query).then(
            record => {
                var modelHelper = framework.helpers.model;
                if(record.entity) {
                    try {
                        modelHelper.prepareEntityRecord(record, language);
                    } catch (e) {
                        return reject(e);
                    }
                } else {
                    return reject(framework.error(1, 404, 'Not Found'));
                }
                resolve(record);
            },
            err => {reject(err)}
        );
    });

}

function getFields(language, id, fields) {

    let eCol = cfg.entity_collection;
    let rCol = cfg.relation_collection;
    let schema = this.getEntitySchema();
    let jsonPairs = [];

    for(let i=0; i<fields.length; i++) {
        let f = fields[i];
        if( !(f in schema)) {
            return Promise.reject(framework.error(1, 400, `Invalid field ${f}`));
        }
        let fieldMeta = schema[f];
        let path = `e.${f}`;
        if(fieldMeta.translatable) {
            path = `e.strings.${language}.${f}`;
        }
        jsonPairs.push(`'${f}': ${path}`);
    }
    let jsonString = jsonPairs.join(',');

    var query = `
    FOR e in ${eCol} 
        FILTER e._key == '${id}' 
    RETURN {
        'id': e._key,
        ${jsonString}
    }`;

    return new Promise(function(resolve, reject){
        modelHelper.getOneRecord(query).then(
            record => {
                var modelHelper = framework.helpers.model;
                if(!record) {
                    return reject(framework.error(1, 404, 'Not Found'));
                }
                resolve(record);
            },
            err => {reject(err)}
        );
    });
}

function getOne(language, id, fields) {

    var eCol = cfg.entity_collection;
    var rCol = cfg.relation_collection;

    if(fields.length) {
        return getFields.call(this, language, id, fields);
    }

    var query = `
    LET eid = '${id}'
    LET r_outgoing = (
        FOR r1 IN ${rCol} 
            FILTER r1._from == CONCAT('${eCol}/', eid) 
        RETURN {'entity':null, 'relationship': r1}
    )
    LET r_incoming = (
        FOR r2 IN ${rCol} 
            FILTER r2._to == CONCAT('${eCol}/', eid) 
        RETURN {'entity': null, 'relationship': r2 }
    )
    LET e = (FOR e in ${eCol} FILTER e._key == eid RETURN e)
    RETURN {
        'entity': e[0],
        'relationships': {
            'incoming': r_incoming,
            'outgoing': r_outgoing
        }
    }`;

    return new Promise(function(resolve, reject){
        modelHelper.getOneRecord(query).then(
            record => {
                var modelHelper = framework.helpers.model;
                if(record.entity) {
                    try {
                        modelHelper.prepareEntityRecord(record, language);
                    } catch (e) {
                        return reject(e);
                    }
                } else {
                    return reject(framework.error(1, 404, 'Not Found'));
                }
                resolve(record);
            },
            err => {reject(err)}
        );
    });

}

function getAll(language) {

    var entityName = this.getEntityName();
    var nameField = this.getNameField();
    var eCol = cfg.entity_collection;

    var query = `
        FOR e in ${eCol}
            FILTER e._entity_type == '${entityName}'
        RETURN {id: e.id, name: e.strings['${language}']['${nameField}'], entity_type: e._entity_type}
    `;

    return modelHelper.getAllRecords(query);
}

function getEntityName() { return "Node"; }

function getNameField() { return "name"; }

function getRelationshipSchema() { return {}; }

function getEntitySchema() { return {}; }

function getPreparedRelationshipSchema(language) {

    var entitySchema = this.getEntitySchema();
    var relationshipSchema = this.getRelationshipSchema();

    return new Promise(function(resolve, reject){
        getAllIds(language).then(
            data => {
                var entityCache = data;
                var list = {};

                for(var idx in relationshipSchema) {

                    list[idx] = {
                        "secondEntityId": {
                            label: 'الكيان المرتبط',
                            type: 'List',
                            elements: entityCache[idx] || []
                        },
                        "types": relationshipSchema[idx]
                    };

                }

                resolve({
                    "entity": entitySchema,
                    "relationships": list
                });

            },
            err => {reject(err)}
        );
    });
}



function getAllIds(language) {

    var generalSettings = framework.helpers.settings.get("general");
    var nameFields = {};
    for(var i=0; i<generalSettings.entities.length; i++) {
        var model = framework.helpers.model.get(generalSettings.entities[i]);
        nameFields[generalSettings.entities[i]] = model.getNameField();
    }

    var nameFieldObj = JSON.stringify(nameFields);
    var eCol = cfg.entity_collection;

    var results = {};
    var query = `
        LET nameFields = ${nameFieldObj}
        FOR e in ${eCol}
        RETURN {id: e.id, name: e.strings['${language}'][nameFields[e._entity_type]], entity_type: e._entity_type}
    `;

    return new Promise(function(resolve, reject){
        modelHelper.getAllRecords(query)
            .then(
                records => {
                    for(var i=0; i<records.length; i++) {
                        var record = records[i];
                        if(!results[record.entity_type]) {
                            results[record.entity_type] = {}
                        }
                        results[record.entity_type][record.id] = record.name;
                    }
                    resolve(results);
                },
                err => {reject(err)}
            );
    });
}

function EntityModel() {

    this.create = create;
    this.update = update;
    this.remove = remove;
    this.getOne = getOne;
    this.getRelated = getRelated;
    this.getAll = getAll;

    this.getEntityName = getEntityName;
    this.getNameField  = getNameField;
    this.getRelationshipSchema = getRelationshipSchema;
    this.getEntitySchema = getEntitySchema;

    this.getPreparedRelationshipSchema = getPreparedRelationshipSchema;

}

//Static Methods
EntityModel.getAllIds = getAllIds;

module.exports = EntityModel;
