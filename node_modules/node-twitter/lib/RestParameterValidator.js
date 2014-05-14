var fs = require('fs');
var path = require('path');
var Util = require('util');

// Support node.js 0.8.0 while maintaing backwards compatibility with
// previous versions.
fs.exists || (fs.exists = path.exists);
fs.existsSync || (fs.existsSync = path.existsSync);

/**
 * Creates an instance of RestParameterValidator.
 *
 * @constructor
 * @this {RestParameterValidator}
 */
var RestParameterValidator = function()
{
    Object.call(this);
};

Util.inherits(RestParameterValidator, Object);

RestParameterValidator.prototype.validateAlign = function(parameters)
{
    var type = 'string';
    var align = parameters['align'];
    if (align !== undefined && typeof align !== type)
    {
        throw new Error('Expected ' + type + '.');
    }
};

RestParameterValidator.prototype.validateContributorDetails = function(parameters)
{
	var contributorDetails = parameters['contributor_details'];
    if (contributorDetails !== undefined && typeof contributorDetails !== 'boolean')
    {
        throw new Error('Expected boolean.');
    }
};

RestParameterValidator.prototype.validateCount = function(parameters)
{
    var count = parameters['count'];
    if (count !== undefined && typeof count !== 'number')
    {
        throw new Error('Expected number.');
    }
};

RestParameterValidator.prototype.validateDisplayCoordinates = function(parameters)
{
    var type = 'boolean';
    var displayCoordinates = parameters['display_coordinates'];
    if (displayCoordinates !== undefined && typeof displayCoordinates !== type)
    {
        throw new Error('Expected ' + type + '.');
    }
};

RestParameterValidator.prototype.validateExcludeReplies = function(parameters)
{
    var excludeReplies = parameters['exclude_replies'];
    if (excludeReplies !== undefined && typeof excludeReplies !== 'boolean')
    {
        throw new Error('Expected boolean.');
    }
};

RestParameterValidator.prototype.validateId = function(parameters)
{
    var type = 'string';
    var statusId = parameters['id'];
    if (statusId !== undefined && typeof statusId !== type)
    {
        throw new Error('Expected ' + type + '.');
    }
};

RestParameterValidator.prototype.validateIncludeEntities = function(parameters)
{
    var includeEntities = parameters['include_entities'];
    if (includeEntities !== undefined && typeof includeEntities !== 'boolean')
    {
        throw new Error('Expected boolean.');
    }
};

RestParameterValidator.prototype.validateIncludeRetweets = function(parameters)
{
    var includeRetweets = parameters['include_rts'];
    if (includeRetweets !== undefined && typeof includeRetweets !== 'boolean')
    {
        throw new Error('Expected boolean.');
    }
};

RestParameterValidator.prototype.validateInReplyToStatusId = function(parameters)
{
    var type = 'string';
    var inReplyToStatusId = parameters['in_reply_to_status_id'];
    if (inReplyToStatusId !== undefined && typeof inReplyToStatusId !== type)
    {
        throw new Error('Expected ' + type + '.');
    }
};

RestParameterValidator.prototype.validateHideMedia = function(parameters)
{
    var type = 'boolean';
    var hideMedia = parameters['hide_media'];
    if (hideMedia !== undefined && typeof hideMedia !== type)
    {
        throw new Error('Expected ' + type + '.');
    }
};

RestParameterValidator.prototype.validateHideThread = function(parameters)
{
    var type = 'boolean';
    var hideThread = parameters['hide_thread'];
    if (hideThread !== undefined && typeof hideThread !== type)
    {
        throw new Error('Expected ' + type + '.');
    }
};

RestParameterValidator.prototype.validateMaxId = function(parameters)
{
    var maxId = parameters['max_id'];
    if (maxId !== undefined && typeof maxId !== 'number')
    {
        throw new Error('Expected number.');
    }
};

RestParameterValidator.prototype.validateMaxWidth = function(parameters)
{
    var type = 'number';
    var maxWidth = parameters['maxwidth'];
    if (maxWidth !== undefined && typeof maxWidth !== type)
    {
        throw new Error('Expected ' + type+ '.');
    }
};

RestParameterValidator.prototype.validateLanguage = function(parameters)
{
    var type = 'string';
    var language = parameters['lang'];
    if (language !== undefined && typeof language !== type)
    {
        throw new Error('Expected ' + type + '.');
    }
};

