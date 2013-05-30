var irc = require('irc');
var request = require('request');
var express = require('express');
var http = require('http');
var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);
var $ = require('cheerio');
var twitter = require('ntwitter');
var socialNetworkSearch = require('./social-network-search.js');
var wiki2html = require('./wiki2html.js');

// verbous debug mode
var VERBOUS = false;
// really very verbous debug mode
var REALLY_VERBOUS = false;

// whether to only monitor the 1,000,000+ articles Wikipedias,
// or also the 100,000+ articles Wikipedias.
var MONITOR_LONG_TAIL_WIKIPEDIAS = true;

// whether to also monitor the << 100,000+ articles Wikipedias
var MONITOR_REALLY_LONG_TAIL_WIKIPEDIAS = true;

// required for Wikipedia API
var USER_AGENT = 'Wikipedia Live Monitor * IRC nick: wikipedia-live-monitor * Contact: tomac(a)google.com.';

// an article cluster is thrown out of the monitoring loop if its last edit is
// longer ago than SECONDS_SINCE_LAST_EDIT seconds
var SECONDS_SINCE_LAST_EDIT = 300;

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

// IRC rooms are of the form #lang.wikipedia
// the list of languages is here:
// http://meta.wikimedia.org/wiki/List_of_Wikipedias#All_Wikipedias_ordered_by_number_of_articles
// http://meta.wikimedia.org/wiki/List_of_Wikipedias#1_000_000.2B_articles
var millionPlusLanguages = {
  en: true,
  de: true,
  nl: true,
  fr: true,
  it: true,
  es: true,
  ru: true
};

// http://meta.wikimedia.org/wiki/List_of_Wikipedias#100_000.2B_articles
var oneHundredThousandPlusLanguages = {
  sv: true,
  pl: true,
  ja: true,
  pt: true,
  zh: true,
  vi: true,
  uk: true,
  ca: true,
  no: true,
  war: true,
  ceb: true,
  fi: true,
  fa: true,
  cs: true,
  hu: true,
  ko: true,
  ar: true,
  ro: true,
  ms: true,
  tr: true,
  id: true,
  kk: true,
  sr: true,
  sk: true,
  eo: true,
  da: true,
  lt: true,
  eu: true,
  bg: true,
  he: true,
  hr: true,
  sl: true,
  uz: true,
  vo: true,
  et: true,
  hi: true,
  nn: true,
  gl: true
};

var tenThousandPlusLanguages = {
  simple: true,
  az: true,
  la: true,
  el: true,
  sh: true,
  th: true,
  ka: true,
  mk: true,
  oc: true,
  new: true,
  pms: true,
  tl: true,
  be: true,
  ta: true,
  ht: true,
  te: true,
  'be-x-old': true,
  cy: true,
  lv: true,
  bs: true,
  br: true,
  sq: true,
  hy: true,
  tt: true,
  jv: true,
  mg: true,
  mr: true,
  lb: true,
  is: true,
  my: true,
  ml: true,
  yo: true,
  ba: true,
  an: true,
  lmo: true,
  af: true,
  fy: true,
  pnb: true,
  bn: true,
  sw: true,
  bpy: true,
  io: true,
  ky: true,
  ur: true,
  ne: true,
  scn: true,
  'zh-yue': true,
  gu: true,
  nds: true,
  ga: true,
  ku: true,
  ast: true,
  qu: true,
  su: true,
  cv: true,
  sco: true,
  als: true,
  ia: true,
  nap: true,
  bug: true,
  'bat-smg': true,
  kn: true,
  'map-bms': true,
  wa: true,
  am: true,
  ckb: true,
  gd: true,
  hif: true,
  'zh-min-nan': true,
  tg: true,
  arz: true,
  mzn: true,
  yi: true,
  vec: true
};

