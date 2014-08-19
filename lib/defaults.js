'use strict';

var _ = require('underscore');

/**
 * @class node_modules.synapsejs.Rpc
 */
var defaults = {
  /**
   * The name assigned to the module
   * @cfg {String} [name = 'synapse']
   */
  name: 'synapse',
  /**
   * The name assigned to the emitter instance
   * @cfg {String} [rpcEmitterName = 'rpc-emitter']
   */
  rpcEmitterName: 'rpc-emitter',
  /**
   * The multicast address used for the multicast events (announce, discovery)
   * @cfg {String} [advAddress = '237.100.100.100']
   */
  advAddress: '237.100.100.100',
  /**
   * The port used for the announce event
   * @cfg {Number} [advPort = 2900]
   */
  advPort: 2900,
  /**
   * The port used for the discovery event
   * @cfg {Number} [advPort = 2901]
   */
  discPort: 2901,
  /**
   * Minimum TCP port assigned to the rpc server instance
   * @cfg {Number} [minSrvPort = 1024]
   */
  minSrvPort: 1024,
  /**
   * Maximum TCP port assigned to the rpc server instance
   * @cfg {Number} [maxSrvPort = 2899]
   */
  maxSrvPort: 2899,
  /**
   * The name for the start event
   * @cfg {String} [startEvent = 'start']
   */
  startEvent: 'start',
  /**
   * The name for the stop event
   * @cfg {String} [stopEvent = 'stop']
   */
  stopEvent: 'stop',
  /**
   * The name of the announce event
   * @cfg {String} [announceEvent = 'announce']
   */
  announceEvent: 'announce',
  /**
   * The name of the discovery event
   * @cfg {String} [discoveryEvent = 'discovery']
   */
  discoveryEvent: 'discovery',
  /**
   * The name of the expose event
   * @cfg {String} [exposeEvent = 'expose']
   */
  exposeEvent: 'expose',
  /**
   * The name of the save event
   * @cfg {String} [saveEvent = 'save']
   */
  saveEvent: 'save',
  /**
   * The name of the destroy event
   * @cfg {String} destroyEvent = 'destroy'
   */
  destroyEvent: 'destroy',
  /**
   * The name og the error event
   * @cfg {String} [errorEvent = 'error']
   */
  errorEvent: 'error',
  /**
   * The maximum delay between the discovery request and the announce replay (in ms)
   * @cfg {Number} [discoveryDelay = 200]
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
   * The number of IP hops that a packet is allowed to go through
   * This option is related to announce and discovery events.
   * @cfg {Number} [ttl = 64]
   */
  ttl: 64,
  /**
   * If not specified, every listener will add membership to all valid interfaces.
   * The interface must be a valid multicast address (from 224.0.0.1 to 239.255.255.254).
   * This option is related to announce and discovery events.
   * @cfg {String} [interface]
   */
  interface: undefined,
  /**
   * The first octet used for the generated multicast address
   * @cfg {Number} octet
   * @private
   * @ignore
   */
  octet: 239,
  /**
   * The port used as base for the generated port used for every event message.
   * Use according the other TCP port range used for events and rpc server.
   * @cfg {Number} [port = 2902]
   */
  minEventsPort: 2902,
  /**
   * All events overrides
   * @cfg {Object} events
   * @private
   * @ignore
   */
  events: {},
  /**
   * The time interval used to verify if a TCP port is busy (in ms).
   * When the port is not in use, the manager set this port as available.
   * @cfg {Number} [heartbeat = 250]
   */
  heartbeat: 250,
  /**
   * The timeout used for every remote operation. An `error` event is fired if the operation fails due a timeout.
   * @cfg {Number} [timeout = 5000]
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
