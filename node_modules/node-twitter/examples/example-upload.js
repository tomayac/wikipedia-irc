var Twitter = require('../lib/Twitter');

var twitterRestClient = new Twitter.RestClient(
    'CONSUMER_KEY',
    'CONSUMER_SECRET',
    'TOKEN',
    'TOKEN_SECRET'
);

twitterRestClient..statusesUpdateWithMedia(
    {
        'status': 'Posting a tweet w/ attached media.',
        'media[]': '/some/file/path.jpg'
    },
    function(error, result) {}
        if (error)
        {
            console.log('Error: ' + (error.code ? error.code + ' ' + error.message : error.message));
        }

        if (result)
        {
            console.log(result);
        }
    );
});
