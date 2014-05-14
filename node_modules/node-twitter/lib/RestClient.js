var Util = require('util');
var Client = require('./Client');
var Constants = require('./Constants');
var RestParameterValidator = require('./RestParameterValidator');
var UploadClient = require('./UploadClient');

/**
 * Creates an instance of RestClient.
 *
 * @constructor
 * @this {RestClient}
 * @param {String} consumerKey OAuth consumer key.
 * @param {String} consumerSecret OAuth consumer secret.
 * @param {String} token OAuth token.
 * @param {String} tokenSecret OAuth token secret.
 */
var RestClient = function(consumerKey, consumerSecret, token, tokenSecret)
{
    Client.call(this, consumerKey, consumerSecret, token, tokenSecret);

    this._apiBaseUrlString = Constants.RestApiBaseURLString;
    this._apiVersion = Constants.RestApiVersion;
    this._format = 'json';
    this._validator = new RestParameterValidator();
};

Util.inherits(RestClient, Client);

// Direct Messages

/**
 * Returns the 20 most recent direct messages sent to the authenticated user.
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/get/direct_messages">Twitter documenation</a>.
 *
 * @this {RestClient}
 * @param parameters
 * @param callback The callback function.
 */
RestClient.prototype.directMessages = function(parameters, callback)
{
    this._validator.validateCount(parameters);
    this._validator.validateIncludeEntities(parameters);
    this._validator.validateMaxId(parameters);
    this._validator.validatePage(parameters);
    this._validator.validateSinceId(parameters);
    this._validator.validateSkipStatus(parameters);

    this._createGetRequest('direct_messages', this._format, parameters, callback);
}

/**
 * Destroys the specified direct message.
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/post/direct_messages/destroy/%3Aid">Twitter documenation</a>.
 *
 * @this {RestClient}
 * @param parameters
 * @param callback The callback function.
 */
RestClient.prototype.directMessagesDestroy = function(parameters, callback)
{
    var id = parameters['id'];
    if (id === undefined)
    {
        throw new Error('Missing required parameter: id.');
    }

    this._validator.validateId(parameters);
    this._validator.validateIncludeEntities(parameters);

    var resource = 'direct_messages/destroy/' + id;

    // Remove the id key from the list of query parameters.
    delete(parameters['id']);

    this._createPostRequest(resource, this._format, parameters, callback);
}

/**
 * Returns the 20 most recent direct messages sent by the authenticated user.
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/get/direct_messages/sent">Twitter documenation</a>.
 *
 * @this {RestClient}
 * @param parameters
 * @param callback The callback function.
 */
RestClient.prototype.directMessagesSent = function(parameters, callback)
{
    this._validator.validateCount(parameters);
    this._validator.validateIncludeEntities(parameters);
    this._validator.validateMaxId(parameters);
    this._validator.validatePage(parameters);
    this._validator.validateSinceId(parameters);

    this._createGetRequest('direct_messages/sent', this._format, parameters, callback);
}

/**
 * Sends a direct message to a to a follower of the authenticated user.
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1.1/post/direct_messages/new">Twitter documenation</a>.
 *
 * @this {RestClient}
 * @param parameters
 * @param callback The callback function.
 */
RestClient.prototype.directMessagesNew = function(parameters, callback)
{
    this._validator.validateUserId(parameters);
    this._validator.validateScreenName(parameters);
    this._validator.validateText(parameters);

    this._createPostRequest('direct_messages/new', this._format, parameters, callback);
}

// Friends & Followers

/**
 * Returns an array of numeric IDs for every user following the specified user.
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/get/followers/ids">Twitter documenation</a>.
 *
 * @this {RestClient}
 * @param parameters
 * @param callback The callback function.
 */
