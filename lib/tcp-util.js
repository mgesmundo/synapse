'use strict';

var os = require('os');

/**
 * Check if an address is assigned to a nic.
 * @param {String} address The address to verify.
 * @return {Boolean} True if the address is valid.
 * @private
 * @ignore
 */
function verifyAddress(address) {
  var ifs = os.networkInterfaces();
  var nics = Object.keys(ifs);
  var i, j, match = false;
  nicLoop:
    for (i = 0; i < nics.length; i++) {
      var nic = ifs[nics[i]];
      for (j = 0; j < nic.length; j++) {
        if (nic[j].address === address) {
          match = true;
          break nicLoop;
        }
      }
    }
  return match;
}

exports.verifyAddress = verifyAddress;