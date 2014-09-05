/**
 * @class node_modules.synapsejs.Rpc
 */

var _ = require('underscore');
var Service = require('./service');

function addProperties(proto) {
  /**
   * All collected services.
   * @property {Array} services
   * @readonly
   */
  Object.defineProperty(proto, 'services', {
    get: function () {
      return _.map(Service.list, function (service) {
        return {
          name: service.name,
          address: service.address,
          port: service.port,
          meta: service.meta,
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
  Object.defineProperty(proto, 'servicesByName', {
    get: function () {
      return _.groupBy(this.services, 'name');
    }
  });

  /**
   * All collected services grouped by address. Every group property is an Array.
   * @property {Object} servicesByAddress
   * @readonly
   */
  Object.defineProperty(proto, 'servicesByAddress', {
    get: function () {
      return _.groupBy(this.services, 'address');
    }
  });

  /**
   * All collected services grouped by port. Every group property is an Array.
   * @property {Object} servicesByPort
   * @readonly
   */
  Object.defineProperty(proto, 'servicesByPort', {
    get: function () {
      return _.groupBy(this.services, 'port');
    }
  });

  /**
   * All collected services grouped by method. Every group property is an Array.
   * @property {Object} servicesByMethod
   * @readonly
   */
  Object.defineProperty(proto, 'servicesByMethod', {
    get: function () {
      var flatten = [];
      _.forEach(this.services, function (service) {
        _.forEach(_.keys(service.methods), function (name) {
          service.method = name;
          flatten.push(service);
        });
      });
      // group services by method
      flatten = _.groupBy(flatten, 'method');
      // remove 'method' property in every service
      _.forEach(_.keys(flatten), function (method) {
        _.forEach(flatten[method], function (service) {
          delete service.method;
        });
      });
      return flatten;
    }
  });

  /**
   * The configuration of the synapse node. Other nodes collect it as a service with its exposed methods.
   * @property {Object} config
   * @property {String} config.name The name of the synapse node (service).
   * @property {String} config.address The address of the service.
   * @property {Number} config.port The port of the service.
   * @property {Object} config.meta Optional information about the service.
   * @readonly
   */
  Object.defineProperty(proto, 'config', {
    get: function () {
      return {
        name: this.name,
        address: this.address,
        port: this.port,
        meta: this.meta
      };
    },
    enumerable: true
  });
}

exports.addProperties = addProperties;