RestClient.prototype.followersIds = function(parameters, callback)
{
    var screenName = parameters['screen_name'];
    var userId = parameters['user_id'];
    if (screenName === undefined && userId === undefined)
    {
        throw new Error('Missing required parameter: screen_name or user_id.');
    }

    this._validator.validateScreenName(parameters);
    this._validator.validateUserId(parameters);

    // To work around JavaScript's inability to handle large numbers 
    // indicate IDs should be returned as strings
    parameters['stringify_ids'] = true;

    this._createGetRequest('followers/ids', this._format, parameters, callback);
}

// Timelines
//
// Timelines are collections of Tweets, ordered with the most recent first.

/**
 * Returns the 20 most recent tweets (including retweets), posted by the authenticated user and the user they follow.
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/get/statuses/home_timeline">Twitter documenation</a>.
 *
 * @this {RestClient}
 * @param {Dictionary} parameters
 * @param {Function} callback The callback function.
 */
RestClient.prototype.statusesHomeTimeline = function(parameters, callback)
{
    this._validator.validateContributorDetails(parameters);
    this._validator.validateCount(parameters);
    this._validator.validateExcludeReplies(parameters);
    this._validator.validateIncludeEntities(parameters);
    this._validator.validateIncludeRetweets(parameters);
    this._validator.validateMaxId(parameters);
    this._validator.validatePage(parameters);
    this._validator.validateSinceId(parameters);
    this._validator.validateTrimUser(parameters);

	this._createGetRequest('statuses/home_timeline', this._format, parameters, callback);
};

/**
 * Retrieves the most recent mentions for the authenticated user.
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/get/statuses/mentions">Twitter documentation</a>.
 *
 * @this {RestClient}
 * @param {Dictionary} parameters
 * @param {Function} callback The callback function.
 */
RestClient.prototype.statusesMentions = function(parameters, callback)
{
    this._validator.validateContributorDetails(parameters);
    this._validator.validateCount(parameters);
    this._validator.validateExcludeReplies(parameters);
    this._validator.validateIncludeEntities(parameters);
    this._validator.validateIncludeRetweets(parameters);
    this._validator.validateMaxId(parameters);
    this._validator.validatePage(parameters);
    this._validator.validateSinceId(parameters);
    this._validator.validateTrimUser(parameters);

    this._createGetRequest('statuses/mentions', this._format, parameters, callback);
};

/**
 * Retrieves the most recent statuses, including retweets if they exist, from non-protected users.
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/get/statuses/public_timeline">Twitter documenation</a>.
 *
 * @this {RestClient}
 * @param {Dictionary} parameters
 * @param {Function} callback The callback function.
 */
RestClient.prototype.statusesPublicTimeline = function(parameters, callback)
{
    this._validator.validateCount(parameters);
    this._validator.validateIncludeEntities(parameters);
    this._validator.validateTrimUser(parameters);

    this._createGetRequest('statuses/public_timeline', this._format, parameters, callback);
};

/**
 * Retrieves the most recent statuses retweeted by the authenticated user.
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/get/statuses/retweeted_by_me">Twitter documenation</a>.
 *
 * @this {RestClient}
 * @param {Dictionary} parameters
 * @param {Function} callback The callback function.
 */
RestClient.prototype.statusesRetweetedByMe = function(parameters, callback)
{
    this._validator.validateCount(parameters);
    this._validator.validateIncludeEntities(parameters);
    this._validator.validateMaxId(parameters);
    this._validator.validatePage(parameters);
    this._validator.validateSinceId(parameters);
    this._validator.validateTrimUser(parameters);

    this._createGetRequest('statuses/retweeted_by_me', this._format, parameters, callback);
};

/**
 * Retrieves the most recent retweets posted by the specified user.
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/get/statuses/retweeted_by_user">Twitter documenation</a>.
 *
 * @this {RestClient}
 * @param {Dictionary} parameters
 * @param {Function} callback The callback function.
 */
