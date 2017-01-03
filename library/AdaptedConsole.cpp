//
//  AdaptedConsole.cpp
//  Emscripten adapted console
//
//  Created by Gabe Montague on 1/3/17.
//  Copyright © 2017 Gabe Montague. All rights reserved.
//

#include "AdaptedConsole.hpp"

#ifdef __EMSCRIPTEN__
namespace adaptedConsole {
    EmscriptenIStream cin = EmscriptenIStream();
}
#endif
