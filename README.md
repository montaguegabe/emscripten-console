# emscripten-console
Use Grunt to compile command-line C++ projects into a web-page-embedded console.

For an example of how to use in a project see [github.com/montaguegabe/matrix-row-reducer](https://github.com/montaguegabe/matrix-row-reducer).

In general the workflow is:
1) Install [Emscripten](https://github.com/kripken/emscripten)
2) Clone this repository as a submodule in your C/C++ project
3) Create a Emscripten.config file with build parameters (see example project). Some Emscripten parameters are forced on or off by default to ensure compatibility with the console, so these parameters are not changable within the config file.
4) Within the submodule run `grunt build` to build the console webpage, and `grunt connect` to serve the build.

### Adaptations
To ensure that execution of the program pauses at the correct times when a user is asked for input, the optimized Emterpreter is used by default on functions that may pause execution. To adapt for this, link/include the accompanying library/AdaptedConsole.cpp and hpp files, and use their definitions of `cin` and `cout` rather than the standard library's `std::cin` and `std::cout`.

Apart from this, the only other limitations are the normal Emscripten limitations (multiprocessing, nonstandard network operations, most system calls).
