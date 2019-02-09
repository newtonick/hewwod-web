const apn = require('apn');
const moment = require('moment-timezone');

var sleep = require('sleep');
sleep.sleep(5); //5 seconds delay for mongo setup

//Setup Mongoose
const mongoose = require('mongoose');
mongoose.set('useFindAndModify', false);
mongoose.connect('mongodb://hewwod-mongo:27017/hew', { useNewUrlParser: true } );

const DeviceSettingsSchema = new mongoose.Schema({uuid: String, token: String, notifications: Boolean, wod: Boolean, wodhour: Number, wodminute: Number, updated: Date})
const DeviceSettings = mongoose.model('DeviceSettings', DeviceSettingsSchema, 'DeviceSettings');

const APNDeviceSchema = new mongoose.Schema({token: String, env: String, active: Boolean, valid: Boolean, content: Boolean, status: String, updated: Date});
const APNDevice = mongoose.model('APNDevice', APNDeviceSchema, 'APNDevice');

const WorkoutSchema = new mongoose.Schema({date: Date, name: String, text: String, html: String, valid: Boolean, updated: Date}, { bufferCommands: false });
const Workout = mongoose.model('Workout', WorkoutSchema, 'Workout');

var apn_options = {
  token: {
    key: "/home/nklockenga/HEWWOD_AuthKey_HTUV39VAHV.p8",
    keyId: "HTUV39VAHV",
    teamId: "ZW85AH743B"
  },
  production: true
};

const apn_topic = "com.klockenga.hewwod";

setInterval(function(){

	const hour = moment().tz("America/New_York").format("HH");
	const minute = moment().tz("America/New_York").format("mm");

	console.log("Every Minute Loop ... Hour: " + hour + " Minute: " + minute);

	// Limit between 4 AM and 8PM
    if (hour >= 4 && hour <= 20) {
    	// Limit to 15 minute increments
    	if (minute == 0 || minute == 15 || minute == 30 || minute == 45)
    	{
    		console.log("Run WOD Notifications !!!")
    		run_wod_notifications(parseInt(hour), parseInt(minute));
    	}
    }

    //content updates
 //    var updated_60_sec_ago = moment().subtract(1, 'minutes').toDate();

	// Workout.find({valid: true, updated: { "$gte": updated_60_sec_ago }}, {name: 1, _id: 0}).sort({'updated': -1}).limit(1).exec(function(err,workouts){
	// 	if(err) return console.error(err);

	// 	if(workouts.length > 0) {
	// 		console.log("Workout Name: " + workouts[0].name);
	// 		run_content_notifications();
	// 	}
	// });

}, 1000 * 60) // Run Every Minute

function run_wod_notifications(hour, minute){

	var note = new apn.Notification();
	var provider = new apn.Provider(apn_options);

	note.topic = apn_topic
	note.expiry = Math.floor(Date.now() / 1000) + 21600; // Expires 6 hour from now.
	note.title = "\ud83c\udfcb\ufe0f See Today's Workout! \ud83c\udfcb\ufe0f";
	note.sound = "default"

	Workout.find({valid: true}, {name: 1, _id: 0}).sort({'date': -1}).limit(1).exec(function(err,workouts){
		if(err) return console.error(err);

		if(workouts[0].date) {
			const today = moment().tz("America/New_York").toDate();
			if(workouts[0].date.toDateString() != today.toDateString()) {
				console.log("No New Workout Today, Skipping Notifications");
				return;
			}
		}

		// setting notification body to WOD name for today
		note.body = workouts[0].name;

		console.log("Workout Name: " + note.body);

		console.log("WOD Hour: " + hour);
		console.log("WOD Minute: " + minute);

		// get device settings for those schedule to run at this hour / minute
		DeviceSettings.find({notifications: true, wod: true, wodesthour: hour, wodestminute: minute}, {token:1, _id:0}).exec(function(err, devices) {

			console.log("DeviceSettings Found: " + devices.length);
			console.log(devices);

			let tokens = devices.map(a => a.token);

			APNDevice.find({token: { $in: tokens}, active: true, valid: true},{token:1,_id:0}).exec(function(err,items){
				let apntokens = items.map(a => a.token);

				console.log("Tokens before apn send ...");
				console.log(apntokens);

				// send APN with token array

				if(apntokens.length > 0) {
					provider.send(note, apntokens).then( (results) => {
						console.log("Notes Sent Count:   " + results.sent.length);
						console.log("Notes Failed Count: " + results.failed.length);

						if(results.failed.length > 0) {
							results.failed.forEach(function(item) {
								//todo: mark device token as invalid
								console.log(item);
								if(item.status == "410") {
									APNDevice.updateOne(
										{token: item.device},
										{valid: false, updated: new Date(), status: "APN Status 410"},
										function (err, doc) { });
								}
							});
						}
					});
					provider.shutdown();
				}

			});

		});
	});

}

function run_content_notifications() {
	var note = new apn.Notification();
	var provider = new apn.Provider(apn_options);

	note.topic = apn_topic
	note.rawPayload = { aps: { "content-available": 1 } };

	APNDevice.find({active: true, valid: true},{token:1,_id:0}).exec(function(err,items){
		let apntokens = items.map(a => a.token);

		console.log("Tokens before apn send ...");
		console.log(apntokens);

		// send APN with token array

		if(apntokens.length > 0) {
			provider.send(note, apntokens).then( (results) => {
				console.log("Notes Sent Count:   " + results.sent.length);
				console.log("Notes Failed Count: " + results.failed.length);

				if(results.failed.length > 0) {
					results.failed.forEach(function(item) {
						//todo: mark device token as invalid
						console.log(item);
						if(item.status == "410") {
							APNDevice.updateOne(
								{token: item.device},
								{valid: false, updated: new Date(), status: "APN Status 410"},
								function (err, doc) { });
						}
					});
				}
			});
			provider.shutdown();
		}

	});
}