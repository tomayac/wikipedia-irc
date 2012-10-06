var VERBOUS = true;

// an article is thrown out of the monitoring loop if its last edit is longer 
// ago than SECONDS_SINCE_LAST_EDIT seconds
var SECONDS_SINCE_LAST_EDIT = 240;

// an article must have at max SECONDS_BETWEEN_EDITS seconds in between edits
// in order to be regarded a breaking news candidate
var SECONDS_BETWEEN_EDITS = 60;

// an article must have at least BREAKING_NEWS_THRESHOLD edits before it is
// considered a breaking news candidate
var BREAKING_NEWS_THRESHOLD = 5;

var IRC_SERVER = 'irc.wikimedia.org';
var IRC_NICK = 'wikipedia-live-monitor';
var IRC_CHANNELS = ['#en.wikipedia'];

var irc = require('irc');
var client = new irc.Client(
    IRC_SERVER,
    IRC_NICK,
    {
      channels: IRC_CHANNELS
    });

var articles = {};

client.addListener('message', function(from, to, message) {
  if (from === 'rc-pmtpa') {
    var regex = /\x0314\[\[\x0307(.+?)\x0314\]\]\x034.+?$/;
    var article = message.replace(regex, '$1');
    
    // get the editor's username or IP address
    // the IRC log format is as follows:
    // rc-pmtpa: [[Juniata River]] http://en.wikipedia.org/w/index.php?diff=516269072&oldid=514659029 * Johanna-Hypatia * (+67) Category:Place names of Native American origin in Pennsylvania
    var editor = message.split('*')[1]
        .replace(/^\s+/, '')
        .replace(/\x0303/, '')
        .replace(/\x035/, '')
        .replace(/\s+$/, '');

    // check that we have an edit of an article
    // namespaces come from http://www.mediawiki.org/wiki/Help:Namespaces
    // also exclude "Wikipedia" and "Wikipedia talk"
    if ((article.indexOf('Media:') !== 0) &&
        (article.indexOf('Special:') !== 0) &&
        (article.indexOf('Talk:') !== 0) &&
        (article.indexOf('User:') !== 0) &&
        (article.indexOf('User talk:') !== 0) &&
        (article.indexOf('Project:') !== 0) &&
        (article.indexOf('Project talk:') !== 0) &&
        (article.indexOf('File:') !== 0) &&
        (article.indexOf('File talk:') !== 0) &&
        (article.indexOf('MediaWiki:') !== 0) &&
        (article.indexOf('MediaWiki talk:') !== 0) &&
        (article.indexOf('Template:') !== 0) &&
        (article.indexOf('Template talk:') !== 0) &&
        (article.indexOf('Help:') !== 0) &&
        (article.indexOf('Help talk:') !== 0) &&
        (article.indexOf('Category:') !== 0) &&
        (article.indexOf('Category talk:') !== 0) &&
        (article.indexOf('Wikipedia:') !== 0) &&
        (article.indexOf('Wikipedia talk:') !== 0)) {
      article = article.replace(/\s/g, '_');
      // new article    
      if (!articles[article]) {
        articles[article] = {
          timestamp: new Date().getTime(),
          occurrences: 1,
          intervals: [],
          editors: [editor]
        };
        if (VERBOUS) {
          console.log('[ * ] First time seen: "' + article + '"');
        }
      // existing article  
      } else {
        // update statistics of the article
        articles[article].occurrences += 1;
        var now = new Date().getTime();
        articles[article].intervals.push(now - articles[article].timestamp);
        articles[article].timestamp = now;
        if (articles[article].editors.indexOf(editor) === false) {
          articles[article].editors.push(editor);
        }
        if (VERBOUS) {
          console.log('[ ! ] ' + articles[article].occurrences +
              ' times seen: "' + article + '".' +
              ' Edit intervals: ' + articles[article].intervals.toString()
              .replace(/(\d+),?/g, '$1ms ').trim() + '. ' +
              ' Number of editors: ' + articles[article].editors.length + '.');
        }
        if (articles[article].occurrences >= BREAKING_NEWS_THRESHOLD) {
          // check interval distances between edits
          // if something is suspected to be breaking news, all interval
          // distances must be below a certain threshold
          var intervals = articles[article].intervals;
          var allEditsInShortDistances = false;
          for (i = 0, len = intervals.length; i < len; i++) {
            if (intervals[i] <= SECONDS_BETWEEN_EDITS * 1000) {
              allEditsInShortDistances = true;
            } else {
              break;
            }
          }
          // check if at least two editors made edits at roughly the same time
          numberOfEditors = articles[article].editors.length;
          if ((allEditsInShortDistances) &&
              (numberOfEditors >= 2)) {
            console.log('[ ★ ] Breaking news candidate: "' + article + '". ' + 
                articles[article].occurrences +
                ' times seen.' +
                ' Edit intervals: ' + articles[article].intervals.toString()
                .replace(/(\d+),?/g, '$1ms ').trim() + '. ' +
                ' Number of editors: ' +
                articles[article].editors.length + '.');
          }
        }
      }
      // clean-up
      for (key in articles) {
        var now = new Date().getTime();
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