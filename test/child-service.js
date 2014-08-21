var Rpc = require('../index')({
  minSrvPort: 6000,
  maxSrvPort: 6010
});
var Args = require('vargs').Constructor;

var rpc = new Rpc({
  name: '(child)'
});

rpc.on('error', function (err) {
  console.log(err);
});

function add(a, b, callback) {
  var args = new Args(arguments);
  if (!args.callbackGiven()) {
    debug.error('callback required');
  } else {
    callback = args.callback;
    if (!isNaN(a) && !isNaN(b)) {
      callback(null, a + b);
    } else {
      callback(new Error('two numbers required'));
    }
  }
}

rpc.expose('add', add);

rpc.start({info: 'info'});
