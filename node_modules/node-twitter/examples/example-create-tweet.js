(function () {
  "use strict";

  var config = require('./config.twitter.json')
    , Twitter = require('./node-twitter')
    , twitter
    , token
    , tokenSecret
    ;

  // You could use node-passport and passport-twitter to get an access token easily
  // See http://blog.coolaj86.com/articles/how-to-tweet-from-nodejs.html
  twitter = new Twitter.RestClient(
    config.consumerKey
  , config.consumerSecret
  , token
  , tokenSecret
  );

  // Note that you can only direct message someone who follows you
  twitter.statusesUpdate(
    { status: "Using the twitter api with NodeJS http://blog.coolaj86.com/articles/how-to-tweet-from-nodejs.html via @coolaj86"
    //, in_reply_to_status_id: 357237590082072576
    }
  , function (err, data) {
      if (err) {
        console.error(err);
      } else {
        console.log(data);
      }
    }
  );
}());
