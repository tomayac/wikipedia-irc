var Crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var Util = require('util');
var Client = require('./Client');
var Constants = require('./Constants');
var RestParameterValidator = require('./RestParameterValidator');
var request = require('request');

/**
 * Creates an instance of UploadClient.
 *
 * @constructor
 * @this {UploadClient}
 * @param {String} consumerKey OAuth consumer key.
 * @param {String} consumerSecret OAuth consumer secret.
 * @param {String} token OAuth token.
 * @param {String} tokenSecret OAuth token secret.
 */
var UploadClient = function(consumerKey, consumerSecret, token, tokenSecret)
{
    Client.call(this, consumerKey, consumerSecret, token, tokenSecret);

    this._apiBaseUrlString = Constants.UploadApiBaseURLString;
    this._apiVersion = Constants.UploadApiVersion;
    this._validator = new RestParameterValidator();
};

Util.inherits(UploadClient, Client);

/**
 *
 *
 * For information on acceptable parameters see the official <a href="https://dev.twitter.com/docs/api/1/post/statuses/update_with_media">Twitter documenation</a>.
 *
 * @this {UploadClient}
 * @param {Dictionary} parameters
 * @param {Function} callback The callback function.
 */
UploadClient.prototype.statusesUpdateWithMedia = function(parameters, callback)
{
    var status = parameters['status'];
    if (status === undefined)
    {
        throw new Error('Missing required parameter: status.');
    }

    var media = parameters['media[]'];
    if (media === undefined)
    {
        throw new Error('Missing required parameter: media[].');
    }

    this._validator.validateDisplayCoordinates(parameters);
    this._validator.validateInReplyToStatusId(parameters);
    this._validator.validatePlaceId(parameters);
    this._validator.validatePossiblySensitive(parameters);
    this._validator.validateLatitude(parameters);
    this._validator.validateLongitude(parameters);
    this._validator.validateMedia(parameters);
    this._validator.validateStatus(parameters);

    var resource = 'statuses/update_with_media';

    this._createPostRequest(resource, 'json', parameters, callback);
};

/**
 * Creates an HTTP POST request.
 *
 * @private
 * @this {Client}
 * @param {String} resource The Twitter API resource to call.
 * @param {String} format The format in which to return data.
 * @param {Dictionary} parameters Parameters required to access the resource.
 * @param {Function} callback The callback function.
 */
UploadClient.prototype._createPostRequest = function(resource, format, parameters, callback)
{
	var MEDIA_KEY = 'media[]';

	// Multipart data for non-media parameters
    var multipartItems = Object.keys(parameters).filter(function (key) {
		return key != MEDIA_KEY;
	}).map(function (key) {
		return {
			'content-disposition': 'form-data; name="' + key + '"',
			'content-type': 'text/plain',
			'body': parameters[key]
		};
	});

	// Multipart data for media[]
    var mediaFilePath = path.normalize(parameters[MEDIA_KEY]);
    var mediaFileExtensionName = path.extname(mediaFilePath);
    var mimeType = this._mimeTypeForPathExtension(mediaFileExtensionName);
    if (mimeType === null)
    {
        throw new Error('Unsupported media type.');
    }
	var multipartItem = {
		'content-disposition': 'form-data; name="' + MEDIA_KEY + '"',
		'content-type': mimeType,
		'content-transfer-encoding': 'utf8',
		'body': null
	};
	multipartItems.push(multipartItem);

	// Prepare request options
    var requestUrlString = this._apiBaseUrlString + '/' + this._apiVersion +
		'/' + resource + '.' + format;
    var requestOptions = {
        headers: { 'content-type': 'multipart/form-data' },
        method: 'POST',
        url: requestUrlString,
        oauth: this.oauth(),
        multipart: multipartItems
    };

	// Asynchronously read the media file and post the request
    var self = this;
	fs.readFile(mediaFilePath, function (err, data) {
		if (err) {
			throw err;
		} else {
			multipartItem.body = data;
		}

		var httpRequest = request.post(requestOptions);
		httpRequest.hash = Crypto.createHash('sha1').update(
			JSON.stringify(httpRequest.headers), 'utf8'
		).digest('hex');
		self._connections[httpRequest.hash] = {
			callback: callback, data: '', httpRequest: httpRequest
		};

		self._createEventListenersForRequest(httpRequest);
	});
};

UploadClient.prototype._mimeTypeForPathExtension = function(pathExtension)
{
    var mimeType = null;

    switch(pathExtension.toLowerCase())
    {
        case '.gif':
            mimeType = 'image/gif';
            break;
        case '.jpeg':
        case '.jpg':
            mimeType = 'image/jpeg';
            break;
        case '.png':
            mimeType = 'image/png';
            break;
    }

    return mimeType;
};

module.exports = UploadClient;
