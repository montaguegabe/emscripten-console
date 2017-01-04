module.exports = function(grunt) {

    var path = require('path');
    var configParse = require('./configParse')

    // The default config file is in the parent directory
    var configFile = grunt.option('config') || '../Emscripten.config';
    var configRoot = path.dirname(configFile);

    grunt.initConfig({
        compileCommand: '',
        buildDir: '',
        executableName: '',
        shell: {
            build: {
                cwd: configRoot,
                command: '<%= compileCommand %>'
            }
        },
        copy: {
            build: {
                cwd: 'shell',
                expand: true,
                src: ['./*', '!./empty.html'],
                dest: path.join(configRoot, '<%= buildDir %>'),
            }
        },
        clean: {
            options: { force: true },
            build: { src: path.join(configRoot, '<%= buildDir %>', '<%= executableName %>') + '.html' }
        }
    });

    // Build the shell command and get the output directory location
    var result = configParse.parseConfig(configFile);
    grunt.config('compileCommand', result.command);
    grunt.config('buildDir', result.buildDir);
    grunt.config('executableName', result.executableName);

    // Tasks
    grunt.loadNpmTasks('grunt-shell');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');

    grunt.registerTask('build', function() {
        grunt.log.writeln('Compiling console page...');
        grunt.log.writeln(grunt.config('compileCommand'));
        grunt.task.run('shell:build');
        grunt.task.run('copy:build');
        grunt.task.run('clean:build');
    });

    grunt.registerTask('help', function() {
        grunt.log.writeln('Call \'grunt build\' to build the webpage. Specify a configuration file path with the --config option. By default a config file will be looked for in the parent directory as \'../Emscripten.config\'.');
    })

    grunt.registerTask('default', ['help']);
};