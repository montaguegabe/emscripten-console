'use strict';

$(document).ready(function() {

    // Front end
    var consoleElement = $('#console');
    var output = $('.console-line').last();
    var underscoreShown = false;
    var consoleHistory = [];
    var consoleHistoryIndex = -1;

    // Input
    var cinString = '';
    var cinIndex = 0;
    var prevNull = false; // Last inputted was null

    // Logical
    var emscriptenModule;
    var prompt = 'Emscripten:/$ ';

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

    function clear() {
        $('.console-line').remove();
        newlineConsole(false);
    }

    function toggleUnderscore() {
        if (underscoreShown) {
            // Remove the last character
            output.text(output.text().slice(0, -1));
        } else {
            // Add an underscore
            output.text(output.text() + '_');
        }
        underscoreShown = !underscoreShown;
    }

    function modifyConsoleString(modifier) {
        var quickToggle = underscoreShown;
        if (quickToggle) {
            toggleUnderscore();
        }
        output.text(modifier(output.text()));
        if (quickToggle) {
            toggleUnderscore();
        }
    }

    function processConsoleString(processer) {
        var quickToggle = underscoreShown;
        if (quickToggle) {
            toggleUnderscore();
        }
        var result = processer(output.text());
        if (quickToggle) {
            toggleUnderscore();
        }
        return result;
    }

    function appendToConsole(str, andCin) {
        modifyConsoleString(function(consoleLine) {
            if (andCin) {
                cinString += str;
            }
            return consoleLine + str;
        });
    }

    function backspaceConsole() {
        modifyConsoleString(function(consoleLine) {
            if (cinString.length == 0) {
                return consoleLine;
            }
            cinString = cinString.slice(0, -1);
            return consoleLine.slice(0, -1);
        });
    }

    // Scroll to bottom of page
    function scrollToBottom() {
        $('html, body').animate({
            scrollTop: $(document).height()
        }, 0);
    }

    function newlineConsole(submitInput) {

        consoleHistoryIndex = -1;

        var quickToggle = underscoreShown;
        if (quickToggle) {
            toggleUnderscore();
        }

        // Append a new line element
        var lineElement = $('<div />', {
            'class': 'console-line'
        });
        consoleElement.append(lineElement);
        output = $('.console-line').last();

        scrollToBottom();

        if (quickToggle) {
            toggleUnderscore();
        }

        if (submitInput) {
            switch(window._EmscriptenConsoleState) {
                case ConsoleStates.RUN:

                    // Send existing line to standard in.
                    prevNull = false;
                    window._EmscriptenConsolePaused = false;
                    break;

                case ConsoleStates.IDLE:

                    // Send existing line to our bogus linux system.
                    callMockSystemCommand(cinString);
                    break;
                default:
                    break;
            }
        } else if (window._EmscriptenConsoleState === ConsoleStates.IDLE) {
            appendToConsole(prompt, false);
        }

        // Reset input unless we are running a program
        if (window._EmscriptenConsoleState !== ConsoleStates.RUN) {
            cinString = '';
            cinIndex = 0;
        }
    }

    function callMockSystemCommand(command) {

        if (!command) {
            appendToConsole(prompt, false);
            return;
        }

        consoleHistory.unshift(command);

        // Parse bogus linux into command arguments
        var args = command.split(' ');
        var command = args.shift();

        if (command == 'load') {
            loadAsm(args[0]);
        } else if (command == 'clear') {
            clear();
        } else if (command in window._EmscriptenConsoleModules) {
            runAsm(command, args);
        } else {
            appendToConsole('Command not found: ' + command);
            newlineConsole(false);
        }
    }

    var activeProgram = '';
    function loadAsm(name) {

        window._EmscriptenConsoleState = ConsoleStates.LOAD;
        emscriptenSetStatus('Downloading...');

        // Reset the active module
        activeProgram = name;

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
            window.setTimeout(function() { loadAsmJsComplete(true); }, 10);
        })
        .fail(function(jqxhr, settings, exception) {
            loadAsmJsComplete(false);
        });
    }

    // Functions used in the Emscipten module definition
    var lastUpdate = Date.now();
    function emscriptenSetStatus(text) {
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
    function loadAsmJsComplete(success) {

        if (!success) {
            window._EmscriptenConsoleState = ConsoleStates.IDLE;
            emscriptenSetStatus('Error: Failed to load command ' + activeProgram + '.');
            return;
        }

        // Create the module
        window._EmscriptenConsoleModules[activeProgram] = window[activeProgram]({
            stdin: emscriptenCin,
            stdout: emscriptenCout,
            stderr: emscriptenCout,
            postRun: [function() {setTimeout(loadAsmRuntimeComplete, 10)}],
            noInitialRun: true,
            totalDependencies: 0,
            thisProgram: '/' + activeProgram,
            monitorRunDependencies: function(left) {
                this.totalDependencies = Math.max(this.totalDependencies, left);
                var depString = 'Preparing... (' + (this.totalDependencies - left) + '/' + this.totalDependencies + ')';
                var now = Date.now();
                if (now - lastUpdate < 1000) return;
                lastUpdate = now;
                emscriptenSetStatus(depString);
            }
        });

    }

    function loadAsmRuntimeComplete() {
        window._EmscriptenConsoleState = ConsoleStates.IDLE;
        emscriptenSetStatus('Successfully loaded module ' + activeProgram);

        var readyModule = window._EmscriptenConsoleModules[activeProgram];
        activeProgram = null;
    }

    function resetModule(programName) {
        // Recreate the module
        window._EmscriptenConsoleModules[programName] = window[programName]({
            stdin: emscriptenCin,
            stdout: emscriptenCout,
            stderr: emscriptenCout,
            postRun: [function() { runAsm(programName); }],
            noInitialRun: true,
            totalDependencies: 0,
            thisProgram: '/' + programName,
        });
    }

    function runAsm(programName, args) {
        var activeModule = window._EmscriptenConsoleModules[programName];
        if (activeModule === null) {
            resetModule(programName);
            return;
        }
        activeProgram = programName;

        // Mount shared files
        var FS = activeModule.FS;
        FS.mkdir('/shared');
        FS.mount(activeModule.IDBFS, {}, '/shared');
        FS.syncfs(true, function (err) {
            if (err) emscriptenSetStatus(err);
            return;
        });
        FS.chdir('/shared');

        console.log(FS.root.contents);
        console.log(window._EmscriptenConsoleModules[programName].FS.root.contents);

        console.log('Attempting to run program ' + programName + '...');
        window._EmscriptenConsoleState = ConsoleStates.RUN;
        activeModule.callMain(args);
    }

    function terminateAsm() {
        var activeModule = window._EmscriptenConsoleModules[activeProgram];

        // Abort execution
        try {
            activeModule.abort(100)
        } catch(e) {
            if (e.slice(0,10) != 'abort(100)') {
                throw e;
            }
        }
        _EmscriptenConsolePaused = false;

        // Save files
        var FS = activeModule.FS;
        FS.syncfs(function (err) {
            if (err) emscriptenSetStatus(err);
        });

        // Mark program for reload
        window._EmscriptenConsoleModules[activeProgram] = null;
        activeProgram = null;
    }

    // Trigger underscore toggling
    window.setInterval(toggleUnderscore, 500);

    // Keyboard input
    $(document).keydown(function(e) {
        var key = e.keyCode || e.charCode;
        switch (key) {
            case 8:
            case 46:
                backspaceConsole();
                e.preventDefault();
                break;

            // Control-C
            case 67:
                if (e.ctrlKey) {
                    appendToConsole('^C', false);
                    if (window._EmscriptenConsoleState == ConsoleStates.RUN) {
                        terminateAsm();
                        window._EmscriptenConsoleState = ConsoleStates.IDLE;
                    }
                    newlineConsole(false);

                    // Don't allow this charater to be passed on.
                    e.preventDefault();
                }
                break;

            // Command-K to clear
            case 75:
                if (e.metaKey) {
                    clear();
                    e.preventDefault();
                }
                break;

            // Up key
            case 38:
                if (_EmscriptenConsoleState == ConsoleStates.IDLE) {
                    if (!consoleHistory.length) break;
                    consoleHistoryIndex += 1;
                    if (consoleHistoryIndex >= consoleHistory.length) {
                        consoleHistoryIndex = consoleHistory.length - 1;
                    }
                    cinString = consoleHistory[consoleHistoryIndex];
                    cinIndex = 0;
                    modifyConsoleString(function(str) { return prompt + cinString; });
                    e.preventDefault();
                }
                break;

            // Down key
            case 40:
                if (_EmscriptenConsoleState == ConsoleStates.IDLE) {
                    if (!consoleHistory.length) break;
                    consoleHistoryIndex -= 1;
                    if (consoleHistoryIndex < 0) {
                        consoleHistoryIndex = 0;
                    }
                    cinString = consoleHistory[consoleHistoryIndex];
                    cinIndex = 0;
                    modifyConsoleString(function(str) { return prompt + cinString; });
                    e.preventDefault();
                }
                break;
        }
    });

    $(document).keypress(function(e) {
        var charCode = e.keyCode || e.which;
        switch (charCode) {
            case 13:
                newlineConsole(true);
                break;
            default:
                var charStr = String.fromCharCode(charCode);
                appendToConsole(charStr, true);
                scrollToBottom();
                break;
        }
    });

    // Hack to print
    var promptSave = prompt;
    prompt = '';
    newlineConsole(false);
    appendToConsole('Emscripten Console ' + window._EmscriptenConsoleVersion, false); newlineConsole(false);
    appendToConsole('Commands:', false); newlineConsole(false);
    appendToConsole('   load <command> : Loads a command (emscripten JS file) from the build directory.', false); newlineConsole(false);
    appendToConsole('   <command>      : Runs a loaded command.', false); newlineConsole(false);
    appendToConsole('Controls:', false); newlineConsole(false);
    appendToConsole('   Up/Down        : Console history', false); newlineConsole(false);
    appendToConsole('   Ctrl-C         : Terminates a command', false); newlineConsole(false);
    appendToConsole('   Cmd-K          : Clear', false); newlineConsole(false);
    prompt = promptSave;
    newlineConsole(false);
});
