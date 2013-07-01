var irc = require('irc');
var request = require('request');
var express = require('express');
var http = require('http');
var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);
var $ = require('cheerio');
var twitter = require('ntwitter');
var nodemailer = require("nodemailer");
var socialNetworkSearch = require('./social-network-search.js');
var wiki2html = require('./wiki2html.js');
var wikipedias = require('./wikipedias.js');

// verbous debug mode
var VERBOUS = false;
// really very verbous debug mode
var REALLY_VERBOUS = false;
// use WebSocket reporting
var USE_WEBSOCKETS = true;

// whether to monitor the 1,000,000+ articles Wikipedias
var MONITOR_SHORT_TAIL_WIKIPEDIAS = true;

// whether to monitor the 100,000+ articles Wikipedias
var MONITOR_LONG_TAIL_WIKIPEDIAS = true;

// whether to also monitor the << 100,000+ articles Wikipedias
var MONITOR_REALLY_LONG_TAIL_WIKIPEDIAS = true;

// whether to monitor the knowledge base Wikidata
var MONITOR_WIKIDATA = true;

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
var IRC_REAL_NAME_AND_CONTACT = 'Thomas Steiner (tomac@google.com)';

// the maximum length of http://t.co links
var TWITTER_SHORT_URL_LENGTH = 23;

// if enabled, breaking news candidates will be tweeted
var TWEET_BREAKING_NEWS_CANDIDATES = false;

// if enabled, breaking news candidates will be emailed
var EMAIL_BREAKING_NEWS_CANDIDATES = false;

if (EMAIL_BREAKING_NEWS_CANDIDATES) {
  // create reusable transport method (opens pool of SMTP connections)
  var smtpTransport = nodemailer.createTransport('SMTP', {
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_ADDRESS,
        pass: process.env.EMAIL_PASSWORD
    }
  });

  var recentEmailsBuffer = [];
}

if (TWEET_BREAKING_NEWS_CANDIDATES) {
  var twit = new twitter({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
  });

  twit.verifyCredentials(function(err, data) {
    if (err) {
      console.warn('Twitter authentication error: ' + err);
    }
  });

  var recentTweetsBuffer = [];
}

var IRC_CHANNELS = [];
var PROJECT = '.wikipedia';
if (MONITOR_SHORT_TAIL_WIKIPEDIAS) {
  Object.keys(wikipedias.millionPlusLanguages).forEach(function(language) {
    if (wikipedias.millionPlusLanguages[language]) {
      IRC_CHANNELS.push('#' + language + PROJECT);
    }
  });
}
if (MONITOR_LONG_TAIL_WIKIPEDIAS) {
  Object.keys(wikipedias.oneHundredThousandPlusLanguages).forEach(
      function(language) {
    if (wikipedias.oneHundredThousandPlusLanguages[language]) {
      IRC_CHANNELS.push('#' + language + PROJECT);
    }
  });
}
if (MONITOR_REALLY_LONG_TAIL_WIKIPEDIAS) {
  Object.keys(wikipedias.reallyLongTailWikipedias).forEach(function(language) {
    if (wikipedias.reallyLongTailWikipedias[language]) {
      IRC_CHANNELS.push('#' + language + PROJECT);
    }
  });
}
if (MONITOR_WIKIDATA) {
  Object.keys(wikipedias.wikidata).forEach(function(language) {
    if (wikipedias.wikidata[language]) {
      IRC_CHANNELS.push('#' + language + PROJECT);
    }
  });
}

var client = new irc.Client(
    IRC_SERVER,
    IRC_NICK,
    {
      userName: IRC_NICK,
      realName: IRC_REAL_NAME_AND_CONTACT,
      floodProtection: true,
      showErrors: true,
      stripColors: true
    });

client.addListener('registered', function(message) {
  console.log('Connected to IRC server ' + IRC_SERVER);
  // connect to IRC channels
  IRC_CHANNELS.forEach(function(channel) {
    console.log('Joining channel ' + channel);
    client.join(channel);
  });
});

