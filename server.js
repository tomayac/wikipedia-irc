var irc = require('irc');
var request = require('request');
var express = require('express');
var http = require('http');
var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);
var socialNetworkSearch = require('./social-network-search.js');
var config = require('./config.js');
var twitter = require('ntwitter');

// verbous debug mode
var VERBOUS = false;
// really very verbous debug mode
var REALLY_VERBOUS = false;

// whether to only monitor the 1,000,000+ articles Wikipedias,
// or also the 100,000+ articles Wikipedias.
var MONITOR_LONG_TAIL_WIKIPEDIAS = true;

// required for Wikipedia API
var USER_AGENT = 'Wikipedia Live Monitor * IRC nick: wikipedia-live-monitor * Contact: tomac(a)google.com.';

// an article cluster is thrown out of the monitoring loop if its last edit is
// longer ago than SECONDS_SINCE_LAST_EDIT seconds
var SECONDS_SINCE_LAST_EDIT = 240;

// an article cluster may have at max SECONDS_BETWEEN_EDITS seconds in between
// edits in order to be regarded a breaking news candidate
var SECONDS_BETWEEN_EDITS = 60;

// an article cluster must have at least BREAKING_NEWS_THRESHOLD edits before it
// is considered a breaking news candidate
var BREAKING_NEWS_THRESHOLD = 5;

// an article cluster must be edited by at least NUMBER_OF_CONCURRENT_EDITORS
// concurrent editors before it is considered a breaking news candidate
var NUMBER_OF_CONCURRENT_EDITORS = 2;

// Wikipedia edit bots can account for many false positives, so usually we want
// to discard them
var DISCARD_WIKIPEDIA_BOTS = true;

// IRC details for the recent changes live updates
var IRC_SERVER = 'irc.wikimedia.org';
var IRC_NICK = 'wikipedia-live-monitor';

// the maximum length of http://t.co links
var TWITTER_SHORT_URL_LENGTH = 23;

// if enabled, breaking news candidates will be tweeted
var TWEET_BREAKING_NEWS_CANDIDATES = false;

if (TWEET_BREAKING_NEWS_CANDIDATES) {
  var twit = new twitter({
    consumer_key: config.twitter_consumer_key,
    consumer_secret: config.twitter_consumer_secret,
    access_token_key: config.twitter_access_token_key,
    access_token_secret: config.twitter_access_token_secret
  });

  twit.verifyCredentials(function(err, data) {
    if (err) {
      console.log('Twitter authentication error: ' + err);
    }
  });

  var recentTweetsBuffer = [];
}

// IRC rooms are of the form #lang.wikipedia
// the list of languages is here:
// http://meta.wikimedia.org/wiki/List_of_Wikipedias#All_Wikipedias_ordered_by_number_of_articles
// http://meta.wikimedia.org/wiki/List_of_Wikipedias#1_000_000.2B_articles
var millionPlusLanguages = {
  en: true,
  de: true,
  fr: true,
  nl: true
};

// http://meta.wikimedia.org/wiki/List_of_Wikipedias#100_000.2B_articles
var oneHundredThousandPlusLanguages = {
  it: true,
  pl: true,
  es: true,
  ru: true,
  ja: true,
  pt: true,
  zh: true,
  vi: true,
  sv: true,
  uk: true,
  ca: true,
  no: true,
  fi: true,
  cs: true,
  fa: true,
  hu: true,
  ro: true,
  ko: true,
  ar: true,
  tr: true,
  id: true,
  sk: true,
  eo: true,
  da: true,
  kk: true,
  sr: true,
  lt: true,
  ms: true,
  he: true,
  eu: true,
  bg: true,
  sl: true,
  vo: true,
  hr: true,
  war: true,
  hi: true,
  et: true
};

var IRC_CHANNELS = [];
var PROJECT = '.wikipedia';
Object.keys(millionPlusLanguages).forEach(function(language) {
  IRC_CHANNELS.push('#' + language + PROJECT);
});
if (MONITOR_LONG_TAIL_WIKIPEDIAS) {
  Object.keys(oneHundredThousandPlusLanguages).forEach(function(language) {
    IRC_CHANNELS.push('#' + language + PROJECT);
  });
}

var client = new irc.Client(
    IRC_SERVER,
    IRC_NICK,
    {
      channels: IRC_CHANNELS
    });

// global objects, required to keep track of the currently monitored articles
// and article clusters for the different language versions
var articles = {};
var articleClusters = {};
var articleVersionsMap = {};

