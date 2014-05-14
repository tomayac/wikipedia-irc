var assert = require('assert');
var fs = require('fs');
var path = require('path');
var Twitter = require('../lib/Twitter');
var Util = require('util');

/**
 * Creates an instance of RestClientTestCase.
 *
 * @constructor
 */
var RestClientTestCase = function(oAuthCredentials)
{
    Object.call(this);

    this._oAuthCredentials = oAuthCredentials;
    this._twitterRestClient = null;
};

Util.inherits(RestClientTestCase, Object);

RestClientTestCase.prototype.setUp = function()
{
    this._twitterRestClient = new Twitter.RestClient(
        this._oAuthCredentials['consumerKey'],
        this._oAuthCredentials['consumerSecret'],
        this._oAuthCredentials['token'],
        this._oAuthCredentials['tokenSecret']
    );
};

RestClientTestCase.prototype.tearDown = function()
{
    delete(this._twitterRestClient);
    this._twitterRestClient = null;
};

RestClientTestCase.prototype.testCreate = function()
{
    assert.equal(true, this._twitterRestClient instanceof Twitter.RestClient);
};

RestClientTestCase.prototype.testValidators = function()
{
    
};

RestClientTestCase.prototype.testStatusesDestroy = function()
{
    this._twitterRestClient.statusesDestroy({'id': '18976237157'}, function(error, result) {
        assert.ifError(error);
        assert.deepEqual(typeof(result), 'object');
    });
};

RestClientTestCase.prototype.testStatusesHomeTimeline = function()
{
    this._twitterRestClient.statusesHomeTimeline({}, function(error, result) {
        assert.ifError(error);
        assert.deepEqual(typeof(result), 'object');
    });
};

RestClientTestCase.prototype.testStatusesMentions = function()
{
    this._twitterRestClient.statusesMentions({}, function(error, result) {
        assert.ifError(error);
        assert.deepEqual(typeof(result), 'object');
    });
};

RestClientTestCase.prototype.testStatusesOEmbed = function()
{
    this._twitterRestClient.statusesOEmbed({'id': '99530515043983360'}, function(error, result) {
        assert.ifError(error);
        assert.deepEqual(typeof(result), 'object');
    });
};

RestClientTestCase.prototype.testStatusesPublicTimeline = function()
{
    this._twitterRestClient.statusesPublicTimeline({}, function(error, result) {
        assert.ifError(error);
        assert.deepEqual(typeof(result), 'object');
    });
};

RestClientTestCase.prototype.testStatusesRetweet = function()
{
    var self = this;

    self._twitterRestClient.statusesRetweet({'id': '3962807808'}, function(error, result) {
        assert.ifError(error);
        assert.deepEqual(typeof(result), 'object');

        self._twitterRestClient.statusesDestroy({'id': result.id_str}, function(error, result) {
            assert.ifError(error);
            assert.deepEqual(typeof(result), 'object');
        });
    });
};

RestClientTestCase.prototype.testStatusesRetweetedBy = function()
{
    this._twitterRestClient.statusesRetweetedBy({'id': '21947795900469248'}, function(error, result) {
        assert.ifError(error);
        assert.deepEqual(typeof(result), 'object');
    });
};

RestClientTestCase.prototype.testStatusesRetweetedByIds = function()
{
    this._twitterRestClient.statusesRetweetedByIds({'id': '21947795900469248'}, function(error, result) {
        assert.ifError(error);
        assert.deepEqual(typeof(result), 'object');
    });
};

RestClientTestCase.prototype.testStatusesRetweetedByMe = function()
{
    this._twitterRestClient.statusesRetweetedByMe({}, function(error, result) {
        assert.ifError(error);
        assert.deepEqual(typeof(result), 'object');
    });
};

RestClientTestCase.prototype.testStatusesRetweetedByUser = function()
{
    this._twitterRestClient.statusesRetweetedByUser({'screen_name': 'cvee'}, function(error, result) {
        assert.ifError(error);
        assert.deepEqual(typeof(result), 'object');
    });
};

RestClientTestCase.prototype.testStatusesRetweetedToMe = function()
{
    this._twitterRestClient.statusesRetweetedToMe({}, function(error, result) {
        assert.ifError(error);
        assert.deepEqual(typeof(result), 'object');
    });
};

RestClientTestCase.prototype.teststatusesRetweetedToUser = function()
{
    this._twitterRestClient.statusesRetweetedToUser({'screen_name': 'cvee'}, function(error, result) {
        assert.ifError(error);
        assert.deepEqual(typeof(result), 'object');
    });
};

RestClientTestCase.prototype.testStatusesRetweets = function()
{
    this._twitterRestClient.statusesRetweets({'id': '21947795900469248'}, function(error, result) {
        assert.ifError(error);
        assert.deepEqual(typeof(result), 'object');
    });
};

RestClientTestCase.prototype.testStatusesRetweetsOfMe = function()
{
    this._twitterRestClient.statusesRetweetsOfMe({}, function(error, result) {
        assert.ifError(error);
        assert.deepEqual(typeof(result), 'object');
    });
};

RestClientTestCase.prototype.testStatusesShow = function()
{
    this._twitterRestClient.statusesShow({'id': '112652479837110273'}, function(error, result) {
        assert.ifError(error);
        assert.deepEqual(typeof(result), 'object');
    });
};

RestClientTestCase.prototype.testStatusesUserTimeline = function()
{
    this._twitterRestClient.statusesUserTimeline({'screen_name': 'cvee'}, function(error, result) {
        assert.ifError(error);
        assert.deepEqual(typeof(result), 'object');
    });
};

RestClientTestCase.prototype.testStatusesUpdate = function()
{
    var self = this;

    this._twitterRestClient.statusesUpdate({'status': 'Unit testing a status update in node-twitter. https://github.com/iStrategyLabs/node-twitter'}, function(error, result) {
        assert.ifError(error);
        assert.deepEqual(typeof(result), 'object');

        self._twitterRestClient.statusesDestroy({id: result.id_str}, function(error, result) {
            assert.ifError(error);
            assert.deepEqual(typeof(result), 'object');
        });
    });
};

RestClientTestCase.prototype.testStatusesUpdateWithMedia = function()
{
    var self = this;

    this._twitterRestClient.statusesUpdateWithMedia(
        {
            'status': 'Unit testing a status update w/ attached media in node-twitter.',
            'media[]': path.normalize(__dirname + '/flags.jpg')
        },
        function(error, result) {
            assert.ifError(error);
            assert.deepEqual(typeof(result), 'object');

            self._twitterRestClient.statusesDestroy({id: result.id_str}, function(error, result) {
                assert.ifError(error);
                assert.deepEqual(typeof(result), 'object');
            });
    });
};

module.exports = RestClientTestCase;