// fired whenever the client connects to an IRC channel
client.addListener('join', function(channel, nick, message) {
  console.log(nick + ' joined channel ' + channel);
});
// fired whenever someone parts a channel
client.addListener('part', function(channel, nick, reason, message) {
  console.log('User ' + nick + ' has left ' + channel + ' (' + reason + ')');
});
// fired whenever someone quits the IRC server
client.addListener('quit', function(nick, reason, channels, message) {
  console.log('User ' + nick + ' has quit ' + channels + ' (' + reason + ')');
});
// fired whenever someone sends a notice
client.addListener('notice', function(nick, to, text, message) {
  console.log('Notice from ' + (nick === undefined? 'server' : nick) + ' to ' +
      to +  ': ' + text);
});
// fired whenever someone gets kicked from a channel
client.addListener('kick', function(channel, nick, by, reason, message) {
  console.warn('User ' + (by === undefined? 'server' : by) + ' has kicked ' +
      nick + ' from ' + channel +  ' (' + reason + ')');
});
// fired whenever someone is killed from the IRC server
client.addListener('kill', function(nick, reason, channels, message) {
  console.warn('User ' + nick + ' was killed from ' + channels +  ' (' +
      reason + ')');
});
// fired whenever the client encounters an error
client.addListener('error', function(message) {
  console.warn('IRC error: ' + message);
});

// global objects, required to keep track of the currently monitored articles
// and article clusters for the different language versions
var articles = {};
var articleClusters = {};
var articleVersionsMap = {};

function parseMessage(message, to) {
  // get the editor's username or IP address
  // the IRC log format is as follows (with color codes removed):
  // rc-pmtpa: [[Juniata River]] http://en.wikipedia.org/w/index.php?diff=516269072&oldid=514659029 * Johanna-Hypatia * (+67) Category:Place names of Native American origin in Pennsylvania
  var messageComponents = message.split(' * ');
  var articleRegExp = /\[\[(.+?)\]\].+?$/;
  var article = messageComponents[0].replace(articleRegExp, '$1');
  // discard non-article namespaces, as listed here:
  // http://www.mediawiki.org/wiki/Help:Namespaces
  // this means only listening to messages without a ':' essentially
  if (article.indexOf(':') !== -1) {
    return false;
  }
  var editor = messageComponents[1];
  // discard edits made by bots.
  // bots are identified by a B flag, as documented here
  // http://www.mediawiki.org/wiki/Help:Tracking_changes
  // (the 'b' is actually uppercase in IRC)
  //
  // bots must identify themselves by prefixing or suffixing their
  // username with "bot".
  // http://en.wikipedia.org/wiki/Wikipedia:Bot_policy#Bot_accounts
  var flagsAndDiffUrl =
      messageComponents[0].replace('[[' + article + ']] ', '').split(' ');
  var flags = flagsAndDiffUrl[0];
  if (DISCARD_WIKIPEDIA_BOTS) {
    if ((/B/.test(flags)) ||
        (/\bbot/i.test(editor)) ||
        (/bot\b/i.test(editor))) {
      return;
    }
  }
  // normalize article titles to follow the Wikipedia URLs
  article = article.replace(/\s/g, '_');
  // the language format follows the IRC room format: "#language.project"
  var language = to.substring(1, to.indexOf('.'));
  editor = language + ':' + editor;
  // diff URL
  var diffUrl = flagsAndDiffUrl[1];
  if ((diffUrl.indexOf('diff') !== -1) &&
      (diffUrl.indexOf('oldid') !== -1)) {
    var toRev = diffUrl.replace(/.*\?diff=(\d+).*/, '$1');
    var fromRev = diffUrl.replace(/.*&oldid=(\d+).*/, '$1');
    if (language === 'wikidata') {
      diffUrl = 'http://wikidata.org/w/api.php?action=compare&torev=' +
          toRev + '&fromrev=' + fromRev + '&format=json';
    } else {
      diffUrl = 'http://' + language +
          '.wikipedia.org/w/api.php?action=compare&torev=' + toRev +
          '&fromrev=' + fromRev + '&format=json';
    }
  } else {
    diffUrl = '';
  }
  // delta
  deltaAndCommentRegExp = /\(([+-]\d+)\)\s(.*?)$/;
  var delta = messageComponents[2].replace(deltaAndCommentRegExp, '$1');
  // comment
  var comment = messageComponents[2].replace(deltaAndCommentRegExp, '$2');
  // language cluster URL
  var languageClusterUrl;
  if (language === 'wikidata') {
    languageClusterUrl = 'http://www.wikidata.org/w/api.php?' +
        'action=wbgetentities&props=sitelinks&format=json&ids=' + article;
  } else {
    languageClusterUrl = 'http://' + language +
        '.wikipedia.org/w/api.php?action=query&prop=langlinks' +
        '&format=json&lllimit=500&titles=' + article;
  }
  return {
    article: article,
    editor: editor,
    language: language,
    delta: delta,
    comment: comment,
    diffUrl: diffUrl,
    languageClusterUrl: languageClusterUrl
  };
}

