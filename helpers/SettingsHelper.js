'use strict';

var SettingsHelper = {};

var path = require("./PathHelper.js");

SettingsHelper.get = function(file, key, inEnv) {

    var config = require(path.settings(file));

    var env = inEnv || framework.env;

    if( !(env in config) ){
        throw new Error(`No configurations were found for environment ${env} in config file ${config}`);
    }

    config = config[env];

    if(!key || key == null) {
        return config;
    }

    if(!(key in config)){
        throw new Error(`Value ${key} was not found in environment ${env} in config file ${config}`);
    }
    return config[key];
};


module.exports = SettingsHelper;
