module.exports = function(grunt) {

  var _ = require('lodash');
  var path = require('path');

  var configFile = grunt.option('config') || '../Emscripten.json';
  var configRoot = path.dirname(configFile);
  var gruntRoot = __dirname;

  grunt.initConfig({
    emccCommand: 'emcc',
    shell: {
      build: {
        cwd: configRoot,
        command: '<%= emccCommand %>'
      }
    }
  });

  // Build the shell command

  // Merge options from source configuration
  var userSettings = grunt.file.readJSON(configFile);
  var executableName = userSettings.executableName || "executable";
  var buildDir = userSettings.buildDir || "build/";

  var emccOptions = userSettings.emccOptions || [];
  var sourceFiles = userSettings.sourceFiles || [];
  var preloadFiles = userSettings.preloadFiles || [];
  var embedFiles = userSettings.embedFiles || [];
  var cOptions = userSettings.cOptions || [];

  // Check that all are arrays
  if (_.find([emccOptions, sourceFiles, preloadFiles, embedFiles, cOptions], predicate=function(object) {
    return !Array.isArray(object);
  })) {
    grunt.fail.warn("Invalid type for object in source JSON file. Make sure EMCC files and options are specified as arrays.");
  }

  // Provide defaults ENTERPRETIFY options - console requires interpreting of bytecode
  emccOptions.push('-s EMTERPRETIFY=1', '-s EMTERPRETIFY_ASYNC=1');
  if (!_.find(emccOptions, function(optionString) {
    var sOptionName = optionString.split(/[\s='"]+/)[1];
    return sOptionName == 'EMTERPRETIFY_WHITELIST' || sOptionName == 'EMTERPRETIFY_BLACKLIST';
  })) {
    // Provide defualt option of whitelist
    emccOptions.push("-s EMTERPRETIFY_WHITELIST='[\"_main\"]'");
  }

  // Provide the shell file if not specified
  if (!_.find(emccOptions, function(optionString) {
    var optionName = optionString.split(' ')[0];
    return optionName == '--shell-file';
  })) {
    var defaultShellPath = path.join(gruntRoot, 'shells', 'terminal.html');
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

  // Put it all together into one command and send it off to Grunt for possible execution.
  var aggregateArgs = _.join([accumulatedOptionsStr, preloadFilesStr, embedFilesStr], ' ');
  var outputFile = path.join(buildDir, executableName) + '.html';
  var emccCommand = 'emcc ' + aggregateArgs + ' ' + sourceFilesStr + ' -o ' + outputFile;
  grunt.config('emccCommand', emccCommand);

  grunt.loadNpmTasks('grunt-shell');

  grunt.registerTask('build', function() {
    grunt.log.writeln('Compiling console page...');
    grunt.log.writeln(grunt.config('emccCommand'));
    grunt.task.run('shell:build');
  });
  grunt.registerTask('default', ['build']);
};