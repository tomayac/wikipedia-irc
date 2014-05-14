# Description

node-twitter is a node.js module for interacting with the Twitter API.

# Examples

## REST

The Twitter REST API can be accessed using Twitter.RestClient. The following code example shows how to retrieve tweets from the authenticated user's timeline.

```javascript
var Twitter = require('node-twitter');

var twitterRestClient = new Twitter.RestClient(
    'CONSUMER_KEY',
    'CONSUMER_SECRET',
    'TOKEN',
    'TOKEN_SECRET'
);

twitterRestClient.statusesHomeTimeline({}, function(error, result) {
    if (error)
    {
        console.log('Error: ' + (error.code ? error.code + ' ' + error.message : error.message));
    }

    if (result)
    {
        console.log(result);
    }
});
```

## Search

The Twitter Search API can be accessed using Twitter.SearchClient. The following code example shows how to search for tweets containing the keyword "node.js".

```javascript
var Twitter = require('node-twitter');

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
```

## Streaming

The Twitter Streaming API can be accessed using Twitter.StreamClient. The following code example shows how to catch all tweets containing the keywords "baseball", "basketball", "football" or "hockey".

```javascript
var Twitter = require('node-twitter');

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
```

## Upload

Tweets with attached image media (JPG, PNG or GIF) can be posted using the upload API endpoint.

```javascript
var Twitter = require('node-twitter');

var twitterRestClient = new Twitter.RestClient(
    'CONSUMER_KEY',
    'CONSUMER_SECRET',
    'TOKEN',
    'TOKEN_SECRET'
);

twitterRestClient..statusesUpdateWithMedia(
    {
        'status': 'Posting a tweet w/ attached media.',
        'media[]': '/some/absolute/file/path.jpg'
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
```

# License

node-twitter is made available under terms of the [BSD 3-Clause License](http://www.opensource.org/licenses/BSD-3-Clause).

# Unit Tests

To run the unit tests, open tests/UnitTestMain.js in a text editor and replace the OAuth placeholder values with your OAuth credentials. 

Save the file then, from the command line, run:

    make test