function checkBreakingNewsConditions(article) {
  // (1) breaking news threshold
  var breakingNewsThresholdReached =
      article.occurrences >= BREAKING_NEWS_THRESHOLD;
  // (2) check interval distances between edits
  // if something is suspected to be breaking news, all interval
  // distances must be below a certain threshold
  var intervals = article.intervals;
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
  var numberOfEditors = article.editors.length;
  var numberOfEditorsReached =
      numberOfEditors >= NUMBER_OF_CONCURRENT_EDITORS;
  // if we have an article in more than one languge, check for the
  // normal NUMBER_OF_CONCURRENT_EDITORS
  if (Object.keys(article.languages).length > 1) {
    numberOfEditorsReached =
        numberOfEditors >= NUMBER_OF_CONCURRENT_EDITORS;
  // else if we have an article in just one languge, require the
  // triple NUMBER_OF_CONCURRENT_EDITORS
  } else {
    numberOfEditorsReached =
        numberOfEditors >= 3 * NUMBER_OF_CONCURRENT_EDITORS;
  }
  return {
    breakingNewsThresholdReached: breakingNewsThresholdReached,
    allEditsInShortDistances: allEditsInShortDistances,
    numberOfEditorsReached: numberOfEditorsReached
  };
}

function monitorWikipedia() {
  // fires whenever a new IRC message arrives on any of the IRC rooms
  client.addListener('message', function(from, to, message) {
    // this is the Wikipedia IRC bot that announces live changes
    if (from !== 'rc-pmtpa') {
      return;
    }
    var components = parseMessage(message, to);
    if (!components) {
      return;
    }
    var article = components.article;
    var editor = components.editor;
    var delta = components.delta;
    var comment = components.comment;
    var language = components.language;
    var languageClusterUrl = components.languageClusterUrl;
    var diffUrl = components.diffUrl;
    var now = Date.now();

    // get language references via the Wikipedia API
    article = language + ':' + article;
    request.get({
          uri: languageClusterUrl,
          headers: {'User-Agent': USER_AGENT}
        },
        function(error, response, body) {
          getLanguageReferences(error, response, body, article);
        });

    // TODO
    // get out-links to other articles mentioned in the current article
    // http://en.wikipedia.org/w/api.php?action=query&prop=links&pllimit=500&format=json&titles=

    // TODO
    // get in-links to the current article
    // http://en.wikipedia.org/w/api.php?action=query&list=backlinks&bllimit=500&format=json&bltitle=

    // get the diff URL and check if we have notable or trivial changes
    if (diffUrl) {
      request.get({
            uri: diffUrl,
            headers: {'User-Agent': USER_AGENT}
          },
          function(error, response, body) {
            getDiffUrl(error, response, body, article, now);
          });
    }

    // new article
    if (!articleVersionsMap[article]) {
      // self-reference to detect repeatedly edited single-language version
      // articles that do not have other language versions
      articleVersionsMap[article] = article;
      // store the first occurrence of the new article
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
        editor: editor,
        comment: comment ? comment : ''
      };
      // reporting WebSockets
      if (USE_WEBSOCKETS) {
        io.sockets.emit('firstTimeSeen', {
          article: article,
          timestamp: new Date(articles[article].timestamp).toString(),
          editors: [editor],
          languages: articles[article].languages,
          versions: articles[article].versions
        });
      }
      // reporting console
      if (VERBOUS && REALLY_VERBOUS) {
        console.log('[ * ] First time seen: "' + article + '". ' +
            'Timestamp: ' + new Date(articles[article].timestamp) + '. ' +
            'Editors: ' + editor + '. ' +
            'Languages: ' + JSON.stringify(articles[article].languages));
      }
    // existing article
    } else {
      var currentArticle = article;
      if (article !== articleVersionsMap[article]) {
        // reporting WebSockets
        if (USE_WEBSOCKETS) {
          io.sockets.emit('merging', {
            current: article,
            existing: articleVersionsMap[article],
            timestamp: new Date(now).toString()
          });
        }
        // reporting console
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
        editor: editor,
        comment: comment ? comment : ''
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
      var breakingNewsConditions =
          checkBreakingNewsConditions(articles[article]);
      // reporting WebSockets
      if (USE_WEBSOCKETS) {
        io.sockets.emit('nTimesSeen', {
          article: article,
          occurrences: articles[article].occurrences,
          timestamp: new Date(articles[article].timestamp).toString(),
          editIntervals: articles[article].intervals,
          editors: articles[article].editors,
          languages: articles[article].languages,
          versions: articles[article].versions,
          changes: articles[article].changes,
          conditions: {
            breakingNewsThreshold:
                breakingNewsConditions.breakingNewsThresholdReached,
            secondsBetweenEdits:
                breakingNewsConditions.allEditsInShortDistances,
            numberOfConcurrentEditors:
                breakingNewsConditions.numberOfEditorsReached
          }
        });
      }
      // reporting console
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
      if ((breakingNewsConditions.breakingNewsThresholdReached) &&
          (breakingNewsConditions.allEditsInShortDistances) &&
          (breakingNewsConditions.numberOfEditorsReached)) {
        // search for all article titles in social networks
        var searchTerms = {};
        // use the article title as search term
        searchTerms[article.split(':')[1].replace(/_/g, ' ')] = true;
        // use the article URL as search term
        searchTerms[createWikipediaUrl(article)] = true;
        for (var key in articles[article].versions) {
          // use the article URL as search term
          var wikipediaUrl = createWikipediaUrl(key);
          searchTerms[wikipediaUrl] = true;
          // use the article title as search term
          var articleTitle = key.split(':')[1].replace(/_/g, ' ');
          if (!searchTerms[articleTitle]) {
            searchTerms[articleTitle] = true;
          }
        }
        socialNetworkSearch(searchTerms, function(socialNetworksResults) {
          // reporting WebSockets
          if (USE_WEBSOCKETS) {
            io.sockets.emit('breakingNewsCandidate', {
              article: article,
              occurrences: articles[article].occurrences,
              timestamp: new Date(articles[article].timestamp) + '',
              editIntervals: articles[article].intervals,
              editors: articles[article].editors,
              languages: articles[article].languages,
              versions: articles[article].versions,
              changes: articles[article].changes,
              conditions: {
                breakingNewsThreshold:
                    breakingNewsConditions.breakingNewsThresholdReached,
                secondsBetweenEdits:
                    breakingNewsConditions.allEditsInShortDistances,
                numberOfConcurrentEditors:
                    breakingNewsConditions.numberOfEditorsReached
              },
              socialNetworksResults: socialNetworksResults
            });
          }
          if (TWEET_BREAKING_NEWS_CANDIDATES) {
            // the actual breaking news article language version may
            // vary, however, to avoid over-tweeting, tweet only
            // once, i.e., look up the main article in the
            // articleVersionsMap
            tweet(
                articleVersionsMap[article],
                articles[article].occurrences,
                articles[article].editors.length,
                Object.keys(articles[article].languages).length,
                socialNetworksResults);
          }
          if (EMAIL_BREAKING_NEWS_CANDIDATES) {
            email(articleVersionsMap[article], socialNetworksResults);
          }
          // reporting console
          if (VERBOUS) {
            console.log('[ ★ ] Breaking news candidate: "' +
                article + '". ' +
                articles[article].occurrences + ' ' +
                'times seen. ' +
                'Timestamp: ' +
                new Date(articles[article].timestamp) +
                '. Edit intervals: ' +
                articles[article].intervals.toString()
                .replace(/(\d+),?/g, '$1ms ').trim() + '. ' +
                'Number of editors: ' +
                articles[article].editors.length + '. ' +
                'Editors: ' + articles[article].editors + '. ' +
                'Languages: ' +
                JSON.stringify(articles[article].languages));
          }
        });
      }
    }
  });
}

