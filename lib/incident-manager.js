var
	stream = require('stream'),
	util = require('util'),
	TTLPool = require('ttl-pool')
	;

var DEFAULT_TTL = 60 * 1000; // 60 seconds

var IncidentManager = module.exports = function(options)
{
	this.ttl = options.ttl || DEFAULT_TTL;
	this.incidents = {};
	this._pool = new TTLPool(this._handleExpire.bind(this));
	stream.Duplex.call(this, { objectMode: true });
};
util.inherits(IncidentManager, stream.Duplex);

IncidentManager.DEFAULT_TTL = DEFAULT_TTL;

IncidentManager.prototype._write = function(event, encoding, callback)
{
	// Construct a unique incident ID.
	var id = event.id || event.host + '.' + event.name;
	// If we have a TTL for the event, make the incident TTL double of the
	// event TTL, if not, use the default TTL.
	var ttl = event.ttl ? event.ttl * 2 : this.ttl;

	if (event.status !== 'ok') this._pool.add(id, ttl);

	if (this.incidents[id])
	{
		if (event.status === 'ok')
		{
			// `_handleExpire` will take care of pushing the `ok` event through.
			this._pool.expire(id);
			return callback();
		}
		this._pool.ping(id, ttl);
	}
	else
	{
		if (event.status === 'ok') return callback();
		event.id = id;
		this.incidents[id] = event;
		this.push(event);
	}
	callback();
};

IncidentManager.prototype._handleExpire = function(id)
{
	var incident = this.incidents[id];
	incident.status = 'ok';
	incident.id = id;
	this.push(incident);
	delete this.incidents[id];
};

IncidentManager.prototype._read = function() {};
