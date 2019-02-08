//Setup Express and App
const express = require('express');
const app = express();
const port = 3001;

//config Express App
app.disable('x-powered-by');

//Setup Mongoose
const mongoose = require('mongoose');
mongoose.set('useFindAndModify', false);
mongoose.connect('mongodb://hewwod-mongo:27017/hew', { useNewUrlParser: true } );

//Setup Schema
const WorkoutSchema = new mongoose.Schema({date: Date, name: String, text: String, html: String, valid: Boolean, updated: Date});
const Workout = mongoose.model('Workout', WorkoutSchema, 'Workout');

const APNDeviceSchema = new mongoose.Schema({token: String, env: String, active: Boolean, valid: Boolean, content: Boolean, status: String, updated: Date});
const APNDevice = mongoose.model('APNDevice', APNDeviceSchema, 'APNDevice');

const DeviceSettingsSchema = new mongoose.Schema({uuid: String, token: String, notifications: Boolean, wod: Boolean, wodhour: Number, wodminute: Number, wodesthour: Number, wodestminute: Number, timezone: String, updated: Date})
const DeviceSettings = mongoose.model('DeviceSettings', DeviceSettingsSchema, 'DeviceSettings');

let workout_cache_expires = 1 * 30 * 1000; // 30 Seconds
let workout_cache_content;
let workout_cache_date = new Date();

const moment = require('moment-timezone');

//API Routes
app.get('/api/1.0/workouts', function(req, res) {
	//caching workouts
	if(workout_cache_content && (new Date() - workout_cache_date) < workout_cache_expires) {
		//console.log("cached workouts returned");
		return res.json(workout_cache_content);
	}

	//get workouts from db
	Workout.find({valid: true}, {name: 1, text: 1, date: 1, updated: 1, _id: 1}).sort({'date': -1}).limit(10).exec(function(err,Workouts){
		if(err) return console.error(err);
		//console.log("workouts returned");

		workout_cache_content = { status: "success", workouts: Workouts, cached: true };
		workout_cache_date = new Date();

		return res.json({ status: "success", workouts: Workouts, cached: false });
	});
});

//API Routes
app.get('/api/1.0/workout', function(req, res) {
	//get single latest workout from db
	Workout.find({valid: true}, {name: 1, text: 1, date: 1, updated: 1, _id: 1}).sort({'date': -1}).limit(1).exec(function(err,workouts){
		if(err) return console.error(err);
		console.log("latest workout returned");
		return res.json({ status: "success", workout: workouts[0], cached: false });
	});
});

app.get('/api/1.0/device/add', function(req, res) {
	//add device token to mongodb, need a schema

	if (typeof req.query.token === 'undefined') {
		console.log("token query not found");
		res.json({status: "token parameter in query not found"});
		return;
	}

	let env = 'production'

	if (typeof req.query.env === 'undefined') {
		console.log("env query not found");
	} else {
		env = req.query.env
	}

	let token = req.query.token;
	
	device = new APNDevice({token: token, env: env, active: true, valid: true, content: true, status: "Register", updated: new Date()});

	APNDevice.findOneAndUpdate(
		{token: token, env: env},
		device,
		{upsert: true, new: true, runValidators: true},
		function (err, doc) { // callback
		if (err) {
			console.log("device no insert needed");
			return res.json({status: "device token not added"});
		} else {
			console.log("device insert success");
			return res.json({status: "device token added"});
		}
	});
});

app.get('/api/1.0/device/settings', function(req, res) {
	if (typeof req.query.uuid === 'undefined') {
		console.log("uuid query not found");
		res.json({status: "uuid parameter in query not found"});
		return;
	}

	let uuid = req.query.uuid;
	let token = req.query.token;
	let noti = req.query.noti;
	let wod = req.query.wod;
	let wodhour = req.query.wodhour;
	let wodminute = req.query.wodminute;
	var timezone = req.query.timezone;

	if(!timezone) {
		timezone = "America/New_York" //defaults to EST/EDT
	}

	var woddatemoment = moment().tz(timezone);

	console.log(woddatemoment)

	woddatemoment.set({
		hour: wodhour,
		minute: wodminute
	});

	console.log(woddatemoment);

	const wodesthour = parseInt(woddatemoment.tz("America/New_York").format("HH"));
	const wodestminute = parseInt(woddatemoment.tz("America/New_York").format("mm"));

	console.log(wodesthour);
	console.log(wodestminute);

	let settings = {uuid: uuid, token: token, notifications: noti, wod: wod, wodhour: wodhour, wodminute: wodminute, wodesthour: wodesthour, wodestminute: wodestminute, timezone: timezone, updated: new Date()};

	DeviceSettings.findOneAndUpdate(
		{uuid: uuid},
		settings,
		{upsert: true, new: true, runValidators: true},
		function(err, doc) {
			if (err) {
				console.log("error: settings not saved");
				console.log(err);
				res.json({status: "error: settings not saved"});
			} else {
				console.log("settings saved");
				return res.json({status: "settings saved"});
			}
	});
});

app.get('/api/1.0/device/inactivate', function(req, res) {

	if (typeof req.query.token === 'undefined') {
		console.log("token query not found");
		res.json({status: "token parameter in query not found"});
		return;
	}

	let env = 'production'

	if (typeof req.query.env === 'undefined') {
		console.log("env query not found");
	} else {
		env = req.query.env
	}

	let token = req.query.token;

	//device = new APNDevice({token: token, env: env, active: false, valid: true, status: "Inactive", updated: new Date()});

	APNDevice.updateOne(
		{token: token, env: env, active: true},
		{active: false, updated: new Date(), status: "Inactivated"},
		function (err, doc) { // callback
		if (err) {
			res.json({status: "error: device token not inactivated"});
		} else if(doc.n > 0) {
			res.json({status: "device token inactivated"});
		} else {
			res.json({status: "device token not modified or found"});
		}
	});
});

app.get('/api/1.0/device/activate', function(req, res) {

	if (typeof req.query.token === 'undefined') {
		console.log("token query not found");
		res.json({status: "token parameter in query not found"});
		return;
	}

	let env = 'production'

	if (typeof req.query.env === 'undefined') {
		console.log("env query not found");
	} else {
		env = req.query.env
	}

	let token = req.query.token;

	//device = new APNDevice({token: token, env: env, active: true, valid: true, status: "Activate", updated: new Date()});

	APNDevice.updateOne(
		{token: token, env: env, active: false},
		{active: true, valid: true, updated: new Date(), status: "Activated"},
		function (err, doc) { // callback
		if (err) {
			res.json({status: "error: device token not activated"});
		} else if(doc.n > 0) {
			res.json({status: "device token activated"});
		} else {
			res.json({status: "device token not modified or found"});
		}
	});
});

app.get('/api/1.0/device/remove', function(req, res) {
	if (typeof req.query.token === 'undefined') {
		console.log("token query not found");
		res.json({status: "token parameter in query not found"});
		return;
	}

	let env = 'production'

	if (typeof req.query.env === 'undefined') {
		console.log("env query not found");
	} else {
		env = req.query.env
	}

	let token = req.query.token;

	APNDevice.deleteOne({token: token, env: env}, function (err, doc) { // callback
		if (err) {
			console.log("device token not removed");
			res.json({status: "device token not removed"});
		} else {
			console.log("device token removed");
			res.json({status: "device token removed"});
		}
	});
});

//Setup Listener (Server)
app.listen(port, function(req, res) {
	console.log(`HEW API listening on port ${port}!`);
});