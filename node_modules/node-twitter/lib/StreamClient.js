var Util = require('util');
var Client = require('./Client');
var Constants = require('./Constants');

/**
 * Creates an instance of StreamClient.
 *
 * @constructor
 * @this {StreamClient}
 * @param {String} consumerKey OAuth consumer key.
 * @param {String} consumerSecret OAuth consumer secret.
 * @param {String} token OAuth token.
 * @param {String} tokenSecret OAuth token secret.
 */
var StreamClient = function(consumerKey, consumerSecret, token, tokenSecret)
{
    Client.call(this, consumerKey, consumerSecret, token, tokenSecret);

    this._apiBaseUrlString = Constants.StreamApiBaseURLString;
    this._apiVersion = Constants.StreamApiVersion;
};

Util.inherits(StreamClient, Client);

/**
 * Returns whether or not the stream client is currently running.
 *
 * @this {StreamClient}
 * @return true if the StreamClient is running; false otherwise.
 */
StreamClient.prototype.isRunning = function()
{
    var self = this;
    return Object.keys(self._connections).length >= 1;
};

/**
 * Creates an asynchronous connection to the Twitter Stream API and begins 
 * listening for public statuses that match one or more filter predicates.
 *
 * Listeners should be attached to the <code>StreamClient</code> instance in
 * order to respond to events:
 *
 * <pre>
 * // Request to remove geolocation information from a status
 * twitterStreamClient.on('deleteLocation', function(data) {
 *   console.log(data);
 * });
 *
 * // Status deletion request
 * twitterStreamClient.on('deleteTweet', function(data) {
 *   console.log(data);
 * });
 *
 * // Connection to the stream has been closed
 * twitterStreamClient.on('end', function() {
 *   console.log('Connection closed.');
 * });
 *
 * // An error has occurred
 * twitterStreamClient.on('error', function(error) {
 *   console.log('Error: ' + error.code ? error.code + ' ' + error.message : error.message);
 * });
 *
 * // A retweet has been received
 * twitterStreamClient.on('retweet', function(retweet) {
 *   console.log(retweet);
 * });
 *
 * // A tweet has been received
 * twitterStreamClient.on('tweet', function(tweet) {
 *   console.log(tweet);
 * });
 * </pre>
 *
 * See <a href="https://dev.twitter.com/docs/streaming-api/concepts">Twitter Streaming API Concepts</a>
 * for information on the structure of the JSON responses returned from the Twitter Streaming API.
 *
 * @this {StreamClient}
 * @param {Array} keywords A set of keywords to track.
 * @param {Array} locations A set of one or more latitude/longitude pairs defining geofences to track.
 * @param {Array} users A set of users to track.
 * @param {integer} count Number of previous statuses to deliver before transitioning to live stream delivery.
 */
StreamClient.prototype.start = function(keywords, locations, users, count, callback)
{
    if (this.isRunning() === true)
    {
        throw new Error('StreamClient is currently running.');
    }

    var parameters = {};

    if (keywords !== undefined && keywords !== null)
    {
        if (keywords instanceof Array)
        {
            parameters['track'] = keywords.join(',');
        }
        else
        {
            throw new Error('Expected Array object.');
        }
    }

    if (locations !== undefined && locations !== null)
    {
        if (locations instanceof Array)
        {
            parameters['locations'] = locations.join(',');
        }
        else
        {
            throw new Error('Expected Array object.');
        }
    }

    if (users !== undefined && users !== null)
    {
        if (users instanceof Array)
        {
            parameters['follow'] = users.join(',');
        }
        else
        {
            throw new Error('Expected Array object.');
        }
    }

    if (count !== undefined && count !== null)
    {
        if (isNaN(count) === false)
        {
            parameters['count'] = count;
        }
        else
        {
            throw new Error('Expected integer.');
        }
    }

    this._createPostRequest('statuses/filter', 'json', parameters);
    if(callback && typeof callback === 'function')
    {
        callback(null, "tweet");
    }
};

/**
 * Disconnects from the Twitter Streaming API.
 *
 * @this {StreamClient}
 */
StreamClient.prototype.stop = function(callback)
{
    var self = this;

    for (var key in this._connections)
    {
        var connection = this._connectionForKey(key);
        if (connection === undefined)
        {
            delete self._connections[key];
        }

        connection.httpRequest.req.abort();
    }
    if(callback && typeof callback === 'function')
    {
        // wait before calling back to make sure aborts finish
        var waitUntilStopped = function(){
            if(self.isRunning())
            {
                setTimeout(waitUntilStopped, 100);
            }
            else
            {
                callback(null, "tweet");
            }
        };
        waitUntilStopped();
    }
};

/**
 * Handles the ending of a request.
 *
 * @private
 * @this {StreamClient}
 * @param {http.ClientRequest} aRequest The request object.
 */
StreamClient.prototype._requestDidClose = function(aRequest)
{
    Client.prototype._requestDidClose.call(this, aRequest);

    this.emit('close');
};

/**
 * Handles the closing of a request.
 *
 * @private
 * @this {StreamClient}
 * @param {http.ClientRequest} aRequest The request object.
 */
StreamClient.prototype._requestDidEnd = function(aRequest)
{
    Client.prototype._requestDidEnd.call(this, aRequest);

    this.emit('end');
};

/**
 * Handles the failure of a request.
 *
 * @private
 * @this {StreamClient}
 * @param {http.ClientRequest} aRequest The request object.
 * @param {Error} aError An Error object.
 */
StreamClient.prototype._requestDidFailWithError = function(aRequest, aError)
{
    Client.prototype._requestDidFailWithError.call(this, aRequest, aError);

    this.emit('error', aError);
};

/**
 * Handles data received from the Twitter stream.
 *
 * @private
 * @this {StreamClient}
 * @param {http.ClientRequest} aRequest The request object.
 * @param {Buffer} aData
 */
StreamClient.prototype._requestDidReceiveData = function(aRequest, aData)
{
    var connection = this._connectionForKey(aRequest.hash);
    if (connection === undefined) return;

    connection['data'] = connection['data'] + aData.toString('utf8');

    var index = -1;
    while ((index = connection['data'].indexOf(Constants.StreamApiObjectTerminator)) !== -1)
    {
        var jsonString = connection['data'].slice(0, index);
        connection['data'] = connection['data'].slice(index + Constants.StreamApiObjectTerminator.length);

        // If jsonString has a length of zero continue without emitting any
        // events.
        if (jsonString.length === 0) continue;

        var object = undefined;
        try
        {
            object = JSON.parse(jsonString);
        }
        catch (e)
        {
            // If an error occurs while parsing the JSON string reset object
            // and emit the error
            object = undefined;
            this.emit('error', e);
        }

        // If object is undefined continue without emitting any events.
        if (object === undefined) continue;

        if (object.delete !== undefined)
        {
            this.emit('deleteTweet', object.delete);
        }
        else if (object.scrub_geo !== undefined)
        {
            this.emit('deleteLocation', object.scrub_geo);
        }
        else if (object.limit !== undefined)
        {
            this.emit('limit', object.limit);
        }
        else if (object.retweeted_status !== undefined)
        {
            this.emit('retweet', object.retweeted_status);
        }
        else
        {
            this.emit('tweet', object);
        }
    }
};

module.exports = StreamClient;
