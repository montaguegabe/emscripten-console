module.exports = function(grunt) {

    var path = require('path');
    var configParse = require('./configParse');
    var package = grunt.file.readJSON("package.json");
    var injectSettings = require('./injectSettings')

    // The default config file is in the parent directory
    var configFile = grunt.option('config') || '../Emscripten.config';
    var configTarget = grunt.option('target') || null;
    var configRoot = path.dirname(configFile);

    // Get information (most importantly compile command) from the source-specific settings
    var sourceConfig = configParse.parseConfig(configFile, configTarget, grunt);
    var buildDir = path.join(configRoot, sourceConfig.buildDir);
    var compileCommand = sourceConfig.command;

    grunt.initConfig({
        shell: {
            build: {
                cwd: configRoot,
                command: compileCommand
            }
        },
        copy: {
            build: {
                cwd: 'shell',
                expand: true,
                src: ['./*', '!./empty.html'],
                dest: buildDir,
            }
        },
        clean: {
            options: { force: true },
            build: { src: path.join(buildDir, sourceConfig.executableName + '.html') }
        },
        connect: {
            server: {
                base: buildDir,
                port: 3000
            }
        }
    });

    // Tasks
    grunt.loadNpmTasks('grunt-shell');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-connect');

    grunt.registerTask('build', function() {
        grunt.log.writeln('Compiling console page...');
        grunt.log.writeln(compileCommand);
        grunt.task.run('shell:build');
        grunt.task.run('copy:build');
        grunt.task.run('clean:build');

        // Inject settings into JS file
        settings = {
            _EmscriptenConsoleFullOpt: sourceConfig.fullOptimize,
            _EmscriptenConsoleVersion: package.version
        };
        injectSettings.generateFile(settings, path.join(buildDir, 'inject.js'), grunt);
    });

    grunt.registerTask('help', function() {
        grunt.log.writeln('Call \'grunt build\' to build the webpage. Specify a configuration file path with the --config option. By default a config file will be looked for in the parent directory as \'../Emscripten.config\'.');
        grunt.log.writeln('You can also use \'grunt connect\' to serve the built page.');
    })

    grunt.registerTask('bc', ['build', 'connect']);
    grunt.registerTask('cc', ['copy', 'connect']);
    grunt.registerTask('default', ['help']);
};