#!/bin/sh

em++ -o web/surf.js js.cpp -std=c++11 -msse2 -DNDEBUG --llvm-opts 2 --bind -v
