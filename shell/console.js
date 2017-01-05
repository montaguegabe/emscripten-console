'use strict';

$(document).ready(function() {
    var consoleElement = $('#console');
    var output = $('.console-line').last();
    var underscoreShown = false;
    var cinString = '';
    var cinIndex = 0;
    var prevNull = false; // Last inputted was null
    var emscriptenModule;
    var prompt = 'Emscripten:~$ ';

    var ConsoleStates = {
        IDLE: 0,
        RUN: 1,
        LOAD: 2
    }
    window._EmscriptenConsoleState = ConsoleStates.IDLE;

    // Accessed by C/C++ code to indicate that the user should provide input
    window._EmscriptenConsolePaused = false;
    window._EmscriptenConsoleGetInput = function() {
        cinString = '';
        cinIndex = 0;
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

    function callMockSystemCommand(command) {

        // Parse bogus linux into command arguments
        var args = command.split(' ');
        var command = args.shift();
        if (command == 'load') {
            loadAsm(args[0]);
        }
        // emscriptenModule.arguments = args;
    }

    function newlineConsole(submitInput) {

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
                    cinIndex = 0;
                    cinString = '';
                    appendToConsole(prompt, false);
                    break;
                default:
                    break;
            }
        }
    }

    function loadAsm(name) {

        // Reset the active module
        emscriptenResetModule();

        window._EmscriptenConsoleState = ConsoleStates.LOAD;
        emscriptenSetStatus('Downloading...');
        if (!window._EmscriptenConsoleFullOpt) {
            $.getScript(name + '.js');
        } else {
            (function() {
                var memoryInitializer = name + '.html.mem';
                if (typeof Module['locateFile'] === 'function') {
                    memoryInitializer = Module['locateFile'](memoryInitializer);
                } else if (Module['memoryInitializerPrefixURL']) {
                    memoryInitializer = Module['memoryInitializerPrefixURL'] + memoryInitializer;
                }
                var xhr = Module['memoryInitializerRequest'] = new XMLHttpRequest();
                xhr.open('GET', memoryInitializer, true);
                xhr.responseType = 'arraybuffer';
                xhr.send(null);
            })();

            var script = document.createElement('script');
            script.src = name + '.js';
            document.body.appendChild(script);
        }
    }

    function terminateAsm() {
        // Dummy
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
                    if (window._EmscriptenConsoleState == ConsoleStates.RUN) terminateAsm();
                    window._EmscriptenConsoleState = ConsoleStates.IDLE;
                    newlineConsole(true);

                    // Don't allow this charater to be passed on.
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
        //e.preventDefault();
    });

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

    // Declare the Emscripten module for any curently running task
    emscriptenModule = {
        preInit: [function() {
            FS.init(emscriptenCin, emscriptenCout, emscriptenCout);
        }],
        // Called after dependencies are loaded
        postRun: [function() {
            
            // File system is ready
            emscriptenSetStatus('Download complete.');
        }],
        noInitialRun: true,
        totalDependencies: 0,
        thisProgram: window._EmscriptenConsoleProgramName,
        monitorRunDependencies: function(left) {
            this.totalDependencies = Math.max(this.totalDependencies, left);
            var depString = 'Preparing... (' + (this.totalDependencies - left) + '/' + this.totalDependencies + ')';
            emscriptenSetStatus(depString);
        }
    };
    window._EmscriptenConsoleModule = $.extend(true, {}, emscriptenModule);

    function emscriptenResetModule() {
        emscriptenModule = $.extend(true, {}, window._EmscriptenConsoleModule);
        window.Module = emscriptenModule;
    }

    // Set the initial module
    window.Module = emscriptenModule;

    newlineConsole(true);
});