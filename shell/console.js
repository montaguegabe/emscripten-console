'use strict';

$(document).ready(function() {
    var isRunning = false;
    var consoleElement = $('#console');
    var output = $('.console-line').last();
    var underscoreShown = false;
    var cinString = "";
    var cinIndex = 0;
    var prevNull = false; // Last inputted was null
    var emscriptenModule;

    // Accessed by C/C++ code to indicate that the user should input
    window._EmscriptenConsolePaused = false;
    window._EmscriptenConsoleGetInput = function() {
        console.log('Paused: Waiting for input...');
        cinString = "";
        cinIndex = 0;
    }
    window._EmscriptenConsoleOptLevel = 3;

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

    function newlineConsole(toCin) {

        var quickToggle = underscoreShown;
        if (quickToggle) {
            toggleUnderscore();
        }

        // Append a new line
        var lineElement = $('<div />', {
            'class': 'console-line'
        });
        consoleElement.append(lineElement);
        output = $('.console-line').last();

        scrollToBottom();

        if (quickToggle) {
            toggleUnderscore();
        }

        // If we have specified that the newline should effect the input then we unpause execution.
        if (toCin) {
            if (isRunning) {
                // Send existing line to standard in
                prevNull = false;
                if (window._EmscriptenConsolePaused) console.log('Unpaused with input: ' + cinString);
                window._EmscriptenConsolePaused = false;
            } else {
                // Parse bogus linux into command arguments
                var args = cinString.split(' ');
                var programName = args[0];
                args.shift();
                emscriptenModule.arguments = args;
                executeAsm(programName);
            }
        }
    }

    function executeAsm(name) {
        isRunning = true;
        emscriptenSetStatus('Downloading...');
        if (window._EmscriptenConsoleOptLevel === undefined || window._EmscriptenConsoleOptLevel != 3) {
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
        e.preventDefault();
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

    // Declare the Emscripten module
    emscriptenModule = {
        preRun: [function() {
            FS.init(emscriptenCin, emscriptenCout, emscriptenCout);
            emscriptenSetStatus('Download complete.');
        }],
        totalDependencies: 0,
        monitorRunDependencies: function(left) {
            this.totalDependencies = Math.max(this.totalDependencies, left);
            var depString = 'Preparing... (' + (this.totalDependencies - left) + '/' + this.totalDependencies + ')';
            emscriptenSetStatus(depString);
        }
    };

    window.Module = emscriptenModule;
});