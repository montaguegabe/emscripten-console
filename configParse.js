// Parses an Emscripten configuration file into a shell command.
// A dependency for the Gruntfile.

var gruntRoot = __dirname;

// Returns the compiling command line string resulting from the configuration file
function parseConfig(configFile, grunt) {

    // Parse file to relaxed JSON
    var fs = require('fs');
    var JSON5 = require('json5');
    var _ = require('lodash');
    var path = require('path');

    // Read content from JSON
    var content = fs.readFileSync(configFile);
    var userSettings = JSON5.parse(content);

    var executableName = userSettings.executableName || "executable";
    var buildDir = userSettings.buildDir || "build/";
    var fullOptimize = false;

    var emccOptions = userSettings.emccOptions || [];
    var sourceFiles = userSettings.sourceFiles || [];
    var preloadFiles = userSettings.preloadFiles || [];
    var embedFiles = userSettings.embedFiles || [];
    var cOptions = userSettings.cOptions || [];

    // Check proper formatting
    if (_.find([emccOptions, sourceFiles, preloadFiles, embedFiles, cOptions], predicate = function(object) {
            return !Array.isArray(object);
        })) {
        grunt.fail.warn("Invalid type for object in source JSON file. Make sure EMCC files and options are specified as arrays.");
    }

    // Check optimization level - affects console behavior
    if (_.includes(emccOptions, '-O3')) {
        fullOptimize = true;
    }

    // Provide defaults ENTERPRETIFY options - console requires interpreting of bytecode
    emccOptions.push('-s EMTERPRETIFY=1', '-s EMTERPRETIFY_ASYNC=1');
    if (!_.find(emccOptions, function(optionString) {
            var sOptionName = optionString.split(/[\s='"]+/)[1];
            return sOptionName == 'EMTERPRETIFY_WHITELIST' || sOptionName == 'EMTERPRETIFY_BLACKLIST';
        })) {
        // Provide default option of whitelist
        emccOptions.push("-s EMTERPRETIFY_WHITELIST='[\"_main\",\"__ZN14adaptedConsole17EmscriptenIStreamrsINSt3__112basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEEERNS2_13basic_istreamIcS5_EERT_\",\"__ZN14adaptedConsole17EmscriptenIStreamrsIjEERNSt3__113basic_istreamIcNS2_11char_traitsIcEEEERT_\",\"__ZN14adaptedConsole17EmscriptenIStreamrsIdEERNSt3__113basic_istreamIcNS2_11char_traitsIcEEEERT_\"]'");
    }

    // Provide modularization settings
    emccOptions.push('-s EXPORT_NAME=\'"' + executableName + '"\'', '-s MODULARIZE=1');

    // Necessary initialization function to signal loading complete
    if (_.find(emccOptions, function(optionString) {
            var optionName = optionString.split(' ')[0];
            return optionName == '--post-js';
        })) {
        grunt.fail.warn("You may not specify the --post-js option when using with the console.");
    }
    emccOptions.push('--post-js ' + path.join(gruntRoot, 'postLoad.js'));

    // Provide the shell file if not specified
    if (!_.find(emccOptions, function(optionString) {
            var optionName = optionString.split(' ')[0];
            return optionName == '--shell-file';
        })) {
        var defaultShellPath = path.join(gruntRoot, 'shell', 'empty.html');
        emccOptions.push('--shell-file ' + defaultShellPath);
    }

    // Provide the C++ IO library
    sourceFiles.push(path.join(gruntRoot, 'library', 'AdaptedConsole.cpp'));
    cOptions.push('-I' + path.join(gruntRoot, 'library'));

    // Join given options
    var accumulatedOptionsStr = _.join(_.concat(emccOptions, cOptions), ' ');

    // Add console library, then translate to string
    var sourceFilesStr = _.join(sourceFiles, ' ');

    // Translate preloaded, embedded files to strings
    var preloadFilesStr = _.join(_.map(preloadFiles, function(configRelPath) {
        return '--preload-file ' + configRelPath;
    }), ' ');
    var embedFilesStr = _.join(_.map(embedFiles, function(configRelPath) {
        return '--embed-file ' + configRelPath;
    }), ' ');

    // Put it all together into one command
    var aggregateArgs = _.join([accumulatedOptionsStr, preloadFilesStr, embedFilesStr], ' ');
    var outputFile = path.join(buildDir, executableName + '.html');
    var emccCommand = 'emcc ' + aggregateArgs + ' ' + sourceFilesStr + ' -o ' + outputFile;

    result = {
        command: emccCommand,
        buildDir: buildDir,
        executableName: executableName,
        fullOptimize: fullOptimize
    }

    return result;
}

module.exports = {
    parseConfig: parseConfig
};

