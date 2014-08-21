/**
 * Distributed RPC server and client.
 *
 * ## Installation
 * 
 * Install `synapsejs` as usual via [npm](http://npmjs.org).
 * 
 * ```sh
 * $ npm install synapsejs --save
 * ```
 * 
 * ## Quick Start
 * 
 * In this simple scenario we have two nodes that expose two methods. The third node is a client-only consumer.
 * 
 * ### First node
 * 
 * Save the following file as `node1.js`.
 * 
 * ```js
 * var Synapse = require('synapsejs')();
 * var node1 = new Synapse({
 *   name: 'node1'
 * });
 * node1.expose({
 *   sum: function (a, b, cb) {
 *     cb(null, a + b);
 *   },
 *   sub: function (a, b, cb) {
 *     cb(null, a - b);
 *   }
 * });
 * node1.start(function () {
 *   console.log('node1 is ready');
 * });
 * ```
 * 
 * ### Second node
 * 
 * Save the following file as `node2.js`.
 * 
 * ```js
 * var node2 = new Synapse({
 *   name: 'node2'
 * });
 * node2.expose({
 *   mul: function (a, b, cb) {
 *     cb(null, a * b);
 *   },
 *   div: function (a, b, cb) {
 *     cb(null, a / b);
 *   }
 * });
 * node2.start(function () {
 *   console.log('node2 is ready');
 * });
 * ```
 * 
 * ### Third node
 * 
 * Save the following file as `node3.js`.
 * 
 * ```js
 * var node3 = new Synapse({
 *   name: 'node3'
 * });
 * var announces = 0;
 * node3.on('announce', function (config) {
 *   console.log('announce from ' + config.name);
 *   announces++;
 *   if (announces === 2) {
 *   // all nodes are up
 *     node3.execute('sum', 1, 2, function (err, result) {
 *       console.log('sum = ' + result);
 *     });
 *     node3.execute('sub', 1, 2, function (err, result) {
 *       console.log('sub = ' + result);
 *     });
 *     node3.execute('mul', 1, 2, function (err, result) {
 *       console.log('nul = ' + result);
 *     });
 *     node3.execute('div', 1, 2, function (err, result) {
 *       console.log('div = ' + result);
 *     });
 *   }
 * });
 * node3.start(function () {
 *   console.log('node3 is ready');
 * });
 * node3.on('destroy', function (service) {
 *   console.log('node ' + service.name + ' is no longer available');
 * });
 * ```
 * 
 * In three terminal windows (in the same or different pc) start this three small apps:
 * 
 * ```bash
 * t1 $ node node1.js
 * node1 is ready
 * ```
 * 
 * ```bash
 * t2 $ node node2.js
 * node2 is ready
 * ```
 * 
 * ```bash
 * t3 $ node node3.js
 * node3 is ready
 * announce from node1
 * announce from node2
 * sum = 3
 * sub = -1
 * nul = 2
 * div = 0.5
 * ```
 * The last terminal window shows the results.
 * 
 * @class node_modules.synapsejs
 *
 * @author Marcello Gesmundo
 *
 * # License
 *
 * Copyright (c) 2014 Yoovant by Marcello Gesmundo. All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *    * Redistributions of source code must retain the above copyright
 *      notice, this list of conditions and the following disclaimer.
 *    * Redistributions in binary form must reproduce the above
 *      copyright notice, this list of conditions and the following
 *      disclaimer in the documentation and/or other materials provided
 *      with the distribution.
 *    * Neither the name of Yoovant nor the names of its
 *      contributors may be used to endorse or promote products derived
 *      from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 */

'use strict';

var _ = require('underscore');
var useit = require('useit');
var Manager = require('port-manager');
var RpcEventEmitter = require('multicast-events').EventEmitter;
var LocalEventEmitter = require('events').EventEmitter;
var debug = require('debug')('rpc');
var util = require('util');
var ip = require('ip');
var tcpUtil = require('./tcp-util');
var axonRpc = require('axon-rpc');
var axon = require('axon-secure');
var Service = require('./service');
var Args = require('vargs').Constructor;

