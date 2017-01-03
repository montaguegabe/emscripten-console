//
//  AdaptedInput.h
//  Emscripten adapted console
//
//  Created by Gabe Montague on 1/2/17.
//  Copyright © 2017 Gabe Montague. All rights reserved.
//
//  Allows standard IO use with online Emscripten terminal
//

#ifndef AdaptedConsole_h
#define AdaptedConsole_h

#include <iostream>
#include <string>

#ifdef __EMSCRIPTEN__
#include "emscripten.h"
#endif

using std::cout;
using std::istream;
using std::flush;
using std::string;

namespace adaptedConsole {
    
#ifdef __EMSCRIPTEN__
    // The amount of time to wait between pollings of the browser for an unpause
    static const int PollWait = 15;
    
    // Define a primitive alternative for cin. A more robust way to do this would be to subclass std::istream.
    class EmscriptenIStream {
    public:
        EmscriptenIStream() { }

        template<typename T>
        istream & operator>>(T & object) {
            
            // We must flush output before input is available in the console
            cout << flush;
            
            // Tell javascript that the program is paused
            EM_ASM({
                window._EmscriptenConsolePaused = true;
                window._EmscriptenConsoleGetInput();
            });
            
            // Sleep and poll while paused until input is ready
            bool stillPaused = true;
            while (stillPaused) {
                // Allow other scripts to execute in the meantime to prepare the user input
                emscripten_sleep(PollWait);
                
                stillPaused = EM_ASM_INT_V({
                    return window._EmscriptenConsolePaused;
                });
            }
            
            std::cin >> object;
            return std::cin;
        }
    };
    extern EmscriptenIStream cin;
#else
    // Define cin as std::cin
    using std::cin;
#endif
}

#endif /* AdaptedConsole_h */