function monitorWikipedia() {
  // fires whenever a new IRC message arrives on any of the IRC rooms
  client.addListener('message', function(from, to, message) {
    // this is the Wikipedia IRC bot that announces live changes
    if (from === 'rc-pmtpa') {
      // get the editor's username or IP address
      // the IRC log format is as follows (with color codes removed):
      // rc-pmtpa: [[Juniata River]] http://en.wikipedia.org/w/index.php?diff=516269072&oldid=514659029 * Johanna-Hypatia * (+67) Category:Place names of Native American origin in Pennsylvania
      var messageComponents = message.split('*');
      // remove color codes
      var regex = /\x0314\[\[\x0307(.+?)\x0314\]\]\x034.+?$/;
      var article = message.replace(regex, '$1');
      // discard non-article namespaces, as listed here:
      // http://www.mediawiki.org/wiki/Help:Namespaces
      // this means only listening to messages without a ':' essentially
      if (article.indexOf(':') === -1) {
        var editor = messageComponents[1]
            .replace(/\x0303/g, '')
            .replace(/\x035/g, '')
            .replace(/\u0003/g, '')
            .replace(/^\s*/, '')
            .replace(/\s*$/, '');
        // discard edits made by bots.
        // bots are identified by a B flag, as documented here
        // http://www.mediawiki.org/wiki/Help:Tracking_changes
        // (the 'b' is actually uppercase in IRC)
        //
        // bots must identify themselves by prefixing or suffixing their
        // username with "bot".
        // http://en.wikipedia.org/wiki/Wikipedia:Bot_policy#Bot_accounts
        var flags = messageComponents[0]
            .replace(/.*?\x034\s(.*?)\x0310.+$/, '$1');
        if (DISCARD_WIKIPEDIA_BOTS) {
          if ((/B/.test(flags)) ||
              (/^bot/i.test(editor)) ||
              (/bot$/i.test(editor))) {
            return;
          }
        }
        // normalize article titles to follow the Wikipedia URLs
        article = article.replace(/\s/g, '_');
        var now;
        // the language format follows the IRC room format: "#language.project"
        var language = to.substring(1, to.indexOf('.'));
        editor = language + ':' + editor;
        // used to get the language references for language clustering
        var languageClusterUrl = 'http://' + language +
            '.wikipedia.org/w/api.php?action=query&prop=langlinks' +
            '&format=json&lllimit=500&titles=' + article;
        var options = {
          url: languageClusterUrl,
          headers: {
            'User-Agent': USER_AGENT
          }
        };
        // get language references via the Wikipedia API
        article = language + ':' + article;
        request.get(options, function(error, response, body) {
          getLanguageReferences(error, response, body, article);
        });

        // get diff URL
        var diffUrl = messageComponents[0]
            .replace(/.*?\u000302(.*?)\u0003.+$/, '$1');
        if ((diffUrl.indexOf('diff') !== -1) &&
            (diffUrl.indexOf('oldid') !== -1)) {
          var toRev = diffUrl.replace(/.*\?diff=(\d+).*/, '$1');
          var fromRev = diffUrl.replace(/.*&oldid=(\d+).*/, '$1');
          diffUrl = 'http://' + language +
              '.wikipedia.org/w/api.php?action=compare&torev=' + toRev +
              '&fromrev=' + fromRev + '&format=json';
        } else {
          diffUrl = '';
        }
        var delta = messageComponents[2]
            .replace(/\s\(\u0002?([+-]\d+)\u0002?\)\s\x0310.*?$/, '$1');

        // new article
        if (!articleVersionsMap[article]) {
          now = Date.now();
          articles[article] = {
            timestamp: now,
            occurrences: 1,
            intervals: [],
            editors: [editor],
            languages: {},
            versions: {},
            changes: {}
          };
          articles[article].languages[language] = 1;
          articles[article].changes[now] = {
            diffUrl: diffUrl,
            delta: delta,
            language: language,
            editor: editor
          };
          io.sockets.emit('firstTimeSeen', {
            article: article,
            timestamp: new Date(articles[article].timestamp),
            editors: [editor],
            languages: articles[article].languages,
            versions: articles[article].versions
          });
          if (VERBOUS && REALLY_VERBOUS) {
            console.log('[ * ] First time seen: "' + article + '". ' +
                'Timestamp: ' + new Date(articles[article].timestamp) + '. ' +
                'Editors: ' + editor + '. ' +
                'Languages: ' + JSON.stringify(articles[article].languages));
          }
        // existing article
        } else {
          var currentArticle = article;
          now = Date.now();
          if (article !== articleVersionsMap[article]) {
            io.sockets.emit('merging', {
              current: article,
              existing: articleVersionsMap[article],
              timestamp: new Date(now)
            });
            if (VERBOUS) {
              console.log('[ ⚭ ] Merging ' + article + ' with ' +
                  articleVersionsMap[article]);
            }
            article = articleVersionsMap[article];
          }
          // update statistics of the article
          articles[article].occurrences += 1;
          articles[article].versions[currentArticle] = true;
          articles[article].intervals.push(now - articles[article].timestamp);
          articles[article].timestamp = now;
          articles[article].changes[now] = {
            diffUrl: diffUrl,
            delta: delta,
            language: language,
            editor: editor
          };
          // we track editors by languages like so: lang:user. if the same user
          // edits an article in different languages, she is logged as
          // lang1:user and lang2:user, but we still consider them the same,
          // and add them like so: lang1,lang2:user.
          var editorPresent = false;
          var presentEditorIndex = 0;
          var currentEditor = editor.split(':')[1];
          for (var i = 0, l = articles[article].editors.length; i < l; i++) {
            if (currentEditor === articles[article].editors[i].split(':')[1]) {
              editorPresent = true;
              presentEditorIndex = i;
              break;
            }
          }
          if (!editorPresent) {
            articles[article].editors.push(editor);
          } else {
            var currentLanguages =
                articles[article].editors[presentEditorIndex].split(':')[0];
            if (currentLanguages.indexOf(language) === -1) {
              currentLanguages = language + ',' + currentLanguages;
            }
            articles[article].editors[presentEditorIndex] =
                currentLanguages + ':' + currentEditor;
          }
          if (articles[article].languages[language]) {
            articles[article].languages[language] += 1;
          } else {
            articles[article].languages[language] = 1;
          }
          // check the three breaking news conditions:
          //
          // (1) breaking news threshold
          var breakingNewsThresholdReached =
              articles[article].occurrences >= BREAKING_NEWS_THRESHOLD;
          // (2) check interval distances between edits
          // if something is suspected to be breaking news, all interval
          // distances must be below a certain threshold
          var intervals = articles[article].intervals;
          var allEditsInShortDistances = false;
          var index = 0;
          var intervalsLength = intervals.length;
          if (intervalsLength > BREAKING_NEWS_THRESHOLD - 1) {
            index = intervalsLength - BREAKING_NEWS_THRESHOLD + 1;
          }
          for (var i = index; i < intervalsLength; i++) {
            if (intervals[i] <= SECONDS_BETWEEN_EDITS * 1000) {
              allEditsInShortDistances = true;
            } else {
              allEditsInShortDistances = false;
              break;
            }
          }
          // (3) number of concurrent editors
          var numberOfEditors = articles[article].editors.length;
          var numberOfEditorsReached =
              numberOfEditors >= NUMBER_OF_CONCURRENT_EDITORS;

          // search for all article titles in social networks
          var searchTerms = {};
          searchTerms[article.split(':')[1].replace(/_/g, ' ')] = true;
          for (var key in articles[article].versions) {
            var articleTitle = key.split(':')[1].replace(/_/g, ' ');
            if (!searchTerms[articleTitle]) {
              searchTerms[articleTitle] = true;
            }
          }
          socialNetworkSearch(searchTerms, function(socialNetworksResults) {
            io.sockets.emit('nTimesSeen', {
              article: article,
              occurrences: articles[article].occurrences,
              timestamp: new Date(articles[article].timestamp),
              editIntervals: articles[article].intervals,
              editors: articles[article].editors,
              languages: articles[article].languages,
              versions: articles[article].versions,
              changes: articles[article].changes,
              conditions: {
                breakingNewsThreshold: breakingNewsThresholdReached,
                secondsBetweenEdits: allEditsInShortDistances,
                numberOfConcurrentEditors: numberOfEditorsReached
              },
              socialNetworksResults: socialNetworksResults
            });
            if (VERBOUS) {
              console.log('[ ! ] ' + articles[article].occurrences + ' ' +
                  'times seen: "' + article + '". ' +
                  'Timestamp: ' + new Date(articles[article].timestamp) +
                  '. Edit intervals: ' + articles[article].intervals.toString()
                  .replace(/(\d+),?/g, '$1ms ').trim() + '. ' +
                  'Parallel editors: ' + articles[article].editors.length +
                  '. Editors: ' + articles[article].editors + '. ' +
                  'Languages: ' + JSON.stringify(articles[article].languages));
            }
            // check if all three breaking news conditions are fulfilled at once
            if ((breakingNewsThresholdReached) &&
                (allEditsInShortDistances) &&
                (numberOfEditorsReached)) {
              io.sockets.emit('breakingNewsCandidate', {
                article: article,
                occurrences: articles[article].occurrences,
                timestamp: new Date(articles[article].timestamp),
                editIntervals: articles[article].intervals,
                editors: articles[article].editors,
                languages: articles[article].languages,
                versions: articles[article].versions,
                changes: articles[article].changes,
                conditions: {
                  breakingNewsThreshold: breakingNewsThresholdReached,
                  secondsBetweenEdits: allEditsInShortDistances,
                  numberOfConcurrentEditors: numberOfEditorsReached
                },
                socialNetworksResults: socialNetworksResults
              });
              if (TWEET_BREAKING_NEWS_CANDIDATES) {
                tweet(
                    article,
                    articles[article].occurrences,
                    articles[article].editors.length,
                    Object.keys(articles[article].languages).length,
                    socialNetworksResults);
              }
              if (VERBOUS) {
                console.log('[ ★ ] Breaking news candidate: "' +
                    article + '". ' +
                    articles[article].occurrences + ' ' +
                    'times seen. ' +
                    'Timestamp: ' + new Date(articles[article].timestamp) +
                    '. Edit intervals: ' +
                    articles[article].intervals.toString()
                    .replace(/(\d+),?/g, '$1ms ').trim() + '. ' +
                    'Number of editors: ' +
                    articles[article].editors.length + '. ' +
                    'Editors: ' + articles[article].editors + '. ' +
                    'Languages: ' +
                    JSON.stringify(articles[article].languages));
              }
            }
          });
        }
      }
    }
  });
}