// retrieves the diff URL of an article and stores the cleaned diff text
function getDiffUrl(error, response, body, article, now) {
  if (!error) {
    var json;
    try {
      json = JSON.parse(body);
    } catch(e) {
      json = false;
    }
    if (json && json.compare && json.compare['*'] && articles[article]) {
      var parsedHtml = $.load(json.compare['*']);
      var addedLines = parsedHtml('.diff-addedline');
      var diffTexts = [];
      var diffConcepts = [];
      addedLines.each(function(i, elem) {
        var text = $(this).text().trim();
        var concepts = extractWikiConcepts(text,
            articles[article].changes[now].language);
        if (concepts) {
          diffConcepts.concat(concepts);
        }
        text = removeWikiNoise(text);
        text = removeWikiMarkup(text);
        if (text) {
          diffTexts.push(text);
        }
      });
      articles[article].changes[now].diffTexts = diffTexts;
      articles[article].changes[now].namedEntities = diffConcepts;
    }
  } else {
    console.warn('Wikipedia API error while getting diff text.' +
        (response? ' Status Code: ' + response.statusCode : ''));
  }
}

// removes HTML tags from text (like the PHP function with the same name)
function strip_tags (input, allowed) {
  // http://kevin.vanzonneveld.net
  // +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // +   improved by: Luke Godfrey
  // +      input by: Pul
  // +   bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // +   bugfixed by: Onno Marsman
  // +      input by: Alex
  // +   bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // +      input by: Marc Palau
  // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // +      input by: Brett Zamir (http://brett-zamir.me)
  // +   bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // +   bugfixed by: Eric Nagel
  // +      input by: Bobby Drake
  // +   bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // +   bugfixed by: Tomasz Wesolowski
  // +      input by: Evertjan Garretsen
  // +    revised by: Rafał Kukawski (http://blog.kukawski.pl/)
  // *     example 1: strip_tags('<p>Kevin</p> <br /><b>van</b> <i>Zonneveld</i>', '<i><b>');
  // *     returns 1: 'Kevin <b>van</b> <i>Zonneveld</i>'
  // *     example 2: strip_tags('<p>Kevin <img src="someimage.png" onmouseover="someFunction()">van <i>Zonneveld</i></p>', '<p>');
  // *     returns 2: '<p>Kevin van Zonneveld</p>'
  // *     example 3: strip_tags("<a href='http://kevin.vanzonneveld.net'>Kevin van Zonneveld</a>", "<a>");
  // *     returns 3: '<a href='http://kevin.vanzonneveld.net'>Kevin van Zonneveld</a>'
  // *     example 4: strip_tags('1 < 5 5 > 1');
  // *     returns 4: '1 < 5 5 > 1'
  // *     example 5: strip_tags('1 <br/> 1');
  // *     returns 5: '1  1'
  // *     example 6: strip_tags('1 <br/> 1', '<br>');
  // *     returns 6: '1  1'
  // *     example 7: strip_tags('1 <br/> 1', '<br><br/>');
  // *     returns 7: '1 <br/> 1'
  allowed = (((allowed || "") + "").toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []).join(''); // making sure the allowed arg is a string containing only tags in lowercase (<a><b><c>)
  var tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi,
    commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi;
  return input.replace(commentsAndPhpTags, '').replace(tags, function ($0, $1) {
    return allowed.indexOf('<' + $1.toLowerCase() + '>') > -1 ? $0 : '';
  });
}