RestClient.prototype.statusesRetweetedByUser = function(parameters, callback)
{
    this._validator.validateCount(parameters);
    this._validator.validateIncludeEntities(parameters);
    this._validator.validateMaxId(parameters);
    this._validator.validatePage(parameters);
    this._validator.validateScreenName(parameters);
    this._validator.validateSinceId(parameters);
    this._validator.validateTrimUser(parameters);
    this._validator.validateUserId(parameters);

    this._createGetRequest('statuses/retweeted_by_user', this._format, parameters, callback);
};

/**
 * Retrieves the most recent retweets posted by users the authenticated user follows.
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/get/statuses/retweeted_to_me">Twitter documenation</a>.
 *
 * @this {RestClient}
 * @param {Dictionary} parameters
 * @param {Function} callback The callback function.
 */
RestClient.prototype.statusesRetweetedToMe = function(parameters, callback)
{
    this._validator.validateCount(parameters);
    this._validator.validateIncludeEntities(parameters);
    this._validator.validateMaxId(parameters);
    this._validator.validatePage(parameters);
    this._validator.validateSinceId(parameters);
    this._validator.validateTrimUser(parameters);

    this._createGetRequest('statuses/retweeted_to_me', this._format, parameters, callback);
};

/**
 * Retrieves the most recent retweets posted by users the specified user follows.
 * This method is identical to statusesRetweetedToMe except you can specify the user.
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/get/statuses/retweeted_to_user">Twitter documenation</a>.
 *
 * @this {RestClient}
 * @param {Dictionary} parameters
 * @param {Function} callback The callback function.
 */
RestClient.prototype.statusesRetweetedToUser = function(parameters, callback)
{
    this._validator.validateCount(parameters);
    this._validator.validateIncludeEntities(parameters);
    this._validator.validateMaxId(parameters);
    this._validator.validatePage(parameters);
    this._validator.validateScreenName(parameters);
    this._validator.validateSinceId(parameters);
    this._validator.validateTrimUser(parameters);
    this._validator.validateUserId(parameters);

    this._createGetRequest('statuses/retweeted_to_user', this._format, parameters, callback);
};

/**
 * Returns recent tweets by the authenticated user that have been retweeted by others.
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/get/statuses/retweets_of_me">Twitter documenation</a>.
 *
 * @this {RestClient}
 * @param {Dictionary} parameters
 * @param {Function} callback The callback function.
 */
RestClient.prototype.statusesRetweetsOfMe = function(parameters, callback)
{
    this._validator.validateCount(parameters);
    this._validator.validateIncludeEntities(parameters);
    this._validator.validateMaxId(parameters);
    this._validator.validatePage(parameters);
    this._validator.validateSinceId(parameters);
    this._validator.validateTrimUser(parameters);

    this._createGetRequest('statuses/retweets_of_me', this._format, parameters, callback);
};

/**
 *
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/get/statuses/user_timeline">Twitter documenation</a>.
 *
 * @this {RestClient}
 * @param {Dictionary} parameters
 * @param {Function} callback The callback function.
 */
RestClient.prototype.statusesUserTimeline = function(parameters, callback)
{
    this._validator.validateContributorDetails(parameters);
    this._validator.validateCount(parameters);
    this._validator.validateExcludeReplies(parameters);
    this._validator.validateIncludeEntities(parameters);
    this._validator.validateIncludeRetweets(parameters);
    this._validator.validateMaxId(parameters);
    this._validator.validatePage(parameters);
    this._validator.validateSinceId(parameters);
    this._validator.validateScreenName(parameters);
    this._validator.validateTrimUser(parameters);
    this._validator.validateUserId(parameters);

    this._createGetRequest('statuses/user_timeline', this._format, parameters, callback);
};

// Tweets

/**
 * Destroys the status specified by the id parameter if it is owned by the authenticated user.
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/post/statuses/destroy/%3Aid">Twitter documenation</a>.
 *
 * @this {RestClient}
 * @param {Dictionary} parameters
 * @param {Function} callback The callback function.
 */
