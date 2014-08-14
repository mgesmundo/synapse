var Synapse = require('..')();
var node1 = new Synapse({
  name: 'node1'
});
node1.expose({
  sum: function (a, b, cb) {
    cb(null, a + b);
  },
  sub: function (a, b, cb) {
    cb(null, a - b);
  }
});
node1.start(function () {
  console.log('node1 is ready');
});