function _expose(cfg, localEmitter, rpc) {
  var self = this;
  return function expose(name, fn) {
    if (self.ghost) {
      var error = new Error(util.format('%s unable expose methods in ghost mode', self.name));
      localEmitter.emit(cfg.errorEvent, error);
    } else {
      var keys;
      if (_.isObject(name) && !fn) {
        keys = _.keys(name);
        debug('%s expose "%s" methods', self.name, keys.join(', '));
        _.each(keys, function (key) {
          rpc.expose(key, name[key]);
        });
      } else {
        debug('%s expose "%s" method', self.name, name);
        rpc.expose(name, fn);
      }
      localEmitter.emit(cfg.exposeEvent, name, fn);
    }
    return self;
  };
}

function _announce(cfg, localEmitter, rpcEmitter) {
  var self = this;
  return function announce() {
    if (self.ghost) {
      var error = new Error(util.format('%s unable announce in ghost mode', self.name));
      localEmitter.emit(cfg.errorEvent, error);
    } else {
      debug('%s emit "%s": %o', self.name, cfg.announceEvent, self.config);
      rpcEmitter.emit(cfg.announceEvent, self.config);
    }
    return self;
  };
}

function _discovery(cfg, rpcEmitter) {
  var self = this;
  return function discovery() {
    debug('%s emit "%s"', self.name, cfg.discoveryEvent);
    rpcEmitter.emit(cfg.discoveryEvent);
    return self;
  };
}

function _execute(cfg, localEmitter) {
  var self = this;
  return function execute() {
    var args = new Args(arguments);
    if (args.length < 2) {
      localEmitter.emit(cfg.errorEvent, new Error('insufficient arguments'));
      return;
    }
    if (!args.callbackGiven()) {
      localEmitter.emit(cfg.errorEvent, new Error('callback required'));
      return;
    }
    // extract method, service, address and port
    var re = /(^[\w\s&\(\)\[\]\{\}\-]+){1}(@?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):?(\d*))?(\.(\d*\w*))?/;
    var fullMethod = args.first.match(re);
    if (_.isEmpty(fullMethod[0])) {
      localEmitter.emit(cfg.errorEvent, new Error('wrong qualified method'));
      return;
    }
    var method, name, address, port;
    if (fullMethod[6]) {
      method = fullMethod[6];
      name = fullMethod[1];
    }
    if (fullMethod[2]) {
      if (!method) {
        localEmitter.emit(cfg.errorEvent, new Error('wrong qualified method'));
        return;
      }
      address = fullMethod[3];
      port = fullMethod[4];
    }
    if (name && !method) {
      method = name;
      name = undefined;
    } else if (!name && !method) {
      method = fullMethod[1];
    }
    var services;
    // find the service
    if (method && !name) {
      services = Service.findByMethod(method);
    } else {
      var filter = {
        name: name
      };
      if (address) {
        filter.address = address;
      }
      if (port) {
        filter.port = parseInt(port, 10);
      }
      services = Service.find(filter);
    }
    var params = args.array;
    if (_.isEmpty(services)) {
      args.callback(new Error('method not found'));
    } else if (services.length > 1) {
      args.callback(new Error('not unique method found'));
    } else {
      // remove full qualified service name
      params.shift();
      // add method name
      params.unshift(method);
      // execute the remote method
      var service = services[0];
      debug('%s execute "%s" exposed by "%s@%s:%d"', self.name, method, service.name, self.address, self.port);
      service.client.call.apply(service.client, params);
    }
    return self;
  };
}

function _onAnnounce(cfg, localEmitter) {
  var self = this;
  return function onAnnounce(config) {
    // remove parent property for debug purpose only
    delete config.parent;
    debug('%s receive "%s" from %o', self.name, cfg.announceEvent, config);
    // add new service or update existing
    var service = Service.createService({
      parent: self.name,
      name: config.name,
      address: config.address,
      port: config.port,
      emitter: localEmitter
    });
    if (service instanceof Error) {
      debug(service.message);
      localEmitter.emit(cfg.errorEvent, service);
    } else if (service.isNew) {
      debug('%s on announce save new service %o', self.name, {
        name: service.name,
        address: service.address,
        port: service.port
      });
      service.save();
    } else {
      debug('%s on announce update service %o', self.name, {
        name: service.name,
        address: service.address,
        port: service.port
      });
      service.update();
    }
  };
}

