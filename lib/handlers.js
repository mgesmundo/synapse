var useit = require('useit');
var util = require('util');
var Service = require('./service');
var debug = require('debug')('synapse');

function _onAnnounce(localEmitter) {
  var cfg = useit.use('config');
  var self = this;

  return function onAnnounce(config) {
    // remove parent property for debug purpose only
    delete config.parent;
    debug('%s receive "%s" from %o', self.name, cfg.announceEvent, config);
    if (self.checkService(config, true)) {
      debug('%s service %o is in blacklist', self.name, config);
      localEmitter.emit(cfg.blacklistEvent, config);
      return;
    }
    // add new service or update existing
    var service = Service.createService({
      parent: self.name,
      name: config.name,
      address: config.address,
      port: config.port,
      meta: config.meta,
      emitter: localEmitter
    });
    if (service instanceof Error) {
      debug('%s %o', self.name, service.message);
      localEmitter.emit(cfg.errorEvent, service);
    } else if (service.isNew) {
      debug('%s on announce save new service %o', self.name, {
        name: service.name,
        address: service.address,
        port: service.port,
        meta: service.meta
      });
      service.save();
    } else {
      debug('%s on announce update service %o', self.name, {
        name: service.name,
        address: service.address,
        port: service.port,
        meta: service.meta
      });
      service.update();
    }
  };
}

function _onDiscovery(localEmitter, rpcEmitter) {
  var cfg = useit.use('config');
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

exports.onAnnounce = _onAnnounce;
exports.onDiscovery = _onDiscovery;

/**
 * @class node_modules.synapsejs.Rpc
 */

/**
 * @event start Fired when the synapse node is up.
 * @param {Object} config The config of the started node (service).
 * @param {String} config.name The name of the service.
 * @param {String} config.address The address of the service.
 * @param {Number|String} config.port The port of the service or 'ghost' if the service is in ghost mode.
 * @param {Object} config.meta Optional information about the service.
 */

/**
 * @event stop Fired when the synapse node is down.
 * @param {Object} config The config of the stopped node (service).
 * @param {String} config.name The name of the service.
 * @param {String} config.address The address of the service.
 * @param {Number|String} config.port The port of the service or 'ghost' if the service is in ghost mode.
 * @param {Object} config.meta Optional information about the service.
 */

/**
 * @event announce Fired when the synapse node announce itself on the network.
 * An announce event occurs after a start event.
 * @param {Object} config The config of the node (service).
 * @param {String} config.name The name of the service.
 * @param {String} config.address The address of the service.
 * @param {Number} config.port The port of the service.
 * @param {Object} config.meta Optional information about the service.
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
 * @event blacklistEvent Fired when a new announced service match a rule into the ACL list.
 * @param {Object} config The config of the blocked node (service).
 * @param {String} config.name The name of the service.
 * @param {String} config.address The address of the service.
 * @param {Number} config.port The port of the service.
 * @param {Object} config.meta Optional information about the service.
 */

/**
 * @event save Fired when a new discovered service is saved.
 * @param {Object} service The saved service.
 * @param {String} service.name The name of the service.
 * @param {String} service.address The address of the service.
 * @param {Number} service.port The port of the service.
 * @param {Object} service.meta Optional information about the service.
 */

/**
 * @event destroy Fired when a service is not available anymore.
 * @param {Object} service The destroyed service.
 * @param {String} service.name The name of the service.
 * @param {String} service.address The address of the service.
 * @param {Number} service.port The port of the service.
 * @param {Object} service.meta Optional information about the service.
 */

/**
 * @event expose Fired when a method is exposed.
 * @param {String} name The name of the exposed method.
 * @param {Function} fn The function of the exposed method.
 */