var thousandPlusLanguages = {
  mn: true,
  nah: true,
  'roa-tara': true,
  sah: true,
  sa: true,
  os: true,
  pam: true,
  hsb: true,
  si: true,
  se: true,
  bar: true,
  li: true,
  mi: true,
  co: true,
  gan: true,
  fo: true,
  ilo: true,
  pa: true,
  bo: true,
  glk: true,
  rue: true,
  bcl: true,
  'fiu-vro': true,
  mrj: true,
  'nds-nl': true,
  tk: true,
  ps: true,
  vls: true,
  xmf: true,
  gv: true,
  diq: true,
  or: true,
  kv: true,
  pag: true,
  km: true,
  zea: true,
  dv: true,
  nrm: true,
  mhr: true,
  rm: true,
  koi: true,
  udm: true,
  csb: true,
  frr: true,
  vep: true,
  lad: true,
  lij: true,
  wuu: true,
  fur: true,
  'zh-classical': true,
  ug: true,
  sc: true,
  stq: true,
  ay: true,
  mt: true,
  pi: true,
  so: true,
  bh: true,
  ksh: true,
  nov: true,
  hak: true,
  ang: true,
  kw: true,
  pcd: true,
  nv: true,
  gn: true,
  ext: true,
  frp: true,
  as: true,
  szl: true,
  gag: true,
  eml: true,
  ie: true,
  ln: true,
  ace: true,
  ce: true,
  pfl: true,
  krc: true,
  xal: true,
  haw: true,
  pdc: true,
  rw: true,
  crh: true,
  to: true,
  dsb: true,
  kl: true,
  arc: true,
  myv: true,
  kab: true,
  lez: true,
  bjn: true,
  sn: true,
  pap: true,
  tpi: true,
  lbe: true,
  wo: true,
  jbo: true,
  mdf: true,
  'cbk-zam': true,
  av: true,
  kbd: true,
  srn: true,
  mwl: true
};

var hundredPlusLanguages = {
  ty: true,
  lo: true,
  ab: true,
  tet: true,
  kg: true,
  ltg: true,
  na: true,
  ig: true,
  bxr: true,
  nso: true,
  za: true,
  kaa: true,
  zu: true,
  chy: true,
  rmy: true,
  'roa-rup': true,
  cu: true,
  tn: true,
  chr: true,
  bi: true,
  cdo: true,
  got: true,
  sm: true,
  mo: true,
  bm: true,
  iu: true,
  pih: true,
  pnt: true,
  sd: true,
  ss: true,
  ki: true,
  ee: true,
  ha: true,
  om: true,
  fj: true,
  ti: true,
  ts: true,
  ks: true,
  ve: true,
  sg: true,
  rn: true,
  st: true,
  dz: true,
  ak: true,
  cr: true,
  tum: true,
  lg: true,
  ik: true,
  ff: true,
  ny: true,
  tw: true,
  ch: true,
  xh: true
};

var tenPlusLanguages = {
  ng: true,
  ii: true,
  cho: true,
  mh: true
};

var onePlusLanguages = {
  aa: true,
  kj: true,
  ho: true,
  mus: true,
  kr: true
};

var zeroLanguages = {
  hz: true
};