function _onDiscovery(cfg, localEmitter, rpcEmitter) {
  var self = this;
  return function onDiscovery(rinfo) {
    if (self.ghost) {
      var error = new Error(util.format('%s unable handle discovery in ghost mode', self.name));
      localEmitter.emit(cfg.errorEvent, error);
    } else {
      debug('%s receive "%s" from %s:%d', self.name, cfg.discoveryEvent, rinfo.address, rinfo.port);
      // a discovery request is handled as new announce event in a random time slot
      // to avoid simultaneous announce events from other services
      var tout = Math.floor(Math.random() * cfg.discoveryDelay);
      debug('%s emit "%s" in %d ms', self.name, cfg.announceEvent, tout);
      setTimeout(function () {
        rpcEmitter.emit(cfg.announceEvent, self.config);
      }, tout);
    }
  };
}

module.exports = function (config) {
  config = config || {};
  var cfg = useit.load('./defaults').as('config').init(config);

  // create TCP port manager
  var manager = new Manager(cfg.heartbeat);
  manager.include(cfg.minSrvPort, cfg.maxSrvPort);

  var rpcCounter = 0;

  /**
   * @class node_modules.synapsejs.Rpc
   * @param {Object} opts The options
   * @param {String} [opts.name = 'synapse #n'] The name of the instance
   * @param {String} [opts.address] The address bound to the instance
   * @param {Number} [opts.port] The port bound to the instance.
   * @param {Number} [opts.ghost = false] Set true if the node do not fire announce event and do not handle discovery events.
   * @constructor
   */
  function Rpc(opts) {
    /**
     * @event start Fired when the synapse node is up.
     * @param {Object} config The config of the started node (service).
     * @param {String} config.name The name of the service.
     * @param {String} config.address The address of the service.
     * @param {Number|String} config.port The port of the service or 'ghost' if the service is in ghost mode.
     */

    /**
     * @event stop Fired when the synapse node is down.
     * @param {Object} config The config of the stopped node (service).
     * @param {String} config.name The name of the service.
     * @param {String} config.address The address of the service.
     * @param {Number|String} config.port The port of the service or 'ghost' if the service is in ghost mode.
     */

    /**
     * @event announce Fired when the synapse node announce itself on the network.
     * An announce event occurs after a start event.
     * @param {Object} config The config of the node (service).
     * @param {String} config.name The name of the service.
     * @param {String} config.address The address of the service.
     * @param {Number} config.port The port of the service.
     */

    /**
     * @event discovery Fired when the synapse node wants collect all services on the network.
     * A discovery event occur after the first announce.
     */

    /**
     * @event error Fired when an error occur.
     * @param {Error|String} err The error.
     */

    /**
     * @event save Fired when a new discovered service is saved.
     * @param {Object} service The saved service.
     * @param {String} service.name The name of the service.
     * @param {String} service.address The address of the service.
     * @param {Number} service.port The port of the service.
     */

    /**
     * @event destroy Fired when a service is not available anymore.
     * @param {Object} service The destroyed service.
     * @param {String} service.name The name of the service.
     * @param {String} service.address The address of the service.
     * @param {Number} service.port The port of the service.
     */

    /**
     * @event expose Fired when a method is exposed.
     * @param {String} name The name of the exposed method.
     * @param {Function} fn The function of the exposed method.
     */

    opts = opts || {};
    var _name = opts.name || util.format('%s #%d', cfg.name, rpcCounter);
    /**
     * The name of the instance
     * @property {String} name
     */
    Object.defineProperty(this, 'name', {
      get: function get() {
        return _name;
      },
      enumerable: true
    });
    var _address =  opts.address || ip.address();
    /**
     * The address bound to the instance
     * @property {String} address
     */
    Object.defineProperty(this, 'address', {
      get: function get() {
        return _address;
      },
      enumerable: true
    });
    var _port =  opts.port;
    /**
     * The port bound to the instance
     * @property {Number} port
     */
    Object.defineProperty(this, 'port', {
      get: function get() {
        return _port;
      },
      enumerable: true
    });
    var _running = false;
    /**
     * The status of the instance.
     * @property {Boolean} running
     */
    Object.defineProperty(this, 'running', {
      get: function get() {
        return _running;
      },
      enumerable: true
    });
    var _ghost = !!opts.ghost;
    /**
     * True if the node is in ghost mode (no announce event fired and no discovery events handling).
     * @property {Boolean} ghost
     */
    Object.defineProperty(this, 'ghost', {
      get: function get() {
        return _ghost;
      },
      enumerable: true
    });

    rpcCounter++;
    var self = this;

    if (!tcpUtil.verifyAddress(_address)) {
      throw new Error(util.format('no interface is configured with %s address', _address));
    }
    var localEmitter = new LocalEventEmitter();
    var rpcEmitter = new RpcEventEmitter({
      name: cfg.rpcEmitterName,
      id: cfg.name,
      group: cfg.advAddress,
      secure: cfg.secure,
      cipher: cfg.cipher,
      secret: cfg.secret,
      ttl: cfg.ttl,
      octet: cfg.octet,
      port: cfg.minEventsPort,
      interface: cfg.interface,
      foreignOnly: true,
      events: _.extend(cfg.events, opts.events)
    });
    var rep = axon.socket('rep', {
      secure: cfg.secure,
      cipher: cfg.cipher,
      secret: cfg.secret
    });
    var rpc = new axonRpc.Server(rep);
    var announce = _announce.call(this, cfg, localEmitter, rpcEmitter);
    var discovery = _discovery.call(this, cfg, rpcEmitter);
    var expose = _expose.call(this, cfg, localEmitter, rpc);
    var execute = _execute.call(this, cfg, localEmitter);
    var onAnnounce = _onAnnounce.call(this, cfg, localEmitter);
    var onDiscovery = _onDiscovery.call(this, cfg, localEmitter, rpcEmitter);

    function start(ghost, cb) {
      debug('%s start request', self.name);

      if (_.isFunction(ghost)) {
        cb = ghost;
        ghost = false;
      }
      _ghost = !!ghost;

      function listen() {
        var startTimeout = setTimeout( function () {
          _running = false;
          var error = new Error(util.format('%s start timeout', self.name));
          localEmitter.emit(cfg.errorEvent, error);
          cb && cb(error);
        }, cfg.timeout);

        // listen foreign only announce events
        rpcEmitter.on(cfg.announceEvent, onAnnounce);
        // listen foreign only discovery events
        rpcEmitter.on(cfg.discoveryEvent, onDiscovery);

        debug('%s bind port %d', self.name, self.port);

        rep.bind(self.port, function () {
          clearTimeout(startTimeout);
          debug('%s emit "%s" config %o', self.name, cfg.startEvent, self.config);
          _running = true;
          localEmitter.emit(cfg.startEvent, self.config);
          cb && cb(null, self.config);
          self.announce();
          self.discovery();
        });
      }
      if (!_ghost) {
        if (opts.port) {
          debug('%s claim TCP port %d for "%s"', self.name, opts.port, cfg.name);
        } else {
          debug('%s claim a free TCP port for "%s"', self.name, cfg.name);
        }
        // get a free TCP port
        manager.claim(self.name, opts.port, function (err, service) {
          if (err) {
            err = new Error(err);
            localEmitter(cfg.errorEvent, err);
            cb && cb(err);
          } else {
            _port = service.port;
            listen();
          }
        });
      } else if (_.isEmpty(rpc.methods)) {
        // listen foreign only announce events
        rpcEmitter.on(cfg.announceEvent, onAnnounce);
        _running = true;
        var ghostConfig = {
          name: self.name,
          address: self.address,
          port: 'ghost'
        };
        debug('%s emit "%s" config %o', self.name, cfg.startEvent, ghostConfig);
        localEmitter.emit(cfg.startEvent, ghostConfig);
        cb && cb(null, ghostConfig);
        self.discovery();
      } else {
        var error = new Error(util.format('%s unable start in ghost mode with exposed methods', self.name));
        localEmitter.emit(cfg.errorEvent, error);
        cb && cb(error);
      }
      return this;
    }

    function stop(cb) {
      debug('%s stop request', self.name);
      // the running status is unknown until the shutdown is complete
      _running = null;

      var stopTimeout = setTimeout(function () {
        var error = new Error(util.format('%s stop timeout', self.name));
        localEmitter.emit(cfg.errorEvent, error);
        cb && cb(error);
      }, cfg.timeout);

      function callback(cb) {
        if (relatedServicesDestroyed && repClosed) {
          clearTimeout(stopTimeout);
          debug('%s emit "%s"', self.name, cfg.stopEvent);
          _running = false;
          localEmitter.emit(cfg.stopEvent, self.config);
          cb && cb(null, self.config);
        }
      }

      // remove listeners
      setImmediate(function () {
        rpcEmitter.off(cfg.announceEvent, onAnnounce);
        rpcEmitter.off(cfg.discoveryEvent, onDiscovery);
      });

      // disconnect services
      var filter = {
        parent: self.name
      };
      var relatedServices = _.where(Service.list, filter);
      var i;
      var destroyed = 0;
      var max = relatedServices.length;
      var relatedServicesDestroyed;

      function _destroy() {
        destroyed++;
        relatedServicesDestroyed = (destroyed === max);
        callback(cb);
      }

      if (max > 0) {
        for (i = relatedServices.length -1; i >= 0; i--) {
          relatedServices[i].destroy(_destroy);
        }
      } else {
        relatedServicesDestroyed = true;
      }

      var repClosed;
      rep.close(function () {
        repClosed = true;
        callback(cb);
      });
      return this;
    }

    /**
     * Add a listener for the specified event.
     * @param {String} event The event.
     * @param {Function} listener The function to call when the event occurs.
     * @return {Rpc}
     * @chainable
     */
    this.addListener = function addListener(event, listener) {
      localEmitter.addListener(event, listener);
      return self;
    };
    /**
     * Remove the listener for the specified event.
     * @param {String} event The event.
     * @param {Function} listener The function to remove when the event occurs.
     * @return {Rpc}
     * @chainable
     */
    this.removeListener = function removeListener(event, listener) {
      localEmitter.removeListener(event, listener);
      return self;
    };
    /**
     * Remove all listener or only all listeners for the event if specified.
     * @param {String} [event] The event.
     * @return {Rpc}
     * @chainable
     */
    this.removeAllListeners = function removeAllListeners(event) {
      localEmitter.removeAllListeners(event);
      return self;
    };
    /**
     * Add a listener for the specified event but remove it after the first call.
     * @param {String} event The event.
     * @param {Function} listener The function to call when the event occurs.
     * @return {Rpc}
     * @chainable
     */
    this.once = function once(event, listener) {
      localEmitter.once(event, listener);
      return self;
    };
    /**
     * Alias for addListener.
     * @method on
     * @inheritdoc #addListener
     * @chainable
     */
    this.on = this.addListener;
    /**
     * Alias for removeListener.
     * @method off
     * @inheritdoc #removeListener
     * @chainable
     */
    this.off = this.removeListener;
    /**
     * Announce this new synapse node instance on the network.
     * @method
     * @fires announce
     */
    this.announce = announce;
    /**
     * Discovery all synapse node on the network.
     * @method
     * @fires discovery
     */
    this.discovery = discovery;
    /**
     * Start the synapse node.
     * @param {Boolean} [ghost = false] Set true if no announce event and no discovery response is required (ghost mode).
     * @param {Function} cb The callback after the start.
     * @param {Error|String} cb.err The error if occurred.
     * @param {Object} cb.config The config of the started node (service).
     * @param {String} cb.config.name The name of the service.
     * @param {String} cb.config.address The address of the service.
     * @param {Number|String} cb.config.port The port of the service or 'ghost' if the service is in ghost mode.
     * @fires start
     * @chainable
     */
    this.start = start;
    /**
     * Stop the synapse node.
     * @param {Function} cb The callback after the stop.
     * @param {Error|String} cb.err The error if occurred.
     * @param {Object} cb.config The config of the stopped node (service).
     * @param {String} cb.config.name The name of the service.
     * @param {String} cb.config.address The address of the service.
     * @param {Number|String} cb.config.port The port of the service or 'ghost' if the service is in ghost mode.
     * @fires stop
     * @chainable
     */
    this.stop = stop;
    /**
     * Expose many or a single method.
     *
     * ## Example
     *
     * ```js
     * var Synapse = require('synapsejs');
     * var rpc = new Synapse();
     * rpc
     *    .expose('sum', function (a, b, cb) {
     *      cb(a + b);
     *    });
     *    .expose('sub', function (a, b, cb) {
     *      cb(a - b);
     *    });
     *
     * // or alternatively
     *
     * rpc.expose({
     *    sum: function (a, b, cb) {
     *      cb(a + b);
     *    },
     *    sub: function (a, b, cb) {
     *      cb(a - b);
     *    }
     * });
     * ```
     *
     * @param {String|Object} name The name of the exposed method
     * @param {String|Object} fn The function exposed.
     *
     * __NOTE__ The function __MUST__ return the result using a callback whose first argument is the error if occurred or null if no error was occurred.
     * @fires expose
     * @method
     */
    this.expose = expose;
    /**
     * Execute a remote method searching it into all nodes.
     *
     * ## Example
     *
     * ```js
     * var Synapse = require('synapsejs');
     * var rpc = new Synapse();
     * rpc.execute('sum', 1, 2, function (err, result) {
     *    console.log(result);    // 3
     * });
     * ```
     *
     * @param {String} name The name of the method. It is possible to specify the method name only or a full qualified name depending on the number of the nodes with the same method name exposed:
     *    - `method`: the name of the method
     *    - `service`.`method`: the name of the service and the name of the method
     *    - `service`@`address`.`method`: the name of the service with its address and the name of the method
     *    - `service`@`address`:`port`.`method`: the name of the service with its address and port and the name of the method
     * @param {Mixed} [arguments] All params required by the remote method.
     * @param {Function} fn The callback with the result of the method.
     * @param {Error|String} fn.err The error if occurred or null if no error was occurred.
     * @param {Mixed} [fn.arguments] All results provided by the remote method.
     * @method
     */
    this.execute = execute;
  }

  /**
   * Find a service(s) using some properties.
   * @param {Object} criteria An object with the properties to use as filter
   * (e.g.: { name: 'some name', address: '192.168.0.10' })
   * @return {Array}
   */
  Rpc.prototype.find = function find(criteria) {
    return _.where(this.services, criteria);
  };

  /**
   * Find a service(s) using its name.
   * @param {String} name The name of the service to find.
   * @return {Array}
   */
  Rpc.prototype.findByMethod = function findByMethod(name) {
    return _.filter(this.services, function (service) {
      return !_.isEmpty(_.filter(service.methods, function (method) {
        return method.name.toString() === name.toString();
      }));
    });
  };

  /**
   * All collected services.
   * @property {Array} services
   * @readonly
   */
  Object.defineProperty(Rpc.prototype, 'services', {
    get: function () {
      return _.map(Service.list, function (service) {
        return {
          name: service.name,
          address: service.address,
          port: service.port,
          methods: service.methods
        };
      });
    }
  });

  /**
   * All collected services grouped by name. Every group property is an Array.
   * @property {Object} servicesByName
   * @readonly
   */
  Object.defineProperty(Rpc.prototype, 'servicesByName', {
    get: function () {
      return _.groupBy(this.services, 'name');
    }
  });

  /**
   * All collected services grouped by address. Every group property is an Array.
   * @property {Object} servicesByAddress
   * @readonly
   */
  Object.defineProperty(Rpc.prototype, 'servicesByAddress', {
    get: function () {
      return _.groupBy(this.services, 'address');
    }
  });

  /**
   * All collected services grouped by port. Every group property is an Array.
   * @property {Object} servicesByPort
   * @readonly
   */
  Object.defineProperty(Rpc.prototype, 'servicesByPort', {
    get: function () {
      return _.groupBy(this.services, 'port');
    }
  });

  /**
   * The configuration of the synapse node. Other nodes collect it as a service with its exposed methods.
   * @property {Object} config
   * @property {String} config.name The name of the synapse node (service).
   * @property {String} config.address The address of the service.
   * @property {Number} config.port The port of the service.
   * @readonly
   */
  Object.defineProperty(Rpc.prototype, 'config', {
    get: function () {
      return {
        name: this.name,
        address: this.address,
        port: this.port
      };
    },
    enumerable: true
  });

  return Rpc;
};

