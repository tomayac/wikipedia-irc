var Twitter = require('../lib/Twitter');

var twitterSearchClient = new Twitter.SearchClient(
    'CONSUMER_KEY',
    'CONSUMER_SECRET',
    'TOKEN',
    'TOKEN_SECRET'
);

twitterSearchClient.search({'q': 'node.js'}, function(error, result) {
    if (error)
    {
        console.log('Error: ' + (error.code ? error.code + ' ' + error.message : error.message));
    }

    if (result)
    {
        console.log(result);
    }
});