var reallyLongTailWikipedias = [].concat(
    tenThousandPlusLanguages,
    thousandPlusLanguages,
    hundredPlusLanguages,
    tenPlusLanguages,
    onePlusLanguages,
    zeroLanguages);

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
if (MONITOR_REALLY_LONG_TAIL_WIKIPEDIAS) {
  Object.keys(tenThousandPlusLanguages).forEach(function(language) {
    IRC_CHANNELS.push('#' + language + PROJECT);
  });
  Object.keys(thousandPlusLanguages).forEach(function(language) {
    IRC_CHANNELS.push('#' + language + PROJECT);
  });
  Object.keys(hundredPlusLanguages).forEach(function(language) {
    IRC_CHANNELS.push('#' + language + PROJECT);
  });
  Object.keys(tenPlusLanguages).forEach(function(language) {
    IRC_CHANNELS.push('#' + language + PROJECT);
  });
  Object.keys(onePlusLanguages).forEach(function(language) {
    IRC_CHANNELS.push('#' + language + PROJECT);
  });
  Object.keys(zeroLanguages).forEach(function(language) {
    IRC_CHANNELS.push('#' + language + PROJECT);
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

function monitorWikipedia() {
  // fires whenever a new IRC message arrives on any of the IRC rooms
  client.addListener('message', function(from, to, message) {
    // this is the Wikipedia IRC bot that announces live changes
    if (from === 'rc-pmtpa') {
      // get the editor's username or IP address
      // the IRC log format is as follows (with color codes removed):
      // rc-pmtpa: [[Juniata River]] http://en.wikipedia.org/w/index.php?diff=516269072&oldid=514659029 * Johanna-Hypatia * (+67) Category:Place names of Native American origin in Pennsylvania
      var messageComponents = message.split(' * ');
      var articleRegExp = /\[\[(.+?)\]\].+?$/;
      var article = messageComponents[0].replace(articleRegExp, '$1');
      // discard non-article namespaces, as listed here:
      // http://www.mediawiki.org/wiki/Help:Namespaces
      // this means only listening to messages without a ':' essentially
      if (article.indexOf(':') === -1) {
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
        var diffUrl = flagsAndDiffUrl[1];
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
        deltaAndCommentRegExp = /\(([+-]\d+)\)\s(.*?)$/;
        var delta = messageComponents[2].replace(deltaAndCommentRegExp, '$1');
        var comment = messageComponents[2].replace(deltaAndCommentRegExp, '$2');

        // new article
        if (!articleVersionsMap[article]) {
          // self-reference to detect repeatedly edited single-language version
          // articles that do not have other language versions
          articleVersionsMap[article] = article;
          // store the first occurrence of the new article
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
            editor: editor,
            comment: comment ? comment : ''
          };
          io.sockets.emit('firstTimeSeen', {
            article: article,
            timestamp: new Date(articles[article].timestamp).toString(),
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
              timestamp: new Date(now).toString()
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
            // get the diff URL and check if we have notable or trivial changes
            var options = {
              url: diffUrl,
              headers: {
                'User-Agent': USER_AGENT
              }
            };
            if (!diffUrl) {
              return;
            }
            request.get(options, function(error, response, body) {
              if (!error) {
                var json;
                try {
                  json = JSON.parse(body);
                } catch(e) {
                  json = false;
                }
                if (json && json.compare && json.compare['*']) {
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
                  if (!diffTexts) {
                    return;
                  }
                  articles[article].changes[now].diffTexts = diffTexts;
                  articles[article].changes[now].namedEntities = diffConcepts;
                  // check if all three breaking news conditions are fulfilled
                  // at once
                  if ((breakingNewsThresholdReached) &&
                      (allEditsInShortDistances) &&
                      (numberOfEditorsReached)) {
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
                        breakingNewsThreshold: breakingNewsThresholdReached,
                        secondsBetweenEdits: allEditsInShortDistances,
                        numberOfConcurrentEditors: numberOfEditorsReached
                      },
                      socialNetworksResults: socialNetworksResults
                    });
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
                  }
                }
              } else {
                console.warn('Wikipedia API error while getting diff text.' +
                    (response? ' Status Code: ' + response.statusCode : ''));
              }
            });
          });
        }
      }
    }
  });
}

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
                    (oneHundredThousandPlusLanguages[lang])) ||
                ((MONITOR_REALLY_LONG_TAIL_WIKIPEDIAS) &&
                    (reallyLongTailWikipedias[lang]))) {
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
    console.warn('Wikipedia API error while getting language references.' +
        (response? ' Status Code: ' + response.statusCode : ''));
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

function createWikipediaUrl(article) {
  var components = article.split(':');
  return 'http://' + components[0] + '.wikipedia.org/wiki/' +
      encodeURIComponent(components[1]);
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
      console.warn('Tweet error: ' + err);
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