// extracts Wikipedia concepts (i.e., links to other articles)
function extractWikiConcepts(text, language) {
  var concepts = [];
  text = text.replace(/\[\[(.*?)\]\]/g, function(m, l) {
    var p = l.split(/\|/);
    var link = p.shift();

    if (link.match(/^Image:(.*)/)) {
      return false;
    }
    if (link.indexOf(':') === -1) {
      concepts.push(language + ':' + link.replace(/\s/g, '_'));
    } else {
      concepts.push(link.replace(/\s/g, '_'));
    }
  });
  return concepts;
}

// removes noise from the diff text of article edits
function removeWikiNoise(text) {
  // remove things like [[Kategorie:Moravske Toplice| Moravske Toplice]]
  var namespaceNoiseRegEx = /\[\[.*?\:.*?\]\]/g;
  // remove things like {{NewZealand-writer-stub}}
  var commentNoiseRegEx = /\{\{.*?\}\}/g;
  // remove things like align="center"
  var htmlAttributeRegEx = /\w+\s*\=\s*\"\w+\"/g;
  // remove things like {{
  var openingCommentParenthesisRegEx = /\{\{/g;
  // remove things like }}
  var closingCommentParenthesisRegEx = /\}\}/g;
  text = text.replace(namespaceNoiseRegEx, '')
      .replace(commentNoiseRegEx, ' ')
      .replace(htmlAttributeRegEx, ' ')
      .replace(openingCommentParenthesisRegEx, ' ')
      .replace(closingCommentParenthesisRegEx, ' ')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  text = strip_tags(text);
  return text;
}

