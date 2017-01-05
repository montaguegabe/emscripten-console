'use strict';

(function(){

    // Logical OS
    var prompt = 'Emscripten:/$ ';
    var loadName = '';

    // The current state of the console
    var ConsoleStates = {
        IDLE: 0,
        RUN: 1,
        LOAD: 2
    }
    window._EmscriptenConsoleState = ConsoleStates.IDLE;

    // The currently loaded modules
    window._EmscriptenConsoleModules = {};

    // Accessed by C/C++ code to indicate that the user should provide input
    window._EmscriptenConsolePaused = false;
    window._EmscriptenConsoleGetInput = function() {
        cinString = '';
        cinIndex = 0;
    }

    function submitInput() {
        switch(window._EmscriptenConsoleState) {
            case ConsoleStates.RUN:

                // Send existing line to standard in.
                prevNull = false;
                window._EmscriptenConsolePaused = false;
                break;

            case ConsoleStates.IDLE:

                // Send existing line to our bogus linux system.
                bogusLinux(cinString);
                cinIndex = 0;
                cinString = '';
                break;
            default:
                break;
        }
    }

    function bogusLinux(command) {

        if (!command) {
            appendToConsole(prompt, false);
            return;
        }

        // Parse bogus linux into command arguments
        var args = command.split(' ');
        var command = args.shift();

        if (command == 'load') {
            loadAsm(args[0], args[1] == '-r' || args[1] == '--replace-fs');
        } else if (command in window._EmscriptenConsoleModules) {
            runAsm(command, args);
        } else {
            appendToConsole('Command not found: ' + command);
            newlineConsole(false);
        }
    }

    function loadAsm(name, replaceFileSystem) {

        window._EmscriptenConsoleState = ConsoleStates.LOAD;
        emscriptenSetStatus('Downloading...');

        // Reset the active module
        loadName = name;

        if (window._EmscriptenConsoleFullOpt) {
            (function() {
                var memoryInitializer = name + '.html.mem';
                var xhr = new XMLHttpRequest();
                xhr.open('GET', memoryInitializer, true);
                xhr.responseType = 'arraybuffer';
                xhr.send(null);
            })();
        }
        $.getScript(name + '.js')
        .done(function(script, textStatus) {
            window.setTimeout(function() { postLoadComplete(true); }, 10);
        })
        .fail(function(jqxhr, settings, exception) {
            postLoadComplete(false);
        });
    }

    function runAsm(programName, args) {
        console.log('Attempting to run program ' + programName + '...');
        window._EmscriptenConsoleState = ConsoleStates.RUN;
        //emscriptenResetModule();
        //window.Module = window._EmscriptenConsoleModules[programName];
        //window.Module._main('/' + programName, args[0]);
    }

    function terminateAsm() {
        // Dummy
    }


    var lastUpdate = Date.now();
    function emscriptenSetStatus(text) {
        var now = Date.now();
        if (now - lastUpdate < 1) return;
        lastUpdate = now;
        appendToConsole(text, false);
        newlineConsole(false);
    }

    function emscriptenCin() {
        if (prevNull) return '\n'.charCodeAt(0);
        if (cinIndex < cinString.length) {
            cinIndex++;
            return cinString.charCodeAt(cinIndex - 1);
        } else {
            prevNull = true;
            return null;
        }
    }

    function emscriptenCout(asciiCode) {
        if (asciiCode == 10) {
            newlineConsole(false);
        } else if (asciiCode != 13) {
            appendToConsole(String.fromCharCode(asciiCode), false);
        }
    }

    // Called when a script has been loaded successfully
    function postLoadComplete(success) {

        if (!success) {
            window._EmscriptenConsoleState = ConsoleStates.IDLE;
            emscriptenSetStatus('Error: Failed to load command ' + loadName + '.');
            return;
        }

        // Store the module by its name
        window._EmscriptenConsoleModules[loadName] = window[loadName]({
            preRun: [function() {
                FS.init(emscriptenCin, emscriptenCout, emscriptenCout);
            }],
            // Called after dependencies are loaded
            //postRun: [postLoadComplete],
            noInitialRun: true,
            totalDependencies: 0,
            thisProgram: window._EmscriptenConsoleProgramName,
            monitorRunDependencies: function(left) {
                this.totalDependencies = Math.max(this.totalDependencies, left);
                var depString = 'Preparing... (' + (this.totalDependencies - left) + '/' + this.totalDependencies + ')';
                emscriptenSetStatus(depString);
            }
        });

        window._EmscriptenConsoleState = ConsoleStates.IDLE;
        emscriptenSetStatus('Command ' + loadName + ' successfully loaded.');
    }

    newlineConsole(false);

    // Export JS interface
    window._EMScriptenConsoleOS = {
        
    }
})();
