var reset = document.querySelector('#reset');
reset.addEventListener('click', function(e) {
  document.querySelector('#secondsSinceLastEdit')
  .value = 240;
  document.querySelector('#secondsSinceLastEditValue')
  .innerHTML = 240;

  document.querySelector('#secondsBetweenEdits')
  .value = 60;
  document.querySelector('#secondsBetweenEditsValue')
  .innerHTML = 60;

  document.querySelector('#breakingNewsThreshold')
  .value = 5;
  document.querySelector('#breakingNewsThresholdValue')
  .innerHTML = 5;

  document.querySelector('#numberOfConcurrentEditors')
  .value = 2;
  document.querySelector('#numberOfConcurrentEditorsValue')
  .innerHTML = 2;

  socket.emit('secondsSinceLastEdit', {
    value: secondsSinceLastEdit.value
  });

  socket.emit('breakingNewsThreshold', {
    value: breakingNewsThreshold.value
  });

  socket.emit('numberOfConcurrentEditors', {
    value: numberOfConcurrentEditors.value
  });

  socket.emit('secondsBetweenEdits', {
    value: secondsBetweenEdits.value
  });
}, false);

// converts an article like en:Albert_Einstein to a valid Wikipedia link
// like so: http://en.wikipedia.org/wiki/Albert_Einstein
function linkifyTitle(text) {
  var components = text.split(':');
  if (components[0] === 'wikidata') {
    return '<nobr><img src="' + components[0] +
        '.png" width="16" height="11"> ' +
        '<a class="title" href="http://' + components[0] +
        '.org/wiki/' + encodeURIComponent(components[1]) + '">' +
        components[1] + '</a></nobr>';
  } else {
    return '<nobr><img src="' + components[0] +
        '.png" width="16" height="11"> ' +
        '<a class="title" href="http://' + components[0] +
        '.wikipedia.org/wiki/' + encodeURIComponent(components[1]) + '">' +
        components[1].replace(/_/g, ' ') + '</a></nobr>';
  }
}

// converts a user name like en:Jon_Doe to a valid Wikipedia user profile
// link like so: http://en.wikipedia.org/wiki/User:Jon_Doe. Ignore
// anonymous users
function linkifyEditor(user) {
  var components = user.split(':');
  if (/\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(user)) {
    return '<a class="user">' + components[1] + '</a> ' +
        '(' + components[0].split(',').map(function(language) {
          return '<b>' + language + '</b>'; })
        .toString().replace(/,/g, ', ') + ')';
  }
  return '<a class="user" href="http://' +
      components[0].replace(/(\w+),.*/, '$1') +
      '.wikipedia.org/wiki/User:' + components[1] + '">' + components[1] +
      '</a> (' + components[0].split(',').map(function(language) {
        return '<b>' + language + '</b>'; })
      .toString().replace(/,/g, ', ') + ')';
}

function formatLanguages(languagesArray) {
  var html = '';
  languagesArray.forEach(function(lang, i) {
    html += (i > 0 ? ', ' : '') + '<b>' + lang.language + '</b> (' +
        lang.count + ')';
  });
  return html;
}

var firstTimeSeen = document.querySelector('#firstTimeSeen');
function logFirstTimeSeen(data) {
  if (firstTimeSeen.childNodes.length >= 1) {
    firstTimeSeen.removeChild(firstTimeSeen.firstChild);
  }
  firstTimeSeen.innerHTML +=
      '<li style="overflow:hidden;height:3em;" class="article-cluster">' +
        '<strong class="title">' + linkifyTitle(data.article) +
        '</strong> (<span class="humaneDate" data-timestamp="' +
        data.timestamp + '">' +
        humaneDate(new Date(data.timestamp)) + '</span>)' +
        '<br/><b>Editor:</b> ' + data.editors.map(linkifyEditor) +
      '</li>';
}

var merging = document.querySelector('#merging');
function logMerging(data) {
  if (merging.childNodes.length >= 1) {
    merging.removeChild(merging.firstChild);
  }
  merging.innerHTML +=
      '<li style="overflow:hidden;height:3em;" class="article-cluster">' +
        '<strong>' + linkifyTitle(data.current) + '</strong> with ' +
        '<strong>' + linkifyTitle(data.existing) + '</strong> ' +
        '(<span class="humaneDate" data-timestamp="' +
        data.timestamp + '">' +
        humaneDate(new Date(data.timestamp)) + '</span>)' +
      '</li>';
}

function preg_quote (str, delimiter) {
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
}

