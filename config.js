function readConfig() {
  var fileName = './config.json';
  var text = require("fs").readFileSync(fileName);
  if (!text) {
    throw new Error('Couldn\'t read config file ' + filename);
  }
  var config = JSON.parse(text);
  return config;
}

module.exports = readConfig();