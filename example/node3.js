var Synapse = require('..')();
var node3 = new Synapse({
  name: 'node3'
});
var announces = 0;
node3.on('announce', function (config) {
  console.log('announce from ' + config.name);
  announces++;
  if (announces === 2) {
    node3.execute('sum', 1, 2, function (err, result) {
      console.log('sum = ' + result);
    });
    node3.execute('sub', 1, 2, function (err, result) {
      console.log('sub = ' + result);
    });
    node3.execute('mul', 1, 2, function (err, result) {
      console.log('nul = ' + result);
    });
    node3.execute('div', 1, 2, function (err, result) {
      console.log('div = ' + result);
    });
  }
});
node3.start(function () {
  console.log('node3 is ready');
});
node3.on('destroy', function (service) {
  console.log('node ' + service.name + ' is no longer available');
});
