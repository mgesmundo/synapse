# SynapseJS

SynapseJS is a distributed RPC system where each node (service) acts as both client and server and collects every method exposed by other nodes in the local network or in the same host in a complex application with a bunch of independent services. Every node can invoke a remote function in every other node without any setup.

## Features

* Automatic gathering of all synapse nodes in network
* Announce the synapse node with optional `meta` information (e.g. server configuration, etc.)
* Optional encryption of all network messages
* No polling to search synapse nodes in network: every new node is discovered automatically when it starts (multicast events)
* Manage a blacklist to exclude some unwanted synapse node exposed into the network
* Enable or disable every synapse node with `start` and `stop` methods
* Ghost mode available on `start` to collect only services without expose methods.

## Installation

Install `synapsejs` as usual via [npm](http://npmjs.org).

```sh
$ npm install synapsejs --save
```

## Quick Start

In this simple scenario we have two nodes that expose two methods. The third node is a client-only consumer.

### First node

Save the following file as `node1.js`.

```js
var Synapse = require('synapsejs')();
var node1 = new Synapse({
  name: 'node1'
});
node1.expose({
  sum: function (a, b, cb) {
    cb(null, a + b);
  },
  sub: function (a, b, cb) {
    cb(null, a - b);
  }
});
node1.start(function () {
  console.log('node1 is ready');
});
```

### Second node

Save the following file as `node2.js`.

```js
var node2 = new Synapse({
  name: 'node2'
});
node2.expose({
  mul: function (a, b, cb) {
    cb(null, a * b);
  },
  div: function (a, b, cb) {
    cb(null, a / b);
  }
});
node2.start(function () {
  console.log('node2 is ready');
});
```

### Third node

Save the following file as `node3.js`.

```js
var node3 = new Synapse({
  name: 'node3'
});
var announces = 0;
node3.on('announce', function (config) {
  console.log('announce from ' + config.name);
  announces++;
  if (announces === 2) {
  // all nodes are up
    node3.execute('sum', 1, 2, function (err, result) {
      console.log('sum = ' + result);
    });
    node3.execute('sub', 1, 2, function (err, result) {
      console.log('sub = ' + result);
    });
    node3.execute('mul', 1, 2, function (err, result) {
      console.log('nul = ' + result);
    });
    node3.execute('div', 1, 2, function (err, result) {
      console.log('div = ' + result);
    });
  }
});
node3.start(function () {
  console.log('node3 is ready');
});
node3.on('destroy', function (service) {
  console.log('node ' + service.name + ' is no longer available');
});
```

In three terminal windows (in the same or different pc) start this three small apps:

```bash
t1 $ node node1.js
node1 is ready
```

```bash
t2 $ node node2.js
node2 is ready
```

```bash
t3 $ node node3.js
node3 is ready
announce from node1
announce from node2
sum = 3
sub = -1
nul = 2
div = 0.5
```
The last terminal window shows the results.

## API Reference

For a full documentation see the `doc` folder content.

## Tests

As usual our tests are written in the BDD styles for the [Mocha](http://mochajs.org/) test runner using the `should` assertion interface and the great test spies tool [Sinon](http://sinonjs.org) and also the best coverage tool [Blanket](http://blanketjs.org).
To run the test simply type in your terminal:

```bash
$ npm test
```

To run the coverage test type instead:

```bash
$ npm run coverage
```

## License

Copyright (c) 2014 Yoovant by Marcello Gesmundo. All rights reserved.
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

   * Redistributions of source code must retain the above copyright
     notice, this list of conditions and the following disclaimer.
   * Redistributions in binary form must reproduce the above
     copyright notice, this list of conditions and the following
     disclaimer in the documentation and/or other materials provided
     with the distribution.
   * Neither the name of Yoovant nor the names of its
     contributors may be used to endorse or promote products derived
     from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
