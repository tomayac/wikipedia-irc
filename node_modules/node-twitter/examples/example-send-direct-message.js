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
  twitter.directMessagesNew(
    { screen_name: "coolaj86"
    , user_id: 15191378 // optional, but a good idea
    , text: "I'm using your nodejs/twitter example!"
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
