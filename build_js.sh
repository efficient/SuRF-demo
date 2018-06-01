#!/bin/sh

em++ -o docs/surf.js js.cpp -std=c++11 -msse2 -DNDEBUG --llvm-opts 2 --bind -s ALLOW_MEMORY_GROWTH=1 -v