// callback function for getting language references from the Wikipedia API
// for an article
function getLanguageReferences(error, response, body, article) {
  if (!error && response.statusCode == 200) {
    var json;
    try {
      json = JSON.parse(body);
    } catch(e) {
      json = false;
    }
    if (json && json.query && json.query.pages) {
      var pages = json.query.pages;
      for (id in pages) {
        var page = pages[id];
        if (!articleClusters[article]) {
          articleClusters[article] = {};
        }
        if (page.langlinks) {
          page.langlinks.forEach(function(langLink) {
            var lang = langLink.lang;
            if ((millionPlusLanguages[lang]) ||
                ((MONITOR_LONG_TAIL_WIKIPEDIAS) &&
                    (oneHundredThousandPlusLanguages[lang]))) {
              var title = langLink['*'].replace(/\s/g, '_');
              var articleVersion = lang + ':' + title;
              articleClusters[article][articleVersion] = true;
              articleVersionsMap[articleVersion] = article;
            }
          });
        }
      }
    }
  } else {
    var red = '\u001b[31m';
    var reset = '\u001b[0m';
    console.log(red + new Date() + ' ERROR (Wikipedia API)' + reset +
        (response? ' Status Code: ' + response.statusCode : '') + '.');
  }
}

// start static serving
// and set default route to index.html
app.use(express.static(__dirname + '/static'));
app.get('/', function(req, res) {
  res.sendfile(__dirname + '/index.html');
});