RestParameterValidator.prototype.validateLatitude = function(parameters)
{
    var type = 'number';
    var latitude = parameters['lat'];
    if (latitude !== undefined && typeof latitude !== type)
    {
        throw new Error('Expected ' + type + '.');
    }
};

RestParameterValidator.prototype.validateLongitude = function(parameters)
{
    var type = 'number';
    var longitude = parameters['long'];
    if (longitude !== undefined && typeof longitude !== type)
    {
        throw new Error('Expected ' + type + '.');
    }
};

RestParameterValidator.prototype.validateOmitScript = function(parameters)
{
    var type = 'boolean';
    var omitScript = parameters['omit_script'];
    if (omitScript !== undefined && typeof omitScript !== type)
    {
        throw new Error('Expected ' + type + '.');
    }
};

RestParameterValidator.prototype.validatePage = function(parameters)
{
    var page = parameters['page'];
    if (page !== undefined && typeof page !== 'number')
    {
        throw new Error('Expected number.');
    }
};

RestParameterValidator.prototype.validatePlaceId = function(parameters)
{
    var type = 'string';
    var placeId = parameters['place_id'];
    if (placeId !== undefined && typeof placeId !== type)
    {
        throw new Error('Expected ' + type + '.');
    }
};

RestParameterValidator.prototype.validatePossiblySensitive = function(parameters)
{
    var type = 'boolean';
    var possiblySensitive = parameters['possibly_sensitive'];
    if (possiblySensitive !== undefined && typeof possiblySensitive !== type)
    {
        throw new Error('Expected ' + type + '.');
    }
};

RestParameterValidator.prototype.validateMedia = function(parameters)
{
    var type = 'string';
    var media = parameters['media[]'];
    if (media !== undefined && typeof media !== type)
    {
        throw new Error('Expected ' + type + '.');
    }

    media = path.normalize(media);
    if (fs.existsSync(media) === false)
    {
        throw new Error('File path does not exist: ' + media);
    }
};

RestParameterValidator.prototype.validateRelated = function(parameters)
{
    var type = 'string';
    var related = parameters['related'];
    if (related !== undefined && typeof related !== type)
    {
        throw new Error('Expected ' + type + '.');
    }
};

RestParameterValidator.prototype.validateSinceId = function(parameters)
{
    var sinceId = parameters['since_id'];
    if (sinceId !== undefined && typeof sinceId !== 'number')
    {
        throw new Error('Expected number.');
    }
};

RestParameterValidator.prototype.validateScreenName = function(parameters)
{
    var screenName = parameters['screen_name'];
    if (screenName !== undefined && typeof screenName !== 'string')
    {
        throw new Error('Expected boolean.');
    }
};

RestParameterValidator.prototype.validateStatus = function(parameters)
{
    var type = 'string';
    var status = parameters['status'];
    if (status !== undefined && typeof status !== type)
    {
        throw new Error('Expected ' + type + '.');
    }
};

RestParameterValidator.prototype.validateSkipStatus = function(parameters)
{
    var type = 'boolean';
    var skipStatus = parameters['skip_status'];
    if (skipStatus !== undefined && typeof skipStatus !== type)
    {
        throw new Error('Expected ' + type + '.');
    }
};

RestParameterValidator.prototype.validateStringifyIds = function(parameters)
{
    var type = 'boolean';
    var statusId = parameters['stringify_ids'];
    if (statusId !== undefined && typeof statusId !== type)
    {
        throw new Error('Expected ' + type + '.');
    }
};

RestParameterValidator.prototype.validateText = function(parameters)
{
    var text = parameters['text'];
    if (typeof text !== 'string')
    {
        throw new Error('Expected string.');
    }
};

RestParameterValidator.prototype.validateTrimUser = function(parameters)
{
    var trimUser = parameters['trim_user'];
    if (trimUser !== undefined && typeof trimUser !== 'boolean')
    {
        throw new Error('Expected boolean.');
    }
};

RestParameterValidator.prototype.validateUrl = function(parameters)
{
    var type = 'string';
    var url = parameters['url'];
    if (url !== undefined && typeof url !== type)
    {
        throw new Error('Expected ' + type + '.');
    }
};

RestParameterValidator.prototype.validateUserId = function(parameters)
{
    var userId = parameters['user_id'];
    var types = {'number': true, 'string': true};
    if (userId !== undefined && types[(typeof userId)] === false)
    {
        throw new Error('Expected number.');
    }
};

module.exports = RestParameterValidator;
