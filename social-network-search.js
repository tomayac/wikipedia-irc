var request = require('request');
var twitter = require('ntwitter');

var twit = new twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

// Google+: https://developers.google.com/+/api/latest/activities/search
// Facebook: https://developers.facebook.com/docs/reference/api/#searching
// Twitter: https://dev.twitter.com/docs/api/1.1/get/search

// global configuration data
var MAX_RESULTS = 2;

// triggers realtime search on several social networks
var socialNetworkSearch = function(terms, callback) {
  var socialNetworks = {
    GooglePlus: function search(term) {
      var url = 'https://www.googleapis.com/plus/v1/activities?';
      var query = 'query=' + encodeURIComponent('"' + term + '"');
      var maxResults = '&maxResults=' + MAX_RESULTS;
      var orderBy = '&orderBy=recent';
      var key = '&key=' + process.env.GOOGLE_KEY;
      url += query + maxResults + orderBy + key;
      request.get(url, function(error, response, body) {
        if (!error && response.statusCode == 200) {
          var json;
          try {
            json = JSON.parse(body);
          } catch(e) {
            json = false;
          }
          retrieveGooglePlusResults(json.items, networksDelivered, term);
        } else {
          retrieveGooglePlusResults({}, networksDelivered, term);
        }
      });
    },
    Twitter: function(term) {
      twit.search(
          encodeURIComponent('"' + term + '" -"RT "'),
          {
            rpp: MAX_RESULTS,
            result_type: 'recent',
            include_entities: true,
          },
          function(err, body) {
        if ((!err) && (body.statuses) && (body.statuses.length)) {
          retrieveTwitterResults(body.statuses, networksDelivered, term);
        } else {
          retrieveTwitterResults({}, networksDelivered, term);
        }
      });
    },
    Facebook: function(term) {
      var url = 'https://graph.facebook.com/search?';
      var q = 'q=' + encodeURIComponent('"' + term + '"');
      var type = '&type=post';
      var limit = '&limit=' + MAX_RESULTS;
      url += q + type + limit;
      request.get(url, function(error, response, body) {
        if (!error && response.statusCode == 200) {
          var json;
          try {
            json = JSON.parse(body);
          } catch(e) {
            json = false;
          }
          retrieveFacebookResults(json.data, networksDelivered, term);
        } else {
          retrieveFacebookResults({}, networksDelivered, term);
        }
      });
    }
  };

  // retrieves Twitter results
  var retrieveTwitterResults = function(results, networksDelivered, term) {
    if (results.length) {
      var curatedResults = [];
      results.forEach(function(result) {
        var user = result.user.screen_name;
        var realname = result.user.name;
        var micropost = result.text;
        var avatar = result.profile_image_url_https;
        var creationDate = result.created_at;
        var timestamp = Date.parse(creationDate);
        var deepLink = 'https://twitter.com/' + user + '/status/' +
            result.id_str;
        var profileLink = 'https://twitter.com/' + user;
        curatedResults.push({
          user: '@' + user,
          micropost: micropost,
          avatar: avatar,
          creationDate: creationDate,
          timestamp: timestamp,
          deepLink: deepLink,
          profileLink: profileLink
        });
      });
      networksDelivered[term].Twitter = curatedResults;
      returnNetworksResults(networksDelivered);
    } else {
      networksDelivered[term].Twitter = true;
      returnNetworksResults(networksDelivered);
    }
  };

  // retrieves Google+ results
  var retrieveGooglePlusResults = function(results, networksDelivered, term) {
    if (results.length) {
      var curatedResults = [];
      results.forEach(function(result) {
        var user = result.actor.displayName;
        var micropost = '';
        if (result.object.content) {
          micropost += ' ' + result.object.content;
        }
        if (result.annotation) {
          micropost += ' ' + result.annotation;
        }
        if ((result.object.attachments) &&
            (result.object.attachments.length > 0)) {
          for (var i = 0, le = result.object.attachments.length; i < le; i++) {
            var attachment = result.object.attachments[i];
            if (attachment.objectType === 'article') {
              if (attachment.displayName) {
                micropost += ' ' + attachment.displayName;
              }
              if ((attachment.url) &&
                  (micropost.indexOf(attachment.url) === -1)) {
                micropost += ' ' + attachment.url;
              }
              break;
            } else if (attachment.objectType === 'photo') {
              if (attachment.displayName) {
                micropost += ' ' + attachment.displayName;
              }
              if ((attachment.image.url) &&
                  (micropost.indexOf(attachment.image.url) === -1)) {
                micropost += ' ' + attachment.image.url;
              }
              break;
            } else if (attachment.objectType === 'video') {
              if (attachment.displayName) {
                micropost += ' ' + attachment.displayName;
              }
              if ((attachment.embed) && (attachment.embed.url) &&
                  (micropost.indexOf(attachment.embed.url) === -1)) {
                micropost += ' ' + attachment.embed.url;
              }
              break;
            }
          }
        }
        var avatar = result.actor.image.url;
        var creationDate = result.published;
        var timestamp = (new Date(creationDate)).getTime();
        var deepLink = result.url;
        var profileLink = result.actor.url;
        curatedResults.push({
          user: user,
          micropost: micropost.trim().replace(/<(?:.|\n)*?>/gm, ''),
          avatar: avatar,
          creationDate: creationDate,
          timestamp: timestamp,
          deepLink: deepLink,
          profileLink: profileLink
        });
      });
      networksDelivered[term].GooglePlus = curatedResults;
      returnNetworksResults(networksDelivered);
    } else {
      networksDelivered[term].GooglePlus = true;
      returnNetworksResults(networksDelivered);
    }
  };

  // retrieves Facebook results
  var retrieveFacebookResults = function(results, networksDelivered, term) {
    if (results.length) {
      var curatedResults = [];
      results.forEach(function(result) {
        if (!result.from) {
          return;
        }
        var user = result.from.name;
        var micropost = ''
        if (result.message) {
          micropost += result.message;
        }
        if (result.name) {
          micropost += ' ' + result.name;
        }
        if (result.description) {
          micropost += ' ' + result.description;
        }
        if (result.link) {
          micropost += ' ' + result.link;
        }

        var avatar = 'https://graph.facebook.com/' + result.from.id +
            '/picture';
        var creationDate = result.created_time;
        var timestamp = Date.parse(creationDate);
        var deepLink = 'https://www.facebook.com/permalink.php?story_fbid=' +
            result.id.split(/_/)[1] + '&id=' + result.from.id;
        var profileLink = 'https://www.facebook.com/profile.php?id=' +
            result.from.id;
        curatedResults.push({
          user: user,
          micropost: micropost,
          avatar: avatar,
          creationDate: creationDate,
          timestamp: timestamp,
          deepLink: deepLink,
          profileLink: profileLink
        });
      });
      networksDelivered[term].Facebook = curatedResults;
      returnNetworksResults(networksDelivered);
    } else {
      networksDelivered[term].Facebook = true;
      returnNetworksResults(networksDelivered);
    }
  };

  var returnNetworksResults = function(networksDelivered) {
    for (var term in networksDelivered) {
      for (var network in networksDelivered[term]) {
        if (!networksDelivered[term][network]) {
          return;
        }
      }
    }
    callback(networksDelivered);
  }

  var networksDelivered = {};
  for (var term in terms) {
    // needed to see if all social networks have returned results
    networksDelivered[term] = {
      GooglePlus: false,
      Facebook: false,
      Twitter: false
    };
    for (var network in socialNetworks) {
      socialNetworks[network](term);
    }
  }
};

module.exports = socialNetworkSearch;