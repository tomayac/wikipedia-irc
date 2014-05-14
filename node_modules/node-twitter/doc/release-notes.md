# node-twitter Release Notes

## Version 0.5.0

*Published on 2012-05-08*

* [FEATURE] Added full support for the following [Twitter REST API](https://dev.twitter.com/docs/api) endpoints:
  * [Direct Messages](https://dev.twitter.com/docs/api#direct-messages)
* [FEATURE] Added partial support for the following [Twitter REST API](https://dev.twitter.com/docs/api) endpoints:
  * [Friends & Followers](https://dev.twitter.com/docs/api#friends-followers)
  * [Users](https://dev.twitter.com/docs/api#users)

## Version 0.4.6

*Published on 2012-04-19*

* [FIXED] [Issue #6 StreamClient crashes on response data contains with terminator but no stream object.](https://github.com/istrategylabs/node-twitter/issues/6).

## Version 0.4.5

*Published on 2012-04-13*

* [FIXED] [Issue #2 SyntaxError: unexpected end of input](https://github.com/iStrategyLabs/node-twitter/issues/2)
* [FIXED] Improved stability 

## Version 0.4.4

*Published on 2012-04-10*

* [FIXED] Issue preventing disconnection from the Twitter stream after StreamClient.stop() has been called.

## Version 0.4.3

*Published on 2012-04-10*

* [FIXED] Corrected version in package.json

## Version 0.4.2

*Published on 2012-04-10*

* [FIXED] Updated API documentation.

## Version 0.4.1

*Published on 2012-03-19*

* [FEATURE] Added support for the following [Twitter REST API](https://dev.twitter.com/docs/api) endpoints:
  * [GET search](https://dev.twitter.com/docs/api/1/get/search)

## Version 0.3.0

*Published on 2012-03-07*

* [FEATURE] Added support for the following [Twitter REST API](https://dev.twitter.com/docs/api) endpoints:
  * [GET statuses/:id/retweeted_by](https://dev.twitter.com/docs/api/1/get/statuses/%3Aid/retweeted_by)
  * [GET statuses/:id/retweeted_by/ids](https://dev.twitter.com/docs/api/1/get/statuses/%3Aid/retweeted_by/ids)
  * [GET statuses/retweets/:id](https://dev.twitter.com/docs/api/1/get/statuses/retweets/%3Aid)
  * [GET statuses/show/:id](https://dev.twitter.com/docs/api/1/get/statuses/show/%3Aid)
  * [POST statuses/destroy/:id](https://dev.twitter.com/docs/api/1/post/statuses/destroy/%3Aid)
  * [POST statuses/retweet/:id](https://dev.twitter.com/docs/api/1/post/statuses/retweet/%3Aid)
  * [POST statuses/update](https://dev.twitter.com/docs/api/1/post/statuses/update)
  * [POST statuses/update_with_media](https://dev.twitter.com/docs/api/1/post/statuses/update_with_media)
  * [GET statuses/oembed](https://dev.twitter.com/docs/api/1/get/statuses/oembed)

## Version 0.2.0

*Published on 2012-01-24*

* [FEATURE] Provides initial support for the [Twitter REST API](https://dev.twitter.com/docs/api).

## Version 0.1.3

*Published on 2012-01-03*

* [FIXED] Error events are emitted for some common HTTP error codes.
* [FIXED] [Issue #2 SyntaxError: unexpected end of input](https://github.com/iStrategyLabs/node-twitter/issues/2)

## Version 0.1.2

*Published on 2011-12-19*

* [FIXED] Issue causing a '401 Unauthorized' error when attempting to track multiple keywords.

## Version 0.1.1

*Published on 2011-12-06*

* [FIXED] Firing an 'error' event now provides an error object.

## Version 0.1.0

*Published on 2011-12-05*

* Initial release provides support for the [Twitter Streaming API](https://dev.twitter.com/docs/streaming-api).
