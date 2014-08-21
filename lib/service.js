'use strict';

var _ = require('underscore');
var useit = require('useit');
var axonRpc = require('axon-rpc');
var axon = require('axon-secure');
var debug = require('debug')('rpc:service');
var util = require('util');

/**
 * @class node_modules.synapsejs.Service
 * @param {Object} config The config options.
 * @param {EventEmitter} config.emitter The EventEmitter instance.
 * @param {String} config.parent The name of the manager that handle the service.
 * @param {String} config.name The name of the service.
 * @param {String} config.address The address of the service.
 * @param {Number} config.port The port of the service.
 * @param {Object} [config.meta] Optional information about the service.
 * @private
 * @constructor
 */
function Service(config) {
  var cfg = useit.use('config');
  var req = axon.socket('req', {
    secure: cfg.secure,
    cipher: cfg.cipher,
    secret: cfg.secret
  });
  var localEmitter = config.emitter;
  if (!localEmitter) {
    throw new Error('emitter required');
  }
  var _isNew = true;
  /**
   * Is true if a new service is created and not saved.
   * @property {Boolean}
   * @private
   * @readonly
   */
  Object.defineProperty(this, 'isNew', {
    get: function get() {
      return _isNew;
    },
    enumerable: true
  });

  var _parent = config.parent;
  /**
   * The name of the manager that handle the service.
   * @property {String} parent
   * @private
   * @readonly
   */
  Object.defineProperty(this, 'parent', {
    get: function get() {
      return _parent;
    },
    enumerable: true
  });
  var _name = config.name;
  /**
   * The name of the service. __Note__ The name must be unique in the same network.
   * @property {String} name
   * @readonly
   */
  Object.defineProperty(this, 'name', {
    get: function get() {
      return _name;
    },
    enumerable: true
  });
  var _address = config.address;
  /**
   * The address of the service.
   * @property {String} address
   * @readonly
   */
  Object.defineProperty(this, 'address', {
    get: function get() {
      return _address;
    },
    enumerable: true
  });
  var _port = config.port;
  /**
   * The port of the service.
   * @property {String} port
   * @readonly
   */
  Object.defineProperty(this, 'port', {
    get: function get() {
      return _port;
    },
    enumerable: true
  });
  var _meta = config.meta;
  /**
   * Optional information about the service.
   * @property {String} meta
   * @readonly
   */
  Object.defineProperty(this, 'meta', {
    get: function get() {
      return _meta;
    },
    enumerable: true
  });
  var _client = new axonRpc.Client(req);
  /**
   * The rpc client instance.
   * @property {Client} client
   * @readonly
   * @private
   */
  Object.defineProperty(this, 'client', {
    get: function get() {
      return _client;
    },
    enumerable: true
  });
  var _methods = {};
  /**
   * The collected methods.
   * @property {Object} methods
   * @readonly
   */
  Object.defineProperty(this, 'methods', {
    get: function get() {
      return _methods;
    },
    enumerable: true
  });
  var socket;
  var self = this;

  req.on('connect', function () {
    debug('%s connect to %s:%d', self.parent, self.address, self.port);
    if (!_.isEmpty(req.socks)) {
      if (req.socks.length > 1) {
        var error = new Error(util.format('%s has too many sockets connected to %s:%d',
          self.parent, self.address, self.port));
        localEmitter.emit(cfg.errorEvent, error);
      }
      req.socks[0].on('close', function () {
        debug('%s close connection to %s:%d', self.parent, self.address, self.port);
        self.destroy();
      });
    }
    self.update();
  });

  /**
   * Update all methods exposed by the service.
   * @method update
   * @param {Function} cb The callback.
   * @param {Error|String} cb.err The error if occurred.
   * @fires announce
   */
  this.update = function update(cb) {
    self.client.methods(function (err, methods) {
      if (!err) {
        _methods = methods;
        debug('%s update methods exposed by %s:%d %o', self.parent, self.address, self.port, self.methods);
        // notify locally only
        var service = {
          name: self.name,
          address: self.address,
          port: self.port,
          meta: self.meta
        };
        localEmitter.emit(cfg.announceEvent, service);
        cb && cb();
      } else {
        var error = util.format('%s has encountered an error updating methods exposed by %s:%d',
          self.parent, self.address, self.port);
        debug('%s %o', error, self.methods);
        localEmitter.emit(cfg.errorEvent, new Error(error));
        cb && cb(error);
      }
    });
  };

  /**
   * Save the current service.
   * @method save
   * @param {Function} cb The callback.
   * @param {Error|String} cb.err The error if occurred.
   * @fires save
   */
  this.save = function save(cb) {
    var service = {
      name: self.name,
      address: self.address,
      port: self.port,
      meta: self.meta
    };
    var error;
    debug('%s save request service %o', self.parent, service);
    var services = Service.find(service);
    if (_.isEmpty(services)) {
      debug('%s try connection to %s:%d', self.parent, self.address, self.port);

      var saveTimeout = setTimeout(function () {
        var error = new Error(util.format('%s save timeout %s', self.parent, service.name));
        localEmitter.emit(cfg.errorEvent, error);
        cb && cb(error);
      }, cfg.timeout);

      socket = req.connect(self.port, self.address, function () {
        clearTimeout(saveTimeout);
        debug('%s save complete service %o', self.parent, service);
        _isNew = false;
        _list.push(self);
        localEmitter.emit(cfg.saveEvent, service);
        cb && cb();
      });
    } else {
      error = new Error(util.format('%s service "%s" already available', self.parent, service.name));
      localEmitter.emit(cfg.errorEvent, error);
      cb && cb(error);
    }
  };

  /**
   * Destroy the service.
   * @param {Function} cb The callback
   * @param {Error|String} cb.err The error if occurred.
   * @fires destroy
   */
  this.destroy = function destroy(cb) {
    var service = {
      name: this.name,
      address: this.address,
      port: this.port,
      meta: this.meta
    };
    debug('%s destroy request service %o', self.parent, service);

    var destroyTimeout = setTimeout(function () {
      var error = new Error(util.format('%s destroy timeout %s@%s:%d',
        self.parent, service.name, service.address, service.port));
      localEmitter.emit(cfg.errorEvent, error);
      cb && cb(error);
    }, cfg.timeout);

    function callback(cb) {
      if (socketClosed && reqClosed) {
        clearTimeout(destroyTimeout);
        debug('%s destroy complete service %o', self.parent, service);
        _list = _.reject(_list, _.matches(service));
        localEmitter.emit(cfg.destroyEvent, service);
        cb && cb();
      }
    }

    var socketClosed;
    if (socket) {
      socket.close(function () {
        socketClosed = true;
        callback(cb);
      });
    } else {
      socketClosed = true;
    }
    var reqClosed = false;
    req.close(function () {
      reqClosed = true;
      callback(cb);
    });
  };

  var service = {
    name: this.name,
    address: this.address,
    port: this.port,
    meta: this.meta
  };
  debug('%s create new service %o', self.parent, service);
}

