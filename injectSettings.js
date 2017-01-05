// Allow interface between build settings and browser JS
// A dependency for the Gruntfile.

// Generates a javascript file with build setting injections defined as global variables
function generateFile(settings, injectionFile, grunt) {

    var fs = require('fs');
    var _ = require('lodash');

    var definitions = _.reduce(settings, function(result, value, key) {
        var valueStr = value;
        if (typeof value === 'string' || value instanceof String) {
            valueStr = '\'' + value + '\'';
        }
        return result + 'window.' + key + '=' + valueStr + ';\n';
    }, '');

    fs.writeFile(injectionFile, definitions, 'utf8', function(err) {
        if (err) grunt.fail.fatal(err);
    });
}

module.exports = {
    generateFile: generateFile
};

