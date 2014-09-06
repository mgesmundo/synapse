/**
 * @class node_modules.synapsejs.Rpc
 */

var _ = require('underscore');
var useit = require('useit');
var util = require('util');
var Service = require('./service');
var Args = require('vargs').Constructor;
var norm = require('normalize-arguments');
var debug = require('debug')('synapse');

function _expose(localEmitter, rpc) {
  var cfg = useit.use('config');
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

function _announce(localEmitter, rpcEmitter) {
  var cfg = useit.use('config');
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

function _discovery(rpcEmitter) {
  var cfg = useit.use('config');
  var self = this;
  return function discovery() {
    debug('%s emit "%s"', self.name, cfg.discoveryEvent);
    rpcEmitter.emit(cfg.discoveryEvent);
    return self;
  };
}

function _execute(localEmitter) {
  var cfg = useit.use('config');
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

function addMethods(proto) {
  /**
   * Find a service(s) using some properties.
   * @param {Object} criteria An object with the properties to use as filter
   * (e.g.: { name: 'some name', address: '192.168.0.10' })
   * @return {Array}
   */
  proto.find = function find(criteria) {
    debug('%s find services with criteria %o', this.name, criteria);
    return _.where(this.services, criteria);
  };

  /**
   * Find a service(s) using its name.
   * @param {String} name The name of the service to find.
   * @return {Array}
   */
  proto.findByMethod = function findByMethod(name) {
    debug('%s find services with method %s', this.name, name);
    return _.filter(this.services, function (service) {
      return !_.isEmpty(_.filter(service.methods, function (method) {
        return method.name.toString() === name.toString();
      }));
    });
  };

  /**
   * Add a rule to the ACL list used to block a service or a group of services using a regular expressions.
   *
   * ## Example
   *
   *      var rpc = new Rpc({
   *        name: '(acl)'
   *      });
   *      rpc.addRule({
   *        name:    /\([\s\S]+\)/i,                          // any name inside two brackets (case insensitive)
   *        address: /192.168.0.(3[2-9]|[4-5][0-9]|6[0-4])/   // any IP between 192.168.0.32 and 192.168.0.64
   *      });
   *
   * __Note:__ as a firewall the rules are evaluated from the top to the bottom.
   * @param {Object} acl An object with a regular expression as value for every property.
   * @param {String|RegExp} acl.name The name of the blocked service.
   * @param {String|RegExp} acl.address The name of the blocked service.
   * @param {Number|RegExp} acl.port The port of the blocked service.
   * @return {Boolean} True if the acl is successfully added to the ACL list (#rules) or it already exists.
   */
  proto.addRule = function addRule(acl) {
    acl = acl || {};
    if (!_.isEmpty(acl)) {
      if (!~this.rules.indexOf(acl)) {
        debug('%s add rule %o', this.name, acl);
        this.rules.push(acl);
        this.reloadRules();
      }
      return true;
    }
    return false;
  };

  /**
   * Reload the ACL list adding to the blacklist the services
   */
  proto.reloadRules = function reloadBlacklist() {
    var services = _.map(Service.list, function (service) {
      return {
        name: service.name,
        address: service.address,
        port: service.port
      }
    });
    _.forEach(services, function (service) {
      proto.checkService(service, true);
    });
  };

  /**
   * Remove a rule from the ACL list used to block a service or a group of services.
   * @param {Object} acl An object with a regular expression as value for every property.
   * @param {String|RegExp} acl.name The name of the blocked service.
   * @param {String|RegExp} acl.address The name of the blocked service.
   * @param {Number|RegExp} acl.port The port of the blocked service.
   */
  proto.removeRule = function removeRule(acl) {
    acl = acl || {};
    if (!_.isEmpty(acl) && !_.isEmpty(this.rules)) {
      debug('%s remove rule %o', this.name, acl);
      var acls = _.where(this.rules, acl);
      if (!_.isEmpty(acls)) {
        var i, idx;
        for (i = acls.length - 1; i >=0; i--) {
          idx = this.rules.indexOf(acls[i]);
          if (~idx) {
            this.rules.splice(idx, 1);
            acls.splice(i, 1);
          }
        }
      }
    }
  };

  /**
   * Remove all rules from the ACL list used to block a service or a group of services.
   */
  proto.removeAllRules = function removeAllRules() {
    debug('%s remove all ACL rules', this.name);
    while (this.rules.length > 0) {
      this.rules.pop();
    }
  };

  /**
   * Add a service to the blacklist.
   * @param {Object} service The service to add
   * @param {String} service.name The name of the service.
   * @param {String} service.address The name of the service.
   * @param {Number} service.port The port of the service.
   * @return {Boolean} True if the service is successfully added to the blacklist or it already exists.
   */
  proto.addToBlacklist = function addToBlacklist(service) {
    service = service || {};
    if (!_.isEmpty(service)) {
      if (_.find(this.blacklist, service)) {
        debug('%s add to blacklist %o', this.name, service);
        this.blacklist.push(service);
        // if the service is also discovered it must be destroyed
        _.forEach(_.where(Service.list, service), function (item) {
          item.destroy();
        });
      }
      return true;
    }
    return false;
  };

  /**
   * Remove all items into the blacklist.
   */
  proto.flushBlacklist = function flushBlacklist() {
    debug('%s flush blacklist', this.name);
    while (this.blacklist.length > 0) {
      this.blacklist.pop();
    }
  };

  /**
   * Verify if a service is into the blacklist or match at least one of the optional ACLs or all rules (ACLs list).
   * @param {Object} service The service to check
   * @param {String} service.name The name of the service.
   * @param {String} service.address The name of the service.
   * @param {Number} service.port The port of the service.
   * @param {Array} [rules] An array of ACL objects with a regular expression as value for every property.
   * The ACL have at least one property of the service (name, address, port). If no rule list is provided, the entire
   * ACL list is verified.
   * @param {Boolean} [add = false] add True if you want add the service to the blacklist when the test is true.
   * @return {Boolean} True if the ACL match at least one service into the blacklist.
   */
  proto.checkService = function checkService(service, rules, add) {
    var args = norm(arguments, [norm.object({}), norm.array([]), norm.boolean(false)]);
    service = args[0];
    rules = _.isEmpty(args[1]) ? this.rules : args[1];
    add = args[2];
    var match = false;
    var i;
    var rule;
    var keys;
    var test;
    // verify that the service is into the blacklist
    if (_.findWhere(this.blacklist, service)) {
      match = true;
      add = false;
    } else {
      // verify if the service match at least one ACL
      for (i = 0; i < rules.length; i++) {
        rule = rules[i];
        keys = _.keys(rule);
        test = _.pick(service, keys);
        match = true;
        _.forEach(keys, function (key) {
          match = match && rule[key].test(test[key]);
        });
        if (match) {
          break;
        }
      }
    }
    if (add && match) {
      this.addToBlacklist(service);
    }
    return match;
  };
}

exports.expose = _expose;
exports.announce = _announce;
exports.discovery = _discovery;
exports.execute = _execute;
exports.addMethods = addMethods;
