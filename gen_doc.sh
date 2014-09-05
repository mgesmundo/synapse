#!/bin/sh

# Generate jsduck documentation
# See [https://github.com/senchalabs/jsduck]

jsduck  index.js \
        lib \
        --output="doc" \
        --title="synapsejs documentation" \
		--footer="Copyright (c) 2014 Yoovant by Marcello Gesmundo" \
        --warnings=-link,-dup_member,-nodoc