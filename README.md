# emscripten-console
Use Grunt to compile command-line C++ projects into a web-page-embedded console.

For an example of how to use in a project see [github.com/montaguegabe/matrix-row-reducer](https://github.com/montaguegabe/matrix-row-reducer).

In general the workflow is:
1) Install [Emscripten](https://github.com/kripken/emscripten)
2) Clone this repository as a submodule in your C/C++ project
3) Create a Emscripten.config file with build parameters (see example project)
4) Within the submodule run `grunt build` to build the console webpage, and `grunt connect` to serve the build.