// removes wiki markup from the diff text of article edits
function removeWikiMarkup(text) {
  var tableMarkupRegEx = /\|/g;
  text = strip_tags(wiki2html(text));
  text = text.replace(tableMarkupRegEx, ' ')
      .replace(/\[\[/g, ' ')
      .replace(/\]\]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\s?=\s?/g, ' = ')
      .trim();
  return text;
}

// callback function for getting language references from the Wikipedia API
// for an article
function getLanguageReferences(error, response, body, article) {

  // helper function to insert language versions
  var insertArticle = function(language, title) {
    if (((MONITOR_SHORT_TAIL_WIKIPEDIAS) &&
            (wikipedias.millionPlusLanguages[language])) ||
        ((MONITOR_LONG_TAIL_WIKIPEDIAS) &&
            (wikipedias.oneHundredThousandPlusLanguages[language])) ||
        ((MONITOR_REALLY_LONG_TAIL_WIKIPEDIAS) &&
            (wikipedias.reallyLongTailWikipedias[language]))) {
      var articleVersion = language + ':' + title;
      articleClusters[article][articleVersion] = true;
      articleVersionsMap[articleVersion] = article;
    }
  };

  if (!error && response.statusCode == 200) {
    var json;
    try {
      json = JSON.parse(body);
    } catch(e) {
      json = false;
    }
    if (json) {
      var language = article.split(':')[0];
      if (!articleClusters[article]) {
        articleClusters[article] = {};
      }
      if (language === 'wikidata') {
        var wikidataId = article.split(':')[1].toLowerCase();
        if ((json.entities) &&
            (json.entities[wikidataId]) &&
            (json.entities[wikidataId].sitelinks)) {
          var sitelinks = json.entities[wikidataId].sitelinks;
          for (var languageWiki in sitelinks) {
            var language = languageWiki.replace(/wiki$/, '');
            var title = sitelinks[languageWiki].title.replace(/\s/g, '_');
            insertArticle(language, title);
          }
        }
      } else {
        if (json.query && json.query.pages) {
          var pages = json.query.pages;
          for (id in pages) {
            var page = pages[id];
            if (page.langlinks) {
              page.langlinks.forEach(function(langLink) {
                var language = langLink.lang;
                var title = langLink['*'].replace(/\s/g, '_');
                insertArticle(language, title);
              });
            }
          }
        }
      }
    }
  } else {
    console.warn('Wikipedia API error while getting language references.' +
        (response? ' Status Code: ' + response.statusCode : ''));
  }
}

