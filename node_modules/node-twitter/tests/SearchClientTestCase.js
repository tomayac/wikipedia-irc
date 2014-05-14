var assert = require('assert');
var Twitter = require('../lib/Twitter');
var Util = require('util');

/**
 * Creates an instance of SearchClientTestCase.
 *
 * @constructor
 */
var SearchClientTestCase = function(oAuthCredentials)
{
    Object.call(this);

    this._oAuthCredentials = oAuthCredentials;
    this._twitterRestClient = null;
};

Util.inherits(SearchClientTestCase, Object);

SearchClientTestCase.prototype.setUp = function()
{
    this._twitterSearchClient = new Twitter.SearchClient(
        this._oAuthCredentials['consumerKey'],
        this._oAuthCredentials['consumerSecret'],
        this._oAuthCredentials['token'],
        this._oAuthCredentials['tokenSecret']
    );
};

SearchClientTestCase.prototype.testCreate = function()
{
    assert.equal(true, this._twitterSearchClient instanceof Twitter.SearchClient);
};

SearchClientTestCase.prototype.testSearch = function()
{
    this._twitterSearchClient.search({'q': 'node.js'}, function(error, result) {
        assert.ifError(error);
        assert.deepEqual(typeof(result), 'object');
    });
};

module.exports = SearchClientTestCase;
