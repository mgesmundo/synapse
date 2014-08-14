var Synapse = require('..')();
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