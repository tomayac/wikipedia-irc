var irc = require('irc');
var request = require('request');
var express = require('express');
var http = require('http');
var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);

// verbous debug mode
var VERBOUS = false;
// really very verbous debug mode
var REALLY_VERBOUS = false;

// whether to only monitor the 1,000,000+ articles Wikipedias,
// or also the 100,000+ articles Wikipedias.
var MONITOR_LONG_TAIL_WIKIPEDIAS = true;

// required for Wikipedia API
var USER_AGENT = 'Wikipedia Live Monitor * IRC nick: wikipedia-live-monitor * Contact: tomac(a)google.com.';

// an article is thrown out of the monitoring loop if its last edit is longer
// ago than SECONDS_SINCE_LAST_EDIT seconds
var SECONDS_SINCE_LAST_EDIT = 240;

// an article must have at max SECONDS_BETWEEN_EDITS seconds in between edits
// in order to be regarded a breaking news candidate
var SECONDS_BETWEEN_EDITS = 60;

// an article must have at least BREAKING_NEWS_THRESHOLD edits before it is
// considered a breaking news candidate
var BREAKING_NEWS_THRESHOLD = 5;

// an article must be edited by at least NUMBER_OF_CONCURRENT_EDITORS concurrent
// editors before it is considered a breaking news candidate
var NUMBER_OF_CONCURRENT_EDITORS = 2; 

// Wikipedia edit bots can account for many false positives, so usually we want
// to discard them
var DISCARD_WIKIPEDIA_BOTS = true;

// IRC details for the recent changes live updates
var IRC_SERVER = 'irc.wikimedia.org';
var IRC_NICK = 'wikipedia-live-monitor';

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

