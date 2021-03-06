var _ = require('underscore');
var useit = require('useit');
var Manager = require('port-manager');
var RpcEventEmitter = require('multicast-events').EventEmitter;
var LocalEventEmitter = require('events').EventEmitter;
var util = require('util');
var ip = require('ip');
var tcpUtil = require('./tcp-util');
var axonRpc = require('axon-rpc');
var axon = require('axon-secure');
var Service = require('./service');
var properties = require('./properties');
var methods = require('./methods');
var handlers = require('./handlers');
var norm = require('normalize-arguments');
var debug = require('debug')('synapse');

module.exports = function (config) {
  config = config || {};
  var cfg = useit.load('./defaults').as('config').init(config);
  var rpcCounter = 0;
  // create TCP port manager
  var manager = new Manager(cfg.heartbeat);
  manager.include(cfg.minSrvPort, cfg.maxSrvPort);

  /**
   * @class node_modules.synapsejs.Rpc
   * @cfg {String} [name = 'synapse #n'] The name of the instance.
   * __NOTE__: the default name used as base for the sequence if that set into the module config.
   * @cfg {String} [address] The address bound to the instance
   * @cfg {Number} [port] The port bound to the instance.
   * @cfg {Number} [ghost = false] Set true if the node do not fire announce event and do not handle discovery events.
   * @cfg {Object} [meta] Optional information about the instance (this information is exposed in config).
   * @constructor
   */
  function Rpc(opts) {
    opts = opts || {};
    var localEmitter = new LocalEventEmitter();

    var _name = opts.name || util.format('%s #%d', cfg.name, rpcCounter);
    var _address =  opts.address || ip.address();
    var _port =  opts.port;
    var _meta = opts.meta;
    var _running = false;
    var _ghost = !!opts.ghost;
    var _blacklist = [];
    var _rules = [];

    function addProperties() {
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
      /**
       * Optional information about the service.
       * @property {Object} [meta]
       */
      Object.defineProperty(this, 'meta', {
        get: function get() {
          return _meta;
        },
        enumerable: true
      });
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
      /**
       * @property {Array} blacklist The list of the blocked services.
       */
      Object.defineProperty(this, 'blacklist', {
        get: function get() {
          return _blacklist;
        },
        enumerable: true
      });
      /**
       * @propety {Array} rules The list of the rules (ACLs) used to block some services.
       */
      Object.defineProperty(this, 'rules', {
        get: function get() {
          return _rules;
        },
        enumerable: true
      });
    }

    addProperties.call(this);

    rpcCounter++;
    var self = this;

    if (!tcpUtil.verifyAddress(_address)) {
      throw new Error(util.format('no interface is configured with %s address', _address));
    }
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
    var announce = methods.announce.call(this, localEmitter, rpcEmitter);
    var discovery = methods.discovery.call(this, rpcEmitter);
    var expose = methods.expose.call(this, localEmitter, rpc);
    var execute = methods.execute.call(this, localEmitter);
    var onAnnounce = handlers.onAnnounce.call(this, localEmitter);
    var onDiscovery = handlers.onDiscovery.call(this, localEmitter, rpcEmitter);

    function start(ghost, meta, cb) {
      debug('%s start request', self.name);

      var args = norm(arguments, [norm.boolean(_ghost), norm.object(_meta), norm.fn(undefined)]);
      ghost = !!args[0];
      meta = args[1];
      cb = args[2];

      _ghost = ghost;
      _meta = meta;

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
          port: 'ghost',
          meta: self.meta
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

    function addMethods() {
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
       * @chainable
       * @fires announce
       */
      this.announce = announce;
      /**
       * Discovery all synapse node on the network.
       * @method
       * @chainable
       * @fires discovery
       */
      this.discovery = discovery;
      /**
       * Start the synapse node.
       * @param {Boolean} [ghost = false] Set true if no announce event and no discovery response is required (ghost mode).
       * @param {Object} [meta] Optional information available in config.
       * @param {Function} cb The callback after the start.
       * @param {Error|String} cb.err The error if occurred.
       * @param {Object} cb.config The config of the started node (service).
       * @param {String} cb.config.name The name of the service.
       * @param {String} cb.config.address The address of the service.
       * @param {Number|String} cb.config.port The port of the service or 'ghost' if the service is in ghost mode.
       * @param {Object} cb.config.meta Optional information about the service.
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
       * @chainable
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
       * @chainable
       */
      this.execute = execute;
    }
    
    addMethods.call(this);
  }

  properties.addProperties(Rpc.prototype);
  methods.addMethods(Rpc.prototype);

  return Rpc;
};