var _list = [];
/**
 * The list of all active services. When a service is not available it is destroyed and removed from the list.
 * @property {Array}
 * @private
 */
Object.defineProperty(Service, 'list', {
  get: function get() {
    return _list;
  },
  enumerable: true
});

/**
 * Find a service(s) using some properties.
 * @param {Object} criteria An object with the properties to use as filter
 * (e.g.: { name: 'some name', address: '192.168.0.10' })
 * @return {Array}
 */
function find(criteria) {
  return _.where(_list, criteria);
}

/**
 * Find a service(s) using its name
 * @param {String} name The name of the service to find.
 * @return {Array}
 */
function findByMethod(name) {
  return _.filter(_list, function (service) {
    return !_.isEmpty(_.filter(service.methods, function (method) {
      return method.name.toString() === name.toString();
    }));
  });
}

/**
 * Create a new service or get the existing one if it is already registered.
 * If more than one already registered service is found, an error is returned.
 * @param {Object} config The config options.
 * @param {EventEmitter} config.emitter The EventEmitter instance.
 * @param {String} config.parent The name of the manager that handle the service.
 * @param {String} config.name The name of the service.
 * @param {String} config.address The address of the service.
 * @param {Number} config.port The port of the service.
 * @param {Object} [config.meta] Optional information about the service.
 * @return {Service|Error}
 */
function createService(config) {
  var service = {
    name: config.name,
    address: config.address,
    port: config.port,
    meta: config.meta
  };
  var services = Service.find(service);
  if (_.isEmpty(services)) {
    return new Service(config);
  } else if (services.length === 1) {
    return services[0];
  }
  return new Error(util.format('%s duplicated service "%s" found', config.parent, service.name));
}

Service.find = find;
Service.findByMethod = findByMethod;
Service.createService = createService;

module.exports = Service;
