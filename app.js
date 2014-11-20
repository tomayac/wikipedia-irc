require('http').createServer(function (req, res) {
  var url = 'http://wikipedia-live-monitor.herokuapp.com/';
  res.statusCode = 301;
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Location', url);
  res.end('Redirecting to ' + url);
}).listen(process.env.PORT || 8080);