RestClient.prototype.statusesDestroy = function(parameters, callback)
{
    var id = parameters['id'];
    if (id === undefined)
    {
        throw new Error('Missing required parameter: id.');
    }

    this._validator.validateId(parameters);
    this._validator.validateIncludeEntities(parameters);
    this._validator.validateTrimUser(parameters);

    var resource = 'statuses/destroy/' + id;

    // Remove the id key from the list of query parameters.
    delete(parameters['id']);

    this._createPostRequest(resource, this._format, parameters, callback);
};

/**
 * Retrieves information needed to embed a status on third party sites.
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/get/statuses/oembed">Twitter documenation</a>.
 *
 * @this {RestClient}
 * @param {Dictionary} parameters
 * @param {Function} callback The callback function.
 */
RestClient.prototype.statusesOEmbed = function(parameters, callback)
{
    var id = parameters['id'];
    if (id === undefined)
    {
        var url = parameters['url'];
        if (url === undefined)
        {
            throw new Error('Missing required parameter: id or url.');
        }
    }

    this._validator.validateId(parameters);
    this._validator.validateUrl(parameters);

    this._validator.validateAlign(parameters);
    this._validator.validateHideMedia(parameters);
    this._validator.validateHideThread(parameters);
    this._validator.validateLanguage(parameters);
    this._validator.validateMaxWidth(parameters);
    this._validator.validateOmitScript(parameters);
    this._validator.validateRelated(parameters);

    var resource = 'statuses/oembed';

    this._createGetRequest(resource, this._format, parameters, callback);
};

/**
 * Retweets the status associated with the specified id parameter.
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/post/statuses/retweet/%3Aid">Twitter documenation</a>.
 *
 * @this {RestClient}
 * @param {Dictionary} parameters
 * @param {Function} callback The callback function.
 */
RestClient.prototype.statusesRetweet = function(parameters, callback)
{
    var id = parameters['id'];
    if (id === undefined)
    {
        throw new Error('Missing required parameter: id.');
    }

    this._validator.validateId(parameters);
    this._validator.validateIncludeEntities(parameters);
    this._validator.validateCount(parameters);
    this._validator.validatePage(parameters);
    this._validator.validateTrimUser(parameters);

    var resource = 'statuses/retweet/' + id;

    // Remove the id key from the list of query parameters.
    delete(parameters['id']);

    this._createPostRequest(resource, this._format, parameters, callback);
};

/**
 * Retrieves the users who retweeted the status associated with the specified id parameter.
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/get/statuses/%3Aid/retweeted_by">Twitter documenation</a>.
 *
 * @this {RestClient}
 * @param {Dictionary} parameters
 * @param {Function} callback The callback function.
 */
RestClient.prototype.statusesRetweetedBy = function(parameters, callback)
{
    var id = parameters['id'];
    if (id === undefined)
    {
        throw new Error('Missing required parameter: id.');
    }

    this._validator.validateId(parameters);
    this._validator.validateCount(parameters);
    this._validator.validatePage(parameters);

    var resource = 'statuses/' + id + '/retweeted_by';

    // Remove the id key from the list of query parameters.
    delete(parameters['id']);

    this._createGetRequest(resource, this._format, parameters, callback);
};

/**
 * Retrieves the ids of the users who retweeted the status associated with the specified id parameter.
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/get/statuses/%3Aid/retweeted_by/ids">Twitter documenation</a>.
 *
 * @this {RestClient}
 * @param {Dictionary} parameters
 * @param {Function} callback The callback function.
 */
RestClient.prototype.statusesRetweetedByIds = function(parameters, callback)
{
    var id = parameters['id'];
    if (id === undefined)
    {
        throw new Error('Missing required parameter: id.');
    }

    this._validator.validateId(parameters);
    this._validator.validateCount(parameters);
    this._validator.validatePage(parameters);
    this._validator.validateStringifyIds(parameters);

    var resource = 'statuses/' + id + '/retweeted_by/ids';

    // Remove the id key from the list of query parameters.
    delete(parameters['id']);

    // To work around JavaScript's inability to handle large numbers 
    // indicate IDs should be returned as strings
    parameters['stringify_ids'] = true;

    this._createGetRequest(resource, this._format, parameters, callback);
};