// setting up the Web Socket-based communication with the front-end
io.set('log level', 1);
io.sockets.on('connection', function(socket) {
  // send the default settings
  socket.emit('defaultSettings', {
    secondsSinceLastEdit: SECONDS_SINCE_LAST_EDIT,
    secondsBetweenEdits: SECONDS_BETWEEN_EDITS,
    breakingNewsThreshold: BREAKING_NEWS_THRESHOLD,
    numberOfConcurrentEditors: NUMBER_OF_CONCURRENT_EDITORS
  });

  // react on settings changes
  socket.on('secondsSinceLastEdit', function(data) {
    SECONDS_SINCE_LAST_EDIT = data.value;
    console.log('Setting SECONDS_SINCE_LAST_EDIT to: ' +
        SECONDS_SINCE_LAST_EDIT);
  });
  socket.on('secondsBetweenEdits', function(data) {
    SECONDS_BETWEEN_EDITS = data.value;
    console.log('Setting SECONDS_BETWEEN_EDITS to: ' + SECONDS_BETWEEN_EDITS);
  });
  socket.on('breakingNewsThreshold', function(data) {
    BREAKING_NEWS_THRESHOLD = data.value;
    console.log('Setting BREAKING_NEWS_THRESHOLD to: ' +
        BREAKING_NEWS_THRESHOLD);
  });
  socket.on('numberOfConcurrentEditors', function(data) {
    NUMBER_OF_CONCURRENT_EDITORS = data.value;
    console.log('Setting NUMBER_OF_CONCURRENT_EDITORS to: ' +
        NUMBER_OF_CONCURRENT_EDITORS);
  });

});

