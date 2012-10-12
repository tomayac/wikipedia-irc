var irc = require('irc');
var request = require('request');
var express = require('express');

// very verbous debug mode
var VERBOUS = false;

// whether to only monitor the 1,000,000+ articles Wikipedias,
// or also the 100,000+ articles Wikipedias.
var MONITOR_LONG_TAIL_WIKIPEDIAS = false;

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
          '.wikipedia.org/w/api.php?action=query&prop=langlinks&format=json&' +
          'lllimit=500&titles=' + article;
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
      if (!articles[article]) {
        articles[article] = {
          timestamp: new Date().getTime(),
          occurrences: 1,
          intervals: [],
          editors: [editor],
          languages: {}
        };
        articles[article].languages[language] = 1;
        if (VERBOUS) {
          console.log('[ * ] First time seen: "' + article + '"');
        }
      // existing article  
      } else {
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
        if (VERBOUS) {
          console.log('[ ! ] ' + articles[article].occurrences +
              ' times seen: "' + article + '".' +
              ' Edit intervals: ' + articles[article].intervals.toString()
              .replace(/(\d+),?/g, '$1ms ').trim() + '.' +
              ' Number of editors: ' + articles[article].editors.length + '.');
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
              (numberOfEditors >= 2)) {
            console.log('[ ★ ] Breaking news candidate: "' + article + '". ' + 
                articles[article].occurrences +
                ' times seen.' +
                ' Edit intervals: ' + articles[article].intervals.toString()
                .replace(/(\d+),?/g, '$1ms ').trim() + '.' +
                ' Number of editors: ' +
                articles[article].editors.length + '.');
          }
        }
      }
      // clean-up
      for (var key in articles) {
        now = new Date().getTime();
        if (now - articles[key].timestamp > SECONDS_SINCE_LAST_EDIT * 1000) {
          delete articles[key];
          if (VERBOUS) {
            console.log('[ † ] no more mentions: "' + key + '".' +
                ' Articles left: ' + Object.keys(articles).length);
          }
        }
      }
    }
  }
});

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
      console.log('*** Clusters ***');
      console.log(articleClusters);
      console.log('### Articles ####');
      console.log(articles);
      console.log('%%% Mapping %%%%%%');
      console.log(articleVersionsMap);
    }
  }
}