function readConfig() {
  var fileName = './config.json';
  var text = require("fs").readFileSync(fileName);
  if (!text) {
    throw new Error('Couldn\'t read config file ' + fileName);
  }
  var config;
  try {
    config = JSON.parse(text);
  } catch(e) {
    throw new Error('The config file is not valid JSON: ' + e);
  }
  return config;
}

module.exports = readConfig();