// clean-up function, called regularly like a garbage collector
function cleanUpMonitoringLoop() {
  for (var key in articles) {
    var now = Date.now();
    if (now - articles[key].timestamp > SECONDS_SINCE_LAST_EDIT * 1000) {
      delete articles[key];
      for (version in articleClusters[key]) {
        delete articleVersionsMap[version];
      }
      delete articleClusters[key];
      delete articleVersionsMap[key];
      if (VERBOUS && REALLY_VERBOUS) {
        console.log('[ † ] No more mentions: "' + key + '". ' +
            'Article clusters left: ' +
                Object.keys(articleClusters).length + '. ' +
            'Mappings left: ' + Object.keys(articleVersionsMap).length);
      }
    }
  }
  io.sockets.emit('stats', {
    clustersLeft: Object.keys(articleClusters).length
  });
}

function tweet(article, occurrences, editors, languages, microposts) {
  var components = article.split(':');
  var wikipediaUrl = 'http://' + components[0] +
      '.wikipedia.org/wiki/' + encodeURIComponent(components[1]);
  // if we have already tweeted the current URL, don't tweet it again
  if (recentTweetsBuffer.indexOf(wikipediaUrl) !== -1) {
    console.log('Already tweeted about ' + wikipediaUrl);
    return;
  }
  // keep the recent tweets buffer at most 10 elements long
  recentTweetsBuffer.push(wikipediaUrl);
  if (recentTweetsBuffer.length > 10) {
    recentTweetsBuffer.shift();
  }
  console.log('Recent tweets buffer length: ' + recentTweetsBuffer.length);

  var socialUpdates = [];
  var now = Date.now();
  for (var term in microposts) {
    var posts = microposts[term];
    for (var network in posts) {
      var results = posts[network];
      if (Array.isArray(results)) {
        for (var i = 0, len = results.length; i < len; i++) {
          // not older than 1h: 1 * 60 * 60 * 1000 = 3,600,000
          if (now - results[i].timestamp < 3600000) {
            socialUpdates.push(results[i].deepLink);
          }
        }
      }
    }
  }
  var shuffle = function(o) {
    for(var j, x, i = o.length; i; j = parseInt(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
  };
  socialUpdates = shuffle(socialUpdates);
  var text = 'Breaking News Candidate: ' + wikipediaUrl +
      ' [Edits: ' + occurrences +
      ', Editors: ' + editors +
      ', Langs: ' + languages +
      ', Stories: ';
  if (socialUpdates.length) {
    var urlRegEx = /\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/ig;
    var pseudoShortLink = 'http://t.co/' +
        new Array(TWITTER_SHORT_URL_LENGTH - 11).join('x');
    var previewTweet = text.replace(urlRegEx, pseudoShortLink);
    for (var i = previewTweet.length, j = 0, len = socialUpdates.length; i < 138 && j < len; i += TWITTER_SHORT_URL_LENGTH + 2, j++) {
      previewTweet += (j > 0 ? ', ' + socialUpdates[j].replace(urlRegEx, pseudoShortLink) : socialUpdates[j].replace(urlRegEx, pseudoShortLink));
      text += (j > 0 ? ', ' + socialUpdates[j] : socialUpdates[j]);
    }
    text += ']';
  } else {
    text += 'N/A]';
  }
  console.log('Tweeting: ' + text);
  twit.updateStatus(text, function (err, data) {
    if (err) {
      console.log('Tweet error: ' + err);
    }
  });
}

// start garbage collector
setInterval(function() {
  cleanUpMonitoringLoop();
}, 10 * 1000);

// start the monitoring process upon a connection
monitorWikipedia();

// start the server
var port = process.env.PORT || 8080;
console.log('Wikipedia Live Monitor running on port ' + port);
server.listen(port);