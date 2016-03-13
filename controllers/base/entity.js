
function EntityController(app, router) {

    var language = framework.currentLanguage;

    var getEntityName = this.getEntityName || function() { return null; };

    function getDatabase() { return framework.helpers.model.getDatabase(); }

    function loadEntityModel(entityName) { return framework.helpers.model.get(entityName); }

    function loadModel() { return loadEntityModel(getEntityName());}

    function post(req, res, next) {

        //TODO : Make creation transactional

        var model = loadModel();

        var relationships = req.body.relationships;
        delete req.body.relationships;

        var newEntityId = null;
        model.create(language, req.body)
        .then(
            data => {
                newEntityId = data.id;

                if(!relationships){
                    res.send({id: newEntityId});
                    return;
                }

                for (var i=0; i<relationships.length; i++) {
                    relationships[i].first_entity_id = newEntityId;
                }

                var model = loadEntityModel('relationship');
                return model.create(language, newEntityId, relationships, false);
            },
            err => { next(err); }
        )
        .then(
            data => { res.send({id: newEntityId})},
            err => { next(err); }
        );

    }

    function getAll(req, res, next) {

        var model = loadModel();

        model.getAll(language).then(
            data => { res.send(data); },
            err => { next(err); }
        );

    }

    function getOne(req, res, next) {

        var id = req.params.id;
        var entityType = getEntityName();
        if(!id.startsWith(entityType)) {
            return next(framework.error(1, 404, 'Not Found'));
        }

        var model = loadModel();

        model.getOne(language, id)
        .then(
            data => { res.send(data); },
            err => { next(err); }
        );

    }

    function update(req, res, next){

        var id = req.body.id;
        var entityType = getEntityName();
        if(!id.startsWith(entityType)){
            return next(framework.error(1, 404, 'Not Found'));
        }

        var entityModel = loadModel();
        var relationshipModel = loadEntityModel('relationship');

        var incomingRelationships = req.body.relationships;
        delete req.body.relationships;

        Promise.all([
            entityModel.update(language, id, req.body),
            relationshipModel.update(language, id, incomingRelationships)
        ])
        .then(
            results => { res.status(204).send(); },
            err => { next(err); }
        );

    }

    function remove(req, res, next){

        var id = req.body.id;
        var entityType = getEntityName();
        if(!id.startsWith(entityType)){
            return next(framework.error(1, 404, 'Not Found'));
        }

        var model = loadModel();

        model.remove(id).then(
            data => { res.status(204).send(); },
            err => { next(err); }
        );

    }

    function getSchema(req, res, next) {

        var entityType = getEntityName();
        var db = getDatabase();
        var model = loadModel();

        model.getPreparedRelationshipSchema(language).then(
            data => { res.send(data); },
            err => { next(err); }
        );

    }

    router.get('/' + getEntityName() + '/schema/', getSchema);
    router.get('/' + getEntityName() + '/:id/', getOne);
    router.get('/' + getEntityName() + '/', getAll);
    router.post('/' + getEntityName() + '/', post);
    router.delete('/' + getEntityName() + '/', remove);
    router.put('/' + getEntityName() + '/:id/', update);

}

module.exports = EntityController;