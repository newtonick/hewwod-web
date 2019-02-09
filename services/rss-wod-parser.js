//Get Config
var config = require('./config/config');

const Parser = require('rss-parser');
const striptags = require('striptags');
const he = require('he');
const moment = require('moment-timezone')
const apn = require('apn');

let parser = new Parser();

var sleep = require('sleep');
sleep.sleep(5); //5 seconds delay for mongo setup

//Setup Mongoose
const mongoose = require('mongoose');
mongoose.set('useFindAndModify', false);

//Setup Schema
const WorkoutSchema = new mongoose.Schema({date: Date, name: String, text: String, html: String, valid: Boolean, updated: Date}, { bufferCommands: false });
const Workout = mongoose.model('Workout', WorkoutSchema, 'Workout');

let inserts = false;
let loop_cnt = 0;

mongoose.connect(config.db, { useNewUrlParser: true } );

function fetchAndParse() {

	let name, text, html;

	(async () => {
	 
		let feed = await parser.parseURL(config.rss);

		feed.items.forEach(item => {

			name = item.title.replace(/:/g,"").toUpperCase();
			html = item.content;

			// strip all tags that are not span, string, br, or p
			text = striptags(html, ["span", "strong", "br", "p"]);

			// replace all br tags with @@@@ (later for newline)
			text = striptags(text, ["span", "strong", "p"], "@@@@");

			// replace the closing p tag with @@@@ (later for newline)
			text = text.replace(/<\/p>/g, "@@@@");

			// strip all tags keeping only span and strong
			text = striptags(text, ["span", "strong"]);

			// strip out strong (keeping span) and replace strong with **
			text = striptags(text, ["span"], "**");

			// find a replace span with underline tags with __
			text = text.replace(/(\<span style\=\"text-decoration: underline;\"\>)(.*?)\<\/span\>/g, "__$2__");

			//makings sure any remaining html tags are completely gone
			text = striptags(text, []);

			// removing any trailing (extra) spaces
			text = text.replace(/\ @@@@/g, "@@@@");
			text = text.replace(/\ __/g, "__");
			text = text.replace(/\ \*\*/g, "**");

			//replacing all @@@@ with line breaks
			text = text.replace(/@@@@/g, "\n")

			//decode and trim
			text = he.decode(text).trim();

			workout = new Workout({date: item.pubDate, name: name, text: text, html: html, valid: true, updated: new Date()});

			loop_cnt += 1;

			Workout.findOneAndUpdate(
				{date: item.pubDate, name: name},
				workout,
				{upsert: true, new: true, runValidators: true},
				function (err, doc) { // callback
				if (err) {
					console.log("no insert");
				} else {
					console.log("success insert");
					contentNotification();
					inserts = true;
				}
				loop_cnt -= 1
			});

			console.log("Loop Count: " + loop_cnt);
		});
	 
	})();
}

fetchAndParse() // run immediately
setInterval(function(){

	const hour = moment().tz("America/New_York").format("HH");
	const minute = moment().tz("America/New_York").format("mm");

	console.log("Every 5 Minute Loop ... Hour: " + hour + " Minute: " + minute);

	// Every 5 minutes on the 4th hour
    if (hour == 4) {
    	fetchAndParse();
    }
    else if(minute >= 0 && minute < 5) {
    	fetchAndParse();
    }

}, 5 * 60 * 1000); //every 5 minutes


var apn_options = {
  token: {
    key: config.apn.key,
    keyId: config.apn.keyId,
    teamId: config.apn.teamId
  },
  production: true
};

const apn_topic = config.apn.topic;

const APNDeviceSchema = new mongoose.Schema({token: String, env: String, active: Boolean, valid: Boolean, content: Boolean, status: String, updated: Date});
const APNDevice = mongoose.model('APNDevice', APNDeviceSchema, 'APNDevice');

function contentNotification() {

	var note = new apn.Notification();
	var provider = new apn.Provider(apn_options);

	note.topic = apn_topic

	note.rawPayload = {
		aps: {
			"content-available": 1
		}
	}

	APNDevice.find({valid: true, active: true, env: "production"}, {token: 1, _id: 0}).exec(function(err,items){
		if(err) return console.error(err);

		let apntokens = items.map(a => a.token);

		console.log("Tokens before apn send ...");
		console.log(apntokens);

		if(apntokens.length > 0) {
			var Xseconds = 1;
			while(apntokens.length) {
				Xseconds += 1;
				let part_of_apntokens = apntokens.splice(0,5);

				console.log("while looping");
				setTimeout(function(){
					console.log("running pushArray");
					pushArray(part_of_apntokens, provider, note)
				}, Xseconds * 1000)
			}

			Xseconds += 5;

			setTimeout(function(){
				console.log("shutdown");
				provider.shutdown();
			}, Xseconds * 1000)
		}

	});

}

function pushArray(tokens, provider, note) {
	console.log(tokens);
	provider.send(note, tokens).then( (results) => {
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
}