// setting up the Web Socket-based communication with the front-end
if (USE_WEBSOCKETS) {
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
}

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
  if (USE_WEBSOCKETS) {
    io.sockets.emit('stats', {
      clustersLeft: Object.keys(articleClusters).length
    });
  }
}

function createWikipediaUrl(article) {
  var components = article.split(':');
  if (components[0] === 'wikidata') {
    return 'http://' + components[0] + '.org/wiki/' +
        encodeURIComponent(components[1]);
  } else {
    return 'http://' + components[0] + '.wikipedia.org/wiki/' +
        encodeURIComponent(components[1]);
  }
}

function email(article, microposts) {
  var wikipediaUrl = createWikipediaUrl(article);
  // if we have already emailed the current URL, don't email it again
  if (recentEmailsBuffer.indexOf(wikipediaUrl) !== -1) {
    console.log('Already emailed about ' + wikipediaUrl);
    return;
  }
  // keep the recent emails buffer at most 10 elements long
  recentEmailsBuffer.push(wikipediaUrl);
  if (recentEmailsBuffer.length > 10) {
    recentEmailsBuffer.shift();
  }

  var generateHtmlMail = function() {
    var preg_quote = function(str, delimiter) {
      // http://kevin.vanzonneveld.net
      // +   original by: booeyOH
      // +   improved by: Ates Goral (http://magnetiq.com)
      // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
      // +   bugfixed by: Onno Marsman
      // +   improved by: Brett Zamir (http://brett-zamir.me)
      // *     example 1: preg_quote("$40");
      // *     returns 1: '\$40'
      // *     example 2: preg_quote("*RRRING* Hello?");
      // *     returns 2: '\*RRRING\* Hello\?'
      // *     example 3: preg_quote("\\.+*?[^]$(){}=!<>|:");
      // *     returns 3: '\\\.\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:'
      return (str + '').replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\' +
          (delimiter || '') + '-]', 'g'), '\\$&');
    };

    // converts a user name like en:Jon_Doe to a valid Wikipedia user profile
    // link like so: http://en.wikipedia.org/wiki/User:Jon_Doe. Ignore
    // anonymous users
    var linkifyEditor = function(user) {
      var components = user.split(':');
      if (/\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(user)) {
        return '<a class="user">' + components[1] + '</a>';
      }
      return '<a class="user" href="http://' +
          components[0].replace(/(\w+),.*/, '$1') +
          '.wikipedia.org/wiki/User:' + components[1] + '">' + components[1] +
          '</a>';
    };

    var imgUrl = 'https://raw.github.com/tomayac/wikipedia-irc/master/static/';
    var html = '';
    var image =
        '<img src="' + imgUrl +
        article.split(':')[0] + '.png">';
    html += '<h1 style="font-size: 1.2em;">Breaking News Candidate<br><nobr>' +
        image + ' <a href="' + wikipediaUrl + '">' +
        decodeURIComponent(wikipediaUrl) + '</a></nobr></h1>';
    html += '<h2 style="font-size: 1.0em;">All Language Versions</h2>';
    if (Object.keys(articles[article].versions).length) {
      html += '<ul>';
      for (var version in articles[article].versions) {
        var url = createWikipediaUrl(version);
        html += '<li>' + '<nobr><img src="' + imgUrl + version.split(':')[0] +
            '.png"> <a href="' + url + '">' + decodeURIComponent(url) + '</a>' +
            '</nobr></li>';
      }
      html += '</ul>';
    }
    html += '<h2 style="font-size: 1.0em;">Last Edits</h2><ul>';
    for (var timestamp in articles[article].changes) {
      var change = articles[article].changes[timestamp];
      html += '<li><nobr><img src="' + imgUrl + change.language + '.png"> ' +
          linkifyEditor(change.editor) + ': ' +
          '</nobr><span style="font-style: italic; font-size: 0.8em;">' +
          (change.comment ? change.comment : 'N/A') + '</span> ' +
          '(<a href="' + change.diffUrl + '"><span style="' +
          (change.delta.indexOf('+') === -1 ? 'color:red;' : 'color:green;') +
          '">' + change.delta + '</span></a>) ';
      if (change.diffTexts) {
        html += '<ul>';
        change.diffTexts.forEach(function(diffText) {
          html += '<li><span style="font-style: italic; font-size: 0.8em; ' +
              'color: gray;">' + diffText + '</span>';
        });
        html += '</ul>';
      }
    }
    html += '</ul>';
    if (microposts) {
      var socialHtml = '';
      var now = Date.now();
      for (var term in microposts) {
        // only append the term if microposts exist. need to iterate over all
        // networks and check the freshness. ugly, but works.
        var resultsExistForTerm = false;
        for (var network in microposts[term]) {
          if (Array.isArray(microposts[term][network])) {
            microposts[term][network].forEach(function(item) {
              // not older than 1h: 1 * 60 * 60 * 1000 = 3600000
              if (now - item.timestamp < 3600000) {
                resultsExistForTerm = true;
              }
            });
          }
        }
        if (resultsExistForTerm) {
          socialHtml += '<li><b>' + term + '</b>';
        }
        for (var network in microposts[term]) {
          if (Array.isArray(microposts[term][network])) {
            microposts[term][network].forEach(function(item) {
              // not older than 1h: 1 * 60 * 60 * 1000 = 3600000
              if (now - item.timestamp < 3600000) {
                var micropost = item.micropost;
                if (micropost.length > 140) {
                  micropost = micropost.substring(0, 140) + ' […]';
                }
                socialHtml += '<br/><img style="width: 16px; height: 16px; ' +
                    'border-radius: 5px; vertical-align: middle;" src="' +
                    item.avatar + '"/> ' +
                    '<img style="width: 16px; height: 16px; ' +
                    'border-radius: 5px; vertical-align: middle;" src="' +
                    imgUrl + network.toLowerCase() + '.png"/> <small> ' +
                    '<a href="' + item.profileLink + '">' +
                    item.user + '</a> (<a href="' + item.deepLink + '">' +
                    new Date(item.timestamp).toString().substring(0,24) +
                    '</span></a>): ' + micropost.replace(
                        new RegExp('(' + preg_quote(term) + ')', 'gi'),
                        '<span style="background-color: yellow;">$1</span>') +
                    '</small>';
              }
            });
          }
        }
        if (resultsExistForTerm) {
          socialHtml += '</li>';
        }
      }
    }
    if (socialHtml) {
      html += '<h2 style="font-size: 1.0em;">Social Network Coverage</h2><ul>' +
          socialHtml + '</ul>';
    }
    return html;
  };

  // setup e-mail data with unicode symbols
  var mailOptions = {
      from: 'Wikipedia Live Monitor <' + process.env.EMAIL_ADDRESS + '>',
      to: process.env.EMAIL_RECEIVER,
      subject: 'Breaking News Candidate: ' + decodeURIComponent(wikipediaUrl),
      generateTextFromHTML: true,
      forceEmbeddedImages: true,
      html: generateHtmlMail()
  };
  // send mail with defined transport object
  smtpTransport.sendMail(mailOptions, function(error, response) {
    if (error) {
      console.warn(error);
    } else {
      console.log('Message sent: ' + response.message);
      // https://groups.google.com/forum/feed/wikipedialivemonitor/msgs/atom.xml?num=15
    }
  });
}

function tweet(article, occurrences, editors, languages, microposts) {
  var wikipediaUrl = createWikipediaUrl(article);
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
  var text = '#BreakingNews Candidate: ' + wikipediaUrl +
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
      previewTweet += (j > 0 ?
          ', ' + socialUpdates[j].replace(urlRegEx, pseudoShortLink) :
          socialUpdates[j].replace(urlRegEx, pseudoShortLink));
      text += (j > 0 ? ', ' + socialUpdates[j] : socialUpdates[j]);
    }
    text += ']';
  } else {
    text += 'N/A]';
  }
  console.log('Tweeting: ' + text);
  twit.updateStatus(text, function (err, data) {
    if (err) {
      console.warn('Tweet error: ' + err);
    }
  });
}

// start static serving
// and set default route to index.html
app.use(express.static(__dirname + '/static'));
app.get('/', function(req, res) {
  res.sendfile(__dirname + '/index.html');
});

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