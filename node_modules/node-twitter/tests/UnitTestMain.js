var RestClientTestCase = require('./RestClientTestCase');
var SearchClientTestCase = require('./SearchClientTestCase');

var oAuthCredentials = {
    consumerKey: 'CONSUMER_KEY',
    consumerSecret: 'CONSUMER_SECRET',
    token: 'TOKEN',
    tokenSecret: 'TOKEN_SECRET'
};

// REST API

var restClientTestCase = new RestClientTestCase(oAuthCredentials);
restClientTestCase.setUp();
restClientTestCase.testCreate();

setTimeout(function() {
    console.log('RestClient.testStatusesHomeTimeline');
    restClientTestCase.testStatusesHomeTimeline();
}, 0);

setTimeout(function() {
    console.log('RestClient.testStatusesMentions');
    restClientTestCase.testStatusesMentions();
}, 2000);

setTimeout(function() {
    console.log('RestClient.testStatusesPublicTimeline');
    restClientTestCase.testStatusesPublicTimeline();
}, 4000);

setTimeout(function() {
    console.log('RestClient.testStatusesRetweetedByMe');
    restClientTestCase.testStatusesRetweetedByMe();
}, 6000);

setTimeout(function() {
    console.log('RestClient.testStatusesRetweetedByUser');
    restClientTestCase.testStatusesRetweetedByUser();
}, 8000);

setTimeout(function() {
    console.log('RestClient.testStatusesRetweetedToMe');
    restClientTestCase.testStatusesRetweetedToMe();
}, 10000);

setTimeout(function() {
    console.log('RestClient.teststatusesRetweetedToUser');
    restClientTestCase.teststatusesRetweetedToUser();
}, 12000);

setTimeout(function() {
    console.log('RestClient.testStatusesRetweetsOfMe');
    restClientTestCase.testStatusesRetweetsOfMe();
}, 14000);

setTimeout(function() {
    console.log('RestClient.testStatusesUserTimeline');
    restClientTestCase.testStatusesUserTimeline();
}, 16000);

setTimeout(function() {
    console.log('RestClient.testStatusesRetweetedBy');
    restClientTestCase.testStatusesRetweetedBy();
}, 18000);

setTimeout(function() {
    console.log('RestClient.testStatusesRetweetedByIds');
    restClientTestCase.testStatusesRetweetedByIds();
}, 20000);

setTimeout(function() {
    console.log('RestClient.testStatusesRetweets');
    restClientTestCase.testStatusesRetweets();
}, 22000);

setTimeout(function() {
    console.log('RestClient.testStatusesShow');
    restClientTestCase.testStatusesShow();
}, 24000);

setTimeout(function() {
    console.log('RestClient.testStatusesOEmbed');
    restClientTestCase.testStatusesOEmbed();
}, 26000);

// Tests create and delete of a tweet.
setTimeout(function() {
    console.log('RestClient.testStatusesUpdate');
    restClientTestCase.testStatusesUpdate();
}, 28000);

// Tests create and delete of a retweet.
setTimeout(function() {
    console.log('RestClient.testStatusesRetweet');
    restClientTestCase.testStatusesRetweet();
}, 30000);

// Test create and delete of a tweet containing media.
setTimeout(function() {
    console.log('RestClient.testStatusesUpdateWithMedia');
    restClientTestCase.testStatusesUpdateWithMedia();
}, 32000);

// Search API

var searchClientTestCase = new SearchClientTestCase(oAuthCredentials);
searchClientTestCase.setUp();
searchClientTestCase.testCreate();

// Test create and delete of a tweet containing media.
setTimeout(function() {
    console.log('SearchClient.testSearch');
    searchClientTestCase.testSearch();
}, 34000);


