'use strict';

var _ = require('underscore');

/**
 * @class node_modules.synapsejs
 */
var defaults = {
  /**
   * @cfg {String} [name = 'synapse'] The name assigned to the module
   */
  name: 'synapse',
  /**
   * @cfg {String} [rpcEmitterName = 'rpc-emitter'] The name assigned to the emitter instance
   */
  rpcEmitterName: 'rpc-emitter',
  /**
   * @cfg {String} [advAddress = '237.100.100.100'] The multicast address used for the multicast events (announce, discovery)
   */
  advAddress: '237.100.100.100',
  /**
   * @cfg {Number} [advPort = 2900] The port used for the announce event
   */
  advPort: 2900,
  /**
   * @cfg {Number} [advPort = 2901] The port used for the discovery event
   */
  discPort: 2901,
  /**
   * @cfg {Number} [minSrvPort = 1024] Minimum TCP port assigned to the rpc server instance
   */
  minSrvPort: 1024,
  /**
   * @cfg {Number} [maxSrvPort = 2899] Maximum TCP port assigned to the rpc server instance
   */
  maxSrvPort: 2899,
  /**
   *
   * @cfg {String} [startEvent = 'start'] The name for the start event
   */
  startEvent: 'start',
  /**
   * @cfg {String} [stopEvent = 'stop'] The name for the stop event
   */
  stopEvent: 'stop',
  /**
   * @cfg {String} [announceEvent = 'announce'] The name of the announce event
   */
  announceEvent: 'announce',
  /**
   *
   * @cfg {String} [discoveryEvent = 'discovery'] The name of the discovery event
   */
  discoveryEvent: 'discovery',
  /**
   * @cfg {String} [exposeEvent = 'expose'] The name of the expose event
   */
  exposeEvent: 'expose',
  /**
   * @cfg {String} [saveEvent = 'save'] The name of the save event
   */
  saveEvent: 'save',
  /**
   * @cfg {String} destroyEvent = 'destroy' The name of the destroy event
   */
  destroyEvent: 'destroy',
  /**
   * @cfg {String} [errorEvent = 'error'] The name of the error event
   */
  errorEvent: 'error',
  /**
   * @cfg {String} [blacklistEvent = 'blacklist'] The name of the match service in blacklist event
   */
  blacklistEvent: 'blacklist',
  /**
   * @cfg {Number} [discoveryDelay = 200] The maximum delay between the discovery request and the announce replay (in ms)
   */
  discoveryDelay: 200,
  /**
   * @cfg {String} [id = 'default'] The identifier of the multicast emitter
   */
  id: 'default',
  /**
   * @cfg {Boolean} [secure = false] Set `true` to enable the messages encryption
   */
  secure: false,
  /**
   * @cfg {String} [cipher = 'aes256'] The cipher used to encrypt/decrypt the messages
   */
  cipher: 'aes256',
  /**
   * @cfg {String} [secret = 'secret'] The shared secret password use to encrypt all messages
   */
  secret: 'secret',
  /**
   * @cfg {Number} [ttl = 64]The number of IP hops that a packet is allowed to go through.
   * This option is related to announce and discovery events.
   */
  ttl: 64,
  /**
   *  @cfg {String} [interface] If not specified, every listener will add membership to all valid interfaces.
   * The interface must be a valid multicast address (from 224.0.0.1 to 239.255.255.254).
   * This option is related to announce and discovery events.
   */
  interface: undefined,
  /**
   * @cfg {Number} octet The first octet used for the generated multicast address
   * @private
   * @ignore
   */
  octet: 239,
  /**
   * @cfg {Number} [port = 2902] The port used as base for the generated port used for every event message.
   * Use according the other TCP port range used for events and rpc server.
   */
  minEventsPort: 2902,
  /**
   * @cfg {Object} events All events overrides
   * @private
   * @ignore
   */
  events: {},
  /**
   * @cfg {Number} [heartbeat = 250] The time interval used to verify if a TCP port is busy (in ms).
   * When the port is not in use, the manager set this port as available.
   */
  heartbeat: 250,
  /**
   * @cfg {Number} [timeout = 5000] The timeout used for every remote operation.
   * An `error` event is fired if the operation fails due a timeout.
   */
  timeout: 5000
};

defaults.events[defaults.announceEvent] = defaults.advPort;
defaults.events[defaults.discoveryEvent] = defaults.discPort;

module.exports = function (opts) {
  var cfg = opts || {};
  _.defaults(cfg, defaults);
  return cfg;
};
