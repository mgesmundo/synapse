/*global describe, before, it */

var Rpc = require('../index')({
  loopback: false,
  minSrvPort: 5000,
  maxSrvPort: 5010,
  timeout: 50
});

var path = require('path');
var ip = require('ip');
var should = require('should');
var _ = require('underscore');
var util = require('util');
var sinon = require('sinon');

function sum(a, b, callback) {
  if (!isNaN(a) && !isNaN(b)) {
    callback(null, a + b);
  } else {
    callback('two numbers required');
  }
}

function sub(a, b, callback) {
  if (!isNaN(a) && !isNaN(b)) {
    callback(null, a - b);
  } else {
    callback('two numbers required');
  }
}

function executeMethod(rpc, method, done) {
  rpc.on('announce', function (config) {
    config.name.should.eql('(child)');
    rpc.execute(method, 1, 2, function (err, result) {
      child.kill();
      should.not.exists(err);
      result.should.eql(3);
      rpc.stop(done);
    });
  });
  rpc.start();
  var child = require('child_process').fork(path.resolve(__dirname, './child-service'));
  child.pid.should.not.eql(process.pid);
}

describe('Synapse', function() {
  it('should receive a local "start" event', function(done) {
    var rpc = new Rpc({
      name: 'main'
    });
    rpc.on('start', function (config) {
      config.name.should.equal('main');
      config.address.should.equal(ip.address());
      config.port.should.within(5000, 5010);
      config.should.have.property('meta');
      setTimeout(function () {
        rpc.stop(done);
      }, 50);
    });
    rpc.start();
  });
  it('should use a given port', function(done) {
    var rpc = new Rpc({
      name: 'port',
      port: 7000
    });
    rpc.start(function (err, config) {
      should.not.exists(err);
      config.name.should.equal('port');
      config.address.should.equal(ip.address());
      config.port.should.equal(7000);
      config.should.have.property('meta');
      setTimeout(function () {
        rpc.stop(done);
      }, 50);
    });
  });
  it('should receive a foreign start event (announce)', function(done) {
    var rpc = new Rpc({
      name: 'main2'
    });
    var child;
    rpc.once('announce', function (config) {
      child.kill();
      config.name.should.equal('(child)');
      config.address.should.equal(ip.address());
      config.port.should.within(6000, 6010);
      config.meta.should.eql({info: 'info'});
      rpc.stop(done);
    });
    rpc.start(function (err, config) {
      should.not.exists(err);
      config.name.should.equal('main2');
      config.address.should.equal(ip.address());
      config.port.should.within(5000, 5010);
      child = require('child_process').fork(path.resolve(__dirname, './child-service'));
      child.pid.should.not.eql(process.pid);
    });
  });
  it('should receive remote methods', function(done) {
    var rpc = new Rpc({
      name: 'main3'
    });
    rpc.once('announce', function (config) {
      child.kill();
      var services = rpc.servicesByName;
      services.should.have.property('(child)');
      services['(child)'].should.be.instanceOf(Array).and.have.lengthOf(1);
      services['(child)'][0].methods.should.have.property('add');
      services['(child)'][0].methods['add'].should.isObject;
      rpc.stop(done);
    });
    rpc.start();
    var child = require('child_process').fork(path.resolve(__dirname, './child-service'));
    child.pid.should.not.eql(process.pid);
  });
  it('should find a service', function(done) {
    var rpc = new Rpc({
      name: 'main4'
    });
    rpc.once('announce', function (config) {
      child.kill();
      rpc.find(config).should.have.lengthOf(1);
      rpc.stop(done);
    });
    rpc.start();
    var child = require('child_process').fork(path.resolve(__dirname, './child-service'));
    child.pid.should.not.eql(process.pid);
  });
  it('should group services by address', function(done) {
    var rpc = new Rpc({
      name: 'main5'
    });
    rpc.once('announce', function (config) {
      child.kill();
      rpc.servicesByAddress.should.have.property(config.address);
      rpc.stop(done);
    });
    rpc.start();
    var child = require('child_process').fork(path.resolve(__dirname, './child-service'));
    child.pid.should.not.eql(process.pid);
  });
  it('should group services by port', function(done) {
    var rpc = new Rpc({
      name: 'main6'
    });
    rpc.once('announce', function (config) {
      child.kill();
      rpc.servicesByPort.should.have.property(config.port);
      rpc.stop(done);
    });
    rpc.start();
    var child = require('child_process').fork(path.resolve(__dirname, './child-service'));
    child.pid.should.not.eql(process.pid);
  });
  it('should remove a service if it is no longer available', function(done) {
    var rpc = new Rpc({
      name: '(remove)'
    });
    var child;
    rpc.once('announce', function (config) {
      var services = rpc.servicesByName;
      services.should.have.property('(child)');
      services['(child)'].should.be.instanceOf(Array).and.have.lengthOf(1);
      services['(child)'][0].methods.should.have.property('add');
      services['(child)'][0].methods['add'].should.isObject;
      _.size(services).should.equal(1);
      setTimeout(function () {
        services = rpc.services;
        services.should.not.have.property('(child)');
        _.isEmpty(services);
        rpc.stop(done);
      }, 100);
      child.kill();
    });
    rpc.start(function (err, config) {
      should.not.exists(err);
      config.name.should.equal('(remove)');
      child = require('child_process').fork(path.resolve(__dirname, './child-service'));
      child.pid.should.not.eql(process.pid);
    });
  });
  it('should have the "running" property true when rpc starts', function(done) {
    var rpc = new Rpc({
      name: '(running)'
    });
    rpc.running.should.false;
    rpc.start(function () {
      rpc.running.should.true;
      rpc.stop(done);
    });
  });
  it('should emit "save" when saving a service', function(done) {
    var rpc = new Rpc({
      name: '(save)'
    });
    rpc.on('save', function (service) {
      child.kill();
      service.name.should.eql('(child)');
      service.port.should.eql(6000);
      service.meta.should.eql({info: 'info'});
      rpc.stop(done);
    });
    rpc.start();
    var child = require('child_process').fork(path.resolve(__dirname, './child-service'));
    child.pid.should.not.eql(process.pid);
  });
  it('should emit "destroy" when destroying a service', function(done) {
    var rpc = new Rpc({
      name: '(save)'
    });
    rpc.on('destroy', function (service) {
      service.name.should.eql('(child)');
      service.port.should.eql(6000);
      rpc.stop(done);
    });
    rpc.on('save', function (service) {
      child.kill();
    });
    rpc.start();
    var child = require('child_process').fork(path.resolve(__dirname, './child-service'));
    child.pid.should.not.eql(process.pid);
  });
  it('should expose a method', function(done) {
    var rpc = new Rpc({
      name: '(expose)'
    });
    rpc.on('expose', function (name, fn) {
      name.should.eql('sum');
      fn.should.eql(sum);
      rpc.stop(done);
    });
    rpc.start(function () {
      rpc.expose('sum', sum);
    });
  });
  it('should set a meta option', function(done) {
    var rpc = new Rpc({
      name: '(meta)'
    });
    rpc.on('start', function (config) {
      config.meta.should.eql({info: 'meta'});
      rpc.stop(done);
    });
    rpc.start({info: 'meta'});
  });
  it('should expose two methods', function(done) {
    var rpc = new Rpc({
      name: '(expose)'
    });
    var methods = {
      sum: sum,
      sub: sub
    };
    rpc.on('expose', function (name, fn) {
      name.should.eql(methods);
      should.not.exists(fn);
      rpc.stop(done);
    });
    rpc.start(function () {
      rpc.expose(methods);
    });
  });
  it('should execute a remote method with method name only', function(done) {
    var rpc = new Rpc({
      name: '(save)'
    });
    var method = 'add';
    executeMethod(rpc, method, done);
  });
  it('should execute a remote method with service name', function(done) {
    var rpc = new Rpc({
      name: '(save)'
    });
    var method = '(child).add';
    executeMethod(rpc, method, done);
  });
  it('should execute a remote method with service name and address', function(done) {
    var rpc = new Rpc({
      name: '(save)'
    });
    var method = util.format('(child)@%s.add', ip.address());
    executeMethod(rpc, method, done);
  });
  it('should execute a remote method with full qualified service name', function(done) {
    var rpc = new Rpc({
      name: '(save)'
    });
    var method = util.format('(child)@%s:6000.add', ip.address());
    executeMethod(rpc, method, done);
  });
  it('should execute a remote method when there are two services with the same name', function(done) {
    var rpc = new Rpc({
      name: '(save)'
    });
    rpc.on('announce', function (config) {
      if (rpc.services.length === 2) {
        var method = util.format('(child)@%s:6001.add', ip.address());
        rpc.execute(method, 1, 2, function (err, result) {
          child.kill();
          child2.kill();
          should.not.exists(err);
          result.should.eql(3);
          rpc.stop(done);
        });
      }
    });
    rpc.start();
    var child = require('child_process').fork(path.resolve(__dirname, './child-service'));
    child.pid.should.not.eql(process.pid);
    var child2;
    setTimeout(function () {
      child2 = require('child_process').fork(path.resolve(__dirname, './child-service'));
      child2.pid.should.not.eql(process.pid);
    }, 200);
  });
  it('should receive an error executing a remote method with wrong parameters', function(done) {
    var rpc = new Rpc({
      name: '(save)'
    });
    rpc.on('announce', function (config) {
      config.name.should.eql('(child)');
      rpc.execute('add', 1, function (err, result) {
        child.kill();
        should.not.exists(result);
        err.should.eql(new Error('two numbers required'));
        rpc.stop(done);
      });
    });
    rpc.start();
    var child = require('child_process').fork(path.resolve(__dirname, './child-service'));
    child.pid.should.not.eql(process.pid);
  });
  it('should receive an error executing a non existing remote method', function(done) {
    var rpc = new Rpc({
      name: '(save)'
    });
    rpc.on('announce', function (config) {
      config.name.should.eql('(child)');
      rpc.execute('sum', 1, 2, function (err, result) {
        child.kill();
        should.not.exists(result);
        err.should.eql(new Error('method not found'));
        rpc.stop(done);
      });
    });
    rpc.start();
    var child = require('child_process').fork(path.resolve(__dirname, './child-service'));
    child.pid.should.not.eql(process.pid);
  });
  it('should receive an error executing a non unique remote method', function(done) {
    var rpc = new Rpc({
      name: '(save)'
    });
    rpc.on('announce', function (config) {
      if (rpc.services.length === 2) {
        rpc.execute('add', 1, 2, function (err, result) {
          child.kill();
          child2.kill();
          should.not.exists(result);
          err.should.eql(new Error('not unique method found'));
          rpc.stop(done);
        });
      }
    });
    rpc.start();
    var child = require('child_process').fork(path.resolve(__dirname, './child-service'));
    child.pid.should.not.eql(process.pid);
    var child2;
    setTimeout(function () {
      child2 = require('child_process').fork(path.resolve(__dirname, './child-service'));
      child2.pid.should.not.eql(process.pid);
    }, 200);
  });
  it('should\'t receive discovery requests in ghost mode', function(done) {
    var rpc = new Rpc({
      name: '(ghost)'
    });
    rpc.on('announce', function (config) {
      child.kill();
      config.name.should.eql('(child)');
      setTimeout(function () {
        rpc.stop(done);
      }, 200);
    });
    rpc.start(true, function (err, config) {
      should.not.exists(err);
      config.port.should.eql('ghost');
    });
    var child = require('child_process').fork(path.resolve(__dirname, './child-service'));
    child.pid.should.not.eql(process.pid);
  });
  it('should unable to start in ghost mode with exposed method', function(done) {
    var rpc = new Rpc({
      name: '(ghost)'
    });
    rpc.expose('sum', sum);
    rpc.on('error', function (err) {
      err.should.eql(new Error('(ghost) unable start in ghost mode with exposed methods'));
      rpc.stop(done);
    });
    rpc.start(true);
  });
  it('should unable to expose method in ghost mode', function(done) {
    var rpc = new Rpc({
      name: '(ghost)'
    });
    rpc.on('error', function (err) {
      err.should.eql(new Error('(ghost) unable expose methods in ghost mode'));
      rpc.stop(done);
    });
    rpc.start(true, function (err, config) {
      rpc.expose('sum', sum);
    });
  });
  it('should find a method by name', function(done) {
    var rpc = new Rpc({
      name: '(find)'
    });
    rpc.once('announce', function (config) {
      child.kill();
      var services = rpc.findByMethod('add');
      services.should.be.instanceOf(Array).and.have.lengthOf(1);
      services[0].methods.should.have.property('add');
      services[0].methods['add'].should.isObject;
      rpc.stop(done);
    });
    rpc.start();
    var child = require('child_process').fork(path.resolve(__dirname, './child-service'));
    child.pid.should.not.eql(process.pid);
  });
  it('should group services by method', function(done) {
    var rpc = new Rpc({
      name: '(group by method)'
    });
    rpc.on('announce', function (config) {
      if (rpc.services.length === 2) {
        child.kill();
        child2.kill();
        var services = rpc.servicesByMethod;
        services.should.have.property('add');
        services['add'].should.be.instanceOf(Array).and.have.lengthOf(2);
        services['add'][0].port.should.eql(6000);
        services['add'][1].port.should.eql(6001);
        _.size(services).should.equal(1);
        rpc.stop(done);
      }
    });
    rpc.start();
    var child = require('child_process').fork(path.resolve(__dirname, './child-service'));
    child.pid.should.not.eql(process.pid);
    var child2;
    setTimeout(function () {
      child2 = require('child_process').fork(path.resolve(__dirname, './child-service'));
      child2.pid.should.not.eql(process.pid);
    }, 200);
  });
  it('should add and remove an ACL rule', function(done) {
    var rpc = new Rpc({
      name: '(acl)'
    });
    var acl = {
      name: /\([\s\S]+\)/i    // match any name inside two brackets (case insensitive)
    };
    rpc.addRule(acl);
    rpc.rules.should.be.instanceOf(Array).and.have.lengthOf(1);
    rpc.rules[0].should.eql(acl);
    rpc.removeRule(acl);
    rpc.rules.should.be.instanceOf(Array).and.have.lengthOf(0);
    done();
  });
  it('should remove all ACL rules', function(done) {
    var rpc = new Rpc({
      name: '(acl)'
    });
    var acl1 = {
      name: /\([\s\S]+\)/i    // match any name inside two brackets (case insensitive)
    };
    var acl2 = {
      name: /\(name\)/i    // match only the exact name inside two brackets (case insensitive)
    };
    rpc.addRule(acl1);
    rpc.addRule(acl2);
    rpc.rules.should.be.instanceOf(Array).and.have.lengthOf(2);
    rpc.rules[0].should.eql(acl1);
    rpc.rules[1].should.eql(acl2);
    rpc.removeAllRules();
    rpc.rules.should.be.instanceOf(Array).and.have.lengthOf(0);
    done();
  });
  it('should add an ACL rule and add a service to blacklist when verify it', function(done) {
    var rpc = new Rpc({
      name: '(acl)'
    });
    rpc.addRule({
      name: /\([\s\S]+\)/i    // match any name inside two brackets (case insensitive)
    });
    var service = {
      name: '(name)'
    };
    var match = rpc.checkService(service, true);
    match.should.true;
    rpc.blacklist.should.be.instanceOf(Array).and.have.lengthOf(1);
    rpc.blacklist[0].should.eql(service);
    done();
  });
  it('should add an ACL rule and not add a service to blacklist if it is already blocked', function(done) {
    var rpc = new Rpc({
      name: '(acl)'
    });
    rpc.addRule({
      name: /\([\s\S]+\)/i    // match any name inside two brackets (case insensitive)
    });
    var service = {
      name: '(name)'
    };
    rpc.addToBlacklist(service);
    rpc.blacklist.should.be.instanceOf(Array).and.have.lengthOf(1);
    rpc.blacklist[0].should.eql(service);
    var match = rpc.checkService(service, true);
    match.should.true;
    rpc.blacklist.should.be.instanceOf(Array).and.have.lengthOf(1);
    rpc.blacklist[0].should.eql(service);
    done();
  });

  it('should do not receive announce from a blocked service', function(done) {
    var rpc = new Rpc({
      name: '(acl)'
    });
    rpc.addRule({
      name: /\(child\)/i    // match any name inside two brackets (case insensitive)
    });
    var service = {
      name: '(child)'
    };
    rpc.addToBlacklist(service);
    var onAnnounce = sinon.spy();
    rpc.on('announce', onAnnounce);
    rpc.on('blacklist', function (config) {
      child.kill();
      config.name.should.equal(service.name);
      onAnnounce.called.should.false;
      rpc.stop(done);
    });
    rpc.start();
    var child = require('child_process').fork(path.resolve(__dirname, './child-service'));
  });
  it('should remove a discovered service if it is added to the blacklist', function(done) {
    var rpc = new Rpc({
      name: '(acl)'
    });
    rpc.on('announce', function (config) {
      config.name.should.equal('(child)');
      rpc.addToBlacklist(config);
    });
    rpc.on('destroy', function (config) {
      child.kill();
      config.name.should.equal('(child)');
      rpc.stop(done);
    });
    rpc.start();
    var child = require('child_process').fork(path.resolve(__dirname, './child-service'));
  });
  it('should flush the blacklist', function(done) {
    var rpc = new Rpc({
      name: '(acl)'
    });
    rpc.addRule({
      name: /\(child\)/i    // match any name inside two brackets (case insensitive)
    });
    var service = {
      name: '(child)'
    };
    rpc.addToBlacklist(service);
    rpc.blacklist.should.have.lengthOf(1);
    rpc.blacklist[0].should.eql(service);
    rpc.flushBlacklist();
    rpc.blacklist.should.have.lengthOf(0);
    done();
  });
});