function monitorWikipedia(socket) {
  // fires whenever a new IRC message arrives on any of the IRC rooms
  client.addListener('message', function(from, to, message) {
    // this is the Wikipedia IRC bot that announces live changes
    if (from === 'rc-pmtpa') {
      // remove color codes
      var regex = /\x0314\[\[\x0307(.+?)\x0314\]\]\x034.+?$/;
      var article = message.replace(regex, '$1');

      // get the editor's username or IP address
      // the IRC log format is as follows (with color codes removed):
      // rc-pmtpa: [[Juniata River]] http://en.wikipedia.org/w/index.php?diff=516269072&oldid=514659029 * Johanna-Hypatia * (+67) Category:Place names of Native American origin in Pennsylvania
      var editor = message.split('*')[1]
          .replace(/\x0303/g, '')
          .replace(/\x035/g, '')
          .replace(/\u0003/g, '')
          .replace(/^\s*/, '')
          .replace(/\s*$/, '');
      // discard edits made by bots.
      // bots must identify themselves by prefixing or suffixing their username
      // with "bot".
      // http://en.wikipedia.org/wiki/Wikipedia:Bot_policy#Bot_accounts
      if (DISCARD_WIKIPEDIA_BOTS) {
        if (/^bot/i.test(editor) || /bot$/i.test(editor)) {
          return;
        }
      }
      // discard non-article namespaces, as listed here:
      // http://www.mediawiki.org/wiki/Help:Namespaces
      // this means only listening to messages without a ':' essentially
      if (article.indexOf(':') === -1) {
        // normalize article titles to follow the Wikipedia URLs
        article = article.replace(/\s/g, '_');
        var now;
        // the language format follows the IRC room format: "#language.project"
        var language = to.substring(1, to.indexOf('.'));
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
        request.get(options, function(error, response, body) {
          getLanguageReferences(error, response, body, article);
        });
        article = language + ':' + article;
        // new article
        if (!articleVersionsMap[article]) {
          articles[article] = {
            timestamp: new Date().getTime(),
            occurrences: 1,
            intervals: [],
            editors: [editor],
            languages: {}
          };
          articles[article].languages[language] = 1;
          socket.emit('firstTimeSeen', {
            article: article,
            timestamp: new Date(articles[article].timestamp),
            editor: editor,
            languages: articles[article].languages
          });
          if (VERBOUS && REALLY_VERBOUS) {
            console.log('[ * ] First time seen: "' + article + '". ' +
                'Timestamp: ' + new Date(articles[article].timestamp) + '. ' +
                'Editor: ' + editor + '. ' +
                'Languages: ' + JSON.stringify(articles[article].languages));
          }
        // existing article
        } else {
          socket.emit('merging', {
            current: article,
            existing: articleVersionsMap[article]
          });
          if (VERBOUS) {
            console.log('[ ⚭ ] Merging ' + article + ' with ' +
                articleVersionsMap[article]);
          }
          article = articleVersionsMap[article];
          // update statistics of the article
          articles[article].occurrences += 1;
          now = new Date().getTime();
          articles[article].intervals.push(now - articles[article].timestamp);
          articles[article].timestamp = now;
          if (articles[article].editors.indexOf(editor) === -1) {
            articles[article].editors.push(editor);
          }
          if (articles[article].languages[language]) {
            articles[article].languages[language] += 1;
          } else {
            articles[article].languages[language] = 1;
          }
          socket.emit('nTimesSeen', {
            article: article,
            occurrences: articles[article].occurrences,
            timestamp: new Date(articles[article].timestamp),
            editIntervals: articles[article].intervals,
            editors: articles[article].editors,
            languages: articles[article].languages
          });
          if (VERBOUS) {
            console.log('[ ! ] ' + articles[article].occurrences + ' ' +
                'times seen: "' + article + '". ' +
                'Timestamp: ' + new Date(articles[article].timestamp) + '. ' +
                'Edit intervals: ' + articles[article].intervals.toString()
                .replace(/(\d+),?/g, '$1ms ').trim() + '. ' +
                'Parallel editors: ' + articles[article].editors.length + '. ' +
                'Editors: ' + articles[article].editors + '. ' +
                'Languages: ' + JSON.stringify(articles[article].languages));
          }
          if (articles[article].occurrences >= BREAKING_NEWS_THRESHOLD) {
            // check interval distances between edits
            // if something is suspected to be breaking news, all interval
            // distances must be below a certain threshold
            var intervals = articles[article].intervals;
            var allEditsInShortDistances = false;
            for (var i = 0, len = intervals.length; i < len; i++) {
              if (intervals[i] <= SECONDS_BETWEEN_EDITS * 1000) {
                allEditsInShortDistances = true;
              } else {
                break;
              }
            }
            // check if at least two editors made edits at roughly the same time
            var numberOfEditors = articles[article].editors.length;
            if ((allEditsInShortDistances) &&
                (numberOfEditors >= NUMBER_OF_CONCURRENT_EDITORS)) {
              var red = '\u001b[31m';
              var reset = '\u001b[0m';
              socket.emit('breakingNewsCandidate', {
                article: article,
                occurrences: articles[article].occurrences,
                timestamp: new Date(articles[article].timestamp),
                editIntervals: articles[article].intervals,
                editors: articles[article].editors,
                languages: articles[article].languages
              });

              console.log(red + '[ ★ ] Breaking news candidate: "' +
                  article + '". ' +
                  articles[article].occurrences + ' ' +
                  'times seen. ' +
                  'Timestamp: ' + new Date(articles[article].timestamp) + '. ' +
                  'Edit intervals: ' + articles[article].intervals.toString()
                  .replace(/(\d+),?/g, '$1ms ').trim() + '. ' +
                  'Number of editors: ' +
                  articles[article].editors.length + '. ' +
                  'Editors: ' + articles[article].editors + '. ' +
                  'Languages: ' + JSON.stringify(articles[article].languages) +
                  reset);
            }
          }
        }
        // clean-up
        for (var key in articles) {
          now = new Date().getTime();
          if (now - articles[key].timestamp > SECONDS_SINCE_LAST_EDIT * 1000) {
            delete articles[key];
            for (version in articleClusters[key]) {
              delete articleVersionsMap[version];
            }
            delete articleClusters[key];
            delete articleVersionsMap[key];
            socket.emit('stats', {
              clustersLeft: Object.keys(articleClusters).length,
              mappingsLeft: Object.keys(articleVersionsMap).length
            });
            if (VERBOUS && REALLY_VERBOUS) {
              console.log('[ † ] No more mentions: "' + key + '". ' +
                  'Article clusters left: ' +
                      Object.keys(articleClusters).length + '. ' +
                  'Mappings left: ' + Object.keys(articleVersionsMap).length);
            }
          }
        }
      }
    }
    /*
    console.log('#### Articles #####');
    console.log(articles);
    console.log('****** Clusters ******');
    console.log(articleClusters);
    console.log('%%%%%%% Versions %%%%%%%');
    console.log(articleVersionsMap);
    */
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
    console.log('ERROR (Wikipedia API): ' + response.statusCode + ': ' + body);
  }
}

app.get('/', function(req, res) {
  res.sendfile(__dirname + '/index.html');
});

io.set('log level', 1);
io.sockets.on('connection', function(socket) {
  socket.emit('defaultSettings', {
    secondsSinceLastEdit: SECONDS_SINCE_LAST_EDIT,
    secondsBetweenEdits: SECONDS_BETWEEN_EDITS,
    breakingNewsThreshold: BREAKING_NEWS_THRESHOLD,
    numberOfConcurrentEditors: NUMBER_OF_CONCURRENT_EDITORS
  });

  monitorWikipedia(socket);

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
server.listen(8080);