function generateLogMessage(data, isBreakingNews) {
  // an article cluster's representative article (or centroid) is simply
  // the first occurrence, no matter what language. we sort by language
  // popularity, in order for a more meaningful display.
  var languagesArray = [];
  for(var language in data.languages) {
    var obj = {
      language: language,
      count: data.languages[language]
    };
    languagesArray.push(obj);
  }
  languagesArray.sort(function(a, b) { return b.count - a.count; });
  var versions = {};
  var components = data.article.split(':');
  versions[components[0]] = components[0] + ':' + components[1];
  for (var key in data.versions) {
    components = key.split(':');
    versions[components[0]] = components[0] + ':' + components[1];
  }
  var versionsHtml = '';
  for (var i = 1, len = languagesArray.length; i < len; i++) {
    versionsHtml += (i > 1 ? ', ' : '') +
        linkifyTitle(versions[languagesArray[i].language]);
  }
  var socialHtml = '<ul class="social-network-results">';
  var now = Date.now();
  for (var term in data.socialNetworksResults) {
    // only append the term if microposts exist. need to iterate over all
    // networks and check the freshness. ugly, but works.
    var resultsExistForTerm = false;
    for (var network in data.socialNetworksResults[term]) {
      if (Array.isArray(data.socialNetworksResults[term][network])) {
        data.socialNetworksResults[term][network].forEach(function(item) {
          // not older than 1h: 1 * 60 * 60 * 1000 = 3600000
          if (now - item.timestamp < 3600000) {
            resultsExistForTerm = true;
          }
        });
      }
    }
    if (resultsExistForTerm) {
      socialHtml += '<li><small><b>' + term + '</b></small>';
    }
    for (var network in data.socialNetworksResults[term]) {
      if (Array.isArray(data.socialNetworksResults[term][network])) {
        data.socialNetworksResults[term][network].forEach(function(item) {
          // not older than 1h: 1 * 60 * 60 * 1000 = 3600000
          if (now - item.timestamp < 3600000) {
            var micropost = item.micropost;
            if (micropost.length > 140) {
              var firstPart = micropost.substring(0, 140);
              var expandPart = micropost.substr(140).split(/\s+/);
              var secondPart = expandPart[0];
              expandPart = expandPart.slice(1).join(' ');
              micropost = firstPart + secondPart;
              if (expandPart) {
                expandPart = expandPart.replace(/'/g, "\\'");
                expandPart = expandPart.replace(/"/g, '&quot;');
                micropost +=
                    ' <span onclick="javascript:this.innerHTML = \'' +
                    expandPart + '\'">[<span style="color:blue;">…' +
                    '</span>]</span>';
              }
            }
            socialHtml += '<br/><img class="avatar" src="' + item.avatar +
                '"/> <img class="avatar" src="' +
                network.toLowerCase() + '.png"/> <small><a href="' +
                item.profileLink + '">' +
                item.user + '</a> (<a href="' + item.deepLink + '">' +
                '<span class="humaneDate" data-timestamp="' +
                new Date(item.timestamp) + '">' +
                humaneDate(new Date(item.timestamp)) +
                '</span></a>): ' + micropost.replace(
                    new RegExp('(' + preg_quote(term) + ')', 'gi'),
                    '<span class="highlight">$1</span>') +
                '</small>';
          }
        });
      }
    }
    socialHtml += '</li>';
  }
  socialHtml += '</ul>';

  var html =
      '<li class="article-cluster">' +
        '<strong class="' + (isBreakingNews ? 'breaking' : '') + '">' +
        linkifyTitle(versions[languagesArray[0].language]) +
        '</strong> (<span class="humaneDate" data-timestamp="' +
        data.timestamp + '">' +
        humaneDate(new Date(data.timestamp)) + '</span>)' +
        '<br/><b>Versions:</b> ' + versionsHtml +
        '<br/><b>Conditions:</b> <span class="condition">' +
        '≥ ' + document.querySelector('#breakingNewsThreshold').value +
        ' Occurrences ' + (data.conditions.breakingNewsThreshold ?
            '<span class="condition-true">✓</span> ' :
            '<span class="condition-false">✗</span> ') +
        '</span> <span class="condition">≤ ' +
        document.querySelector('#secondsBetweenEdits').value +
        ' Seconds Between Edits ' + (data.conditions.secondsBetweenEdits ?
            '<span class="condition-true">✓</span> ' :
            '<span class="condition-false">✗</span> ') +
        '</span> <span class="condition">≥ ' +
        document.querySelector('#numberOfConcurrentEditors').value +
        ' Concurrent Editors ' +
        (data.conditions.numberOfConcurrentEditors ?
            '<span class="condition-true">✓</span>' :
            '<span class="condition-false">✗</span>') +
        '</span><br/><b>Last Edit Intervals:</b> ' +
        data.editIntervals.slice(-4).map(function(interval) {
          return ~~(interval / 1000) + ' seconds';
        }).toString().replace(/,/g, ', ') +
        '<br/><b>Occurrences:</b> ' + data.occurrences +
        '<br/><b>Editors</b> (' + data.editors.length + '): ' +
        data.editors.map(linkifyEditor).toString()
        .replace(/,/g, ', ') +
        '<br/><b>Languages</b> (' + languagesArray.length + '): ' +
        formatLanguages(languagesArray) +
        '<br/><b>Last Changes:</b> ' +
        Object.keys(data.changes).slice(-5).map(function(timestamp) {
          var humane = humaneDate(new Date(parseInt(timestamp, 10)));
          var url = data.changes[timestamp].diffUrl;
          if (url) {
            return '<a class="changes" href="' + url + '">' +
                '<span class="humaneDate" data-timestamp="' +
                new Date(parseInt(timestamp, 10)) + '">' +
                humane + '</span></a> ' +
                data.changes[timestamp].editor.split(':')[1] +
                ' (<b>' + data.changes[timestamp].language + '</b>, ' +
                data.changes[timestamp].delta + ')';
          } else {
            return '<span class="new-page">newly created ' + humane +
                '</span> ' +
                data.changes[timestamp].editor.split(':')[1] +
                ' (<b>' + data.changes[timestamp].language + '</b>, ' +
                data.changes[timestamp].delta + ')';
          }
        }).toString().replace(/,/g, ', ') +
        (socialHtml.indexOf('class="avatar"') !== -1 ?
            '<br/><b>Social Network Opinions:</b>' + socialHtml : '') +
      '</li>';
  return html;
}

var nTimesSeen = document.querySelector('#nTimesSeen');
function logNTimesSeen(data) {
  if (nTimesSeen.childNodes.length >= 3) {
    nTimesSeen.removeChild(nTimesSeen.firstChild);
  }
  if (nTimesSeen.querySelector('.none-yet')) {
    nTimesSeen.removeChild(nTimesSeen.querySelector('.none-yet'));
  }
  nTimesSeen.innerHTML += generateLogMessage(data, false);
  attachClickHandler();
}

var breakingNewsCandidate =
    document.querySelector('#breakingNewsCandidates');
function logBreakingNewsCandidate(data) {
  if (breakingNewsCandidate.childNodes.length >= 3) {
    breakingNewsCandidate.removeChild(breakingNewsCandidate.firstChild);
  }
  if (breakingNewsCandidate.querySelector('.none-yet')) {
    breakingNewsCandidate.removeChild(
        breakingNewsCandidate.querySelector('.none-yet'));
  }
  breakingNewsCandidate.innerHTML += generateLogMessage(data, true);
  attachClickHandler();
}

var stats = document.querySelector('#stats');
function logStats(data) {
  stats.innerHTML = data.clustersLeft;
}

function attachClickHandler() {
  var changesLinks = document.querySelectorAll('A.changes');
  for (var i = 0, len = changesLinks.length; i < len; i++) {
    changesLinks[i].addEventListener('click', function(e) {
      e.preventDefault();
      getChanges(e.target.parentNode.href);
    }, false);
  }
}

function getChanges(url) {
  var USER_AGENT = 'Wikipedia Live Monitor * IRC nick: wikipedia-live-monitor * Contact: tomac(a)google.com.';
  $.ajax({
    url: url + '&callback=?',
    headers: {
      'User-Agent': USER_AGENT
    },
    dataType: 'json',
    success: outputChanges
  });
}

function outputChanges(json) {
  if (json && json.compare && json.compare['*']) {
    var changesDiv = document.querySelector('#changes');
    changesDiv.style.display = 'block';
    changesDiv.childNodes[1].innerHTML =
        '<table class="diff">' + json.compare['*'] + '</table>';
  }
}

(function init() {
  // newer JavaScript features, polyfilled for old Android browsers
  if (!Array.isArray) {
    Array.isArray = function (vArg) {
      return Object.prototype.toString.call(vArg) === '[object Array]';
    };
  }
  Object.keys = Object.keys ||
      function(
        o, // object
        k, // key
        r  // result array
      ) {
        // initialize object and result
        r = [];
        // iterate over object keys
        for (k in o) {
          // fill result array with non-prototypical keys
          r.hasOwnProperty.call(o, k) && r.push(k);
        }
        // return result
        return r;
      };
  Date.now || (Date.now = function() { return +new Date });

  var secondsSinceLastEdit =
      document.querySelector('#secondsSinceLastEdit');
  var secondsSinceLastEditValue =
      document.querySelector('#secondsSinceLastEditValue');
  secondsSinceLastEdit.addEventListener('change', function(e) {
    secondsSinceLastEditValue.innerHTML = secondsSinceLastEdit.value;
    socket.emit('secondsSinceLastEdit', {
      value: secondsSinceLastEdit.value
    });
  }, false);

  var secondsBetweenEdits =
      document.querySelector('#secondsBetweenEdits');
  var secondsBetweenEditsValue =
      document.querySelector('#secondsBetweenEditsValue');
  secondsBetweenEdits.addEventListener('change', function(e) {
    secondsBetweenEditsValue.innerHTML = secondsBetweenEdits.value;
    socket.emit('secondsBetweenEdits', {
      value: secondsBetweenEdits.value
    });
  }, false);

  var numberOfConcurrentEditors =
      document.querySelector('#numberOfConcurrentEditors');
  var numberOfConcurrentEditorsValue =
      document.querySelector('#numberOfConcurrentEditorsValue');
  numberOfConcurrentEditors.addEventListener('change', function(e) {
    numberOfConcurrentEditorsValue.innerHTML =
        numberOfConcurrentEditors.value;
    socket.emit('numberOfConcurrentEditors', {
      value: numberOfConcurrentEditors.value
    });
  }, false);

  var breakingNewsThreshold =
      document.querySelector('#breakingNewsThreshold');
  var breakingNewsThresholdValue =
      document.querySelector('#breakingNewsThresholdValue');
  breakingNewsThreshold.addEventListener('change', function(e) {
    breakingNewsThresholdValue.innerHTML = breakingNewsThreshold.value;
    socket.emit('breakingNewsThreshold', {
      value: breakingNewsThreshold.value
    });
  }, false);

  var settingsLink = document.querySelector('#settings-link');
  settingsLink.addEventListener('click', function(e) {
    var settingsContainer = document.querySelector('#settings-container');
    settingsContainer.style.display = 'block';
  }, false);

  var settingsCloseLink = document.querySelector('#settings-close-link');
  settingsCloseLink.addEventListener('click', function(e) {
    this.parentNode.style.display = 'none';
  }, false);

  var changesCloseLink = document.querySelector('#changes-close-link');
  changesCloseLink.addEventListener('click', function(e) {
    this.parentNode.style.display = 'none';
  }, false);

  var socket = io.connect(document.location.href);

  socket.on('defaultSettings', function(data) {
    document.querySelector('#secondsSinceLastEdit')
    .value = data.secondsSinceLastEdit;
    document.querySelector('#secondsSinceLastEditValue')
    .innerHTML = data.secondsSinceLastEdit;

    document.querySelector('#secondsBetweenEdits')
    .value = data.secondsBetweenEdits;
    document.querySelector('#secondsBetweenEditsValue')
    .innerHTML = data.secondsBetweenEdits;

    document.querySelector('#breakingNewsThreshold')
    .value = data.breakingNewsThreshold;
    document.querySelector('#breakingNewsThresholdValue')
    .innerHTML = data.breakingNewsThreshold;

    document.querySelector('#numberOfConcurrentEditors')
    .value = data.numberOfConcurrentEditors;
    document.querySelector('#numberOfConcurrentEditorsValue')
    .innerHTML = data.numberOfConcurrentEditors;
  });

  var editsPerSecondCounter = 0;
  var editsPerSecond = document.querySelector('#editsPerSecond');
  setInterval(function() {
    editsPerSecond.innerHTML = editsPerSecondCounter;
    editsPerSecondCounter = 0;
  }, 1000);

  socket.on('firstTimeSeen', function(data) {
    editsPerSecondCounter++;
    logFirstTimeSeen(data);
  });

  socket.on('merging', function(data) {
    logMerging(data);
  });

  socket.on('nTimesSeen', function(data) {
    logNTimesSeen(data);
  });

  socket.on('breakingNewsCandidate', function(data) {
    logBreakingNewsCandidate(data);
  });

  socket.on('stats', function(data) {
    logStats(data);
    // update humane dates for all timestamped items
    var timestamps = document.querySelectorAll('.humaneDate');
    for (var i = 0, len = timestamps.length; i < len; i++) {
      var timestamp =
          humaneDate(new Date(timestamps[i].dataset.timestamp));
      timestamps[i].innerHTML = timestamp;
    }
  });
})();