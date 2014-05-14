var Twitter = require('../lib/Twitter');

var twitterStreamClient = new Twitter.StreamClient(
    'CONSUMER_KEY',
    'CONSUMER_SECRET',
    'TOKEN',
    'TOKEN_SECRET'
);

twitterStreamClient.on('close', function() {
    console.log('Connection closed.');
});
twitterStreamClient.on('end', function() {
    console.log('End of Line.');
});
twitterStreamClient.on('error', function(error) {
    console.log('Error: ' + (error.code ? error.code + ' ' + error.message : error.message));
});
twitterStreamClient.on('tweet', function(tweet) {
    console.log(tweet);
});

twitterStreamClient.start(['baseball', 'basketball', 'football', 'hockey']);