/**
 * Retrieves the retweets of a given status.
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/get/statuses/retweets/%3Aid">Twitter documenation</a>.
 *
 * @this {RestClient}
 * @param {Dictionary} parameters
 * @param {Function} callback The callback function.
 */
RestClient.prototype.statusesRetweets = function(parameters, callback)
{
    var id = parameters['id'];
    if (id === undefined)
    {
        throw new Error('Missing required parameter: id.');
    }

    this._validator.validateId(parameters);
    this._validator.validateIncludeEntities(parameters);
    this._validator.validateCount(parameters);
    this._validator.validatePage(parameters);
    this._validator.validateTrimUser(parameters);

    var resource = 'statuses/retweets/' + id;

    // Remove the id key from the list of query parameters.
    delete(parameters['id']);

    this._createGetRequest(resource, this._format, parameters, callback);
};

/**
 * Retrieves the status associated with the specified id parameter.
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/get/statuses/show/%3Aid">Twitter documenation</a>.
 *
 * @this {RestClient}
 * @param {Dictionary} parameters
 * @param {Function} callback The callback function.
 */
RestClient.prototype.statusesShow = function(parameters, callback)
{
    var id = parameters['id'];
    if (id === undefined)
    {
        throw new Error('Missing required parameter: id.');
    }

    this._validator.validateId(parameters);
    this._validator.validateIncludeEntities(parameters);
    this._validator.validateTrimUser(parameters);

    var resource = 'statuses/show';

    this._createGetRequest(resource, this._format, parameters, callback);
};

/**
 * Posts a new status for the authenticated user.
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/post/statuses/update">Twitter documenation</a>.
 *
 * @this {RestClient}
 * @param {Dictionary} parameters
 * @param {Function} callback The callback function.
 * @return This method returns an integer.
 */
RestClient.prototype.statusesUpdate = function(parameters, callback)
{
    var status = parameters['status'];
    if (status === undefined)
    {
        throw new Error('Missing required parameter: status.');
    }

    this._validator.validateDisplayCoordinates(parameters);
    this._validator.validateIncludeEntities(parameters);
    this._validator.validateInReplyToStatusId(parameters);
    this._validator.validatePlaceId(parameters);
    this._validator.validateLatitude(parameters);
    this._validator.validateLongitude(parameters);
    this._validator.validateStatus(parameters);
    this._validator.validateTrimUser(parameters);

    var resource = 'statuses/update';

    this._createPostRequest(resource, this._format, parameters, callback);
};

/**
 * Posts a new status for the authenticated user and attaches media for upload.
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/post/statuses/update_with_media">Twitter documenation</a>.
 *
 * @this {RestClient}
 * @param {Dictionary} parameters
 * @param {Function} callback The callback function.
 */
RestClient.prototype.statusesUpdateWithMedia = function(parameters, callback)
{
    var uploadClient = new UploadClient(
        this._oauth.consumer_key,
        this._oauth.consumer_secret,
        this._oauth.token,
        this._oauth.token_secret
    );

    uploadClient.statusesUpdateWithMedia(parameters, callback);
};

// Users

/**
 * Return up to 100 users worth of extended information, specified by either ID, screen name, or combination of the two. 
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/get/users/lookup">Twitter documenation</a>.
 *
 * @this {RestClient}
 * @param parameters
 * @param callback The callback function.
 */
RestClient.prototype.usersLookup = function(parameters, callback)
{
    this._validator.validateIncludeEntities(parameters);
    this._validator.validateScreenName(parameters);
    this._validator.validateUserId(parameters);

    this._createGetRequest('users/lookup', this._format, parameters, callback);
}

module.exports = RestClient;
