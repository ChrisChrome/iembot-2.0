// Requires
const fs = require("fs");
const config = require("./config.json");
const wfos = require("./data/wfos.json");
const blacklist = require("./data/blacklist.json");
const events = require("./data/events.json");
const outlookURLs = require("./data/outlook.json");
const sattelites = require("./data/sattelites.json");
const Jimp = require("jimp");
const { client, xml } = require("@xmpp/client");
const fetch = require("node-fetch");
const html = require("html-entities")
const Discord = require("discord.js");
const dVC = require("@discordjs/voice");
const colors = require("colors");
const sqlite3 = require("sqlite3").verbose();
// Setup Discord
const discord = new Discord.Client({
	intents: [
		"Guilds",
		"GuildVoiceStates",
		"DirectMessages"
	]
});
const {
	REST,
	Routes
} = require('discord.js');
const rest = new REST({
	version: '10'
}).setToken(config.discord.token);

// Setup SQlite DB
const db = new sqlite3.Database("channels.db", (err) => {
	if (err) {
		console.log(`${colors.red("[ERROR]")} Error connecting to database: ${err.message}`);
	}
	console.log(`${colors.cyan("[INFO]")} Connected to the database`);
	// Create tables if they dont exist
	db.run(`CREATE TABLE IF NOT EXISTS channels (channelid TEXT, iemchannel TEXT, custommessage TEXT, minPriority INTEGER, "filter" TEXT, filterevt TEXT);`);
	db.run(`CREATE TABLE IF NOT EXISTS userAlerts (userid TEXT, iemchannel TEXT, filter TEXT, filterEvt TEXT, minPriority INT, custommessage TEXT);`);
});


// Random funcs
function toTitleCase(str) {
	return str.replace(
		/\w\S*/g,
		function (txt) {
			return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
		}
	);
}

const parseProductID = function (product_id) {
	const [timestamp, station, wmo, pil] = product_id.split("-");
	return {
		timestamp: convertDate(timestamp),
		originalTimestamp: timestamp,
		station,
		wmo,
		pil
	};
}

// Convert date format 202405080131 (YYYYMMddHHmm) to iso format, hours and mins is UTC
const convertDate = function (date) {
	const year = date.substring(0, 4);
	const month = date.substring(4, 6);
	const day = date.substring(6, 8);
	const hours = date.substring(8, 10);
	const mins = date.substring(10, 12);
	// Because they don't have seconds, assume current seconds
	const secs = new Date().getSeconds();
	return new Date(Date.UTC(year, month - 1, day, hours, mins, secs));
}

// Get number of unique channels in the database
const getUniqueChannels = function () {
	return new Promise((resolve, reject) => {
		db.all(`SELECT DISTINCT channelid FROM channels`, (err, rows) => {
			if (err) {
				console.error(err.message);
			}
			resolve(rows.length);
		});
	});
}

// Get first url in a string, return object {string, url} remove the url from the string
const getFirstURL = function (string) {
	const url = string.match(/(https?:\/\/[^\s]+)/g);
	if (!url) return { string, url: null };
	const newString = string.replace(url[0], "");
	return { string: newString, url: url[0] };
}

// Function to get the room name from the WFO code
const getWFOroom = function (code) {
	code = code.toLowerCase();
	if (wfos[code]) {
		return wfos[code].room;
	} else {
		return code;
	}
}

// Function to get WFO data
const getWFO = function (code) {
	code = code.toLowerCase();
	if (wfos[code]) {
		return wfos[code];
	} else {
		return null;
	}
}

// Get WFO data from room name

function getWFOByRoom(room) {
	room = room.toLowerCase();
	for (const key in wfos) {
		if (wfos.hasOwnProperty(key) && wfos[key].room === room) {
			return wfos[key];
		}
	}
	return {
		location: room,
		room: room
	};
}

// Voice funcs
function JoinChannel(channel, track, volume, message) {
	connection = dVC.joinVoiceChannel({
		channelId: channel.id,
		guildId: channel.guild.id,
		adapterCreator: channel.guild.voiceAdapterCreator,
		selfDeaf: true
	});


	resource = dVC.createAudioResource(track, { inlineVolume: true, silencePaddingFrames: 5 });
	player = dVC.createAudioPlayer();
	connection.player = player; // So we can access it later to pause/play/stop etc
	resource.volume.setVolume(volume);
	connection.subscribe(player)
	player.play(resource);
	connection.on(dVC.VoiceConnectionStatus.Ready, () => { player.play(resource); })
	connection.on(dVC.VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
		try {
			await Promise.race([
				dVC.entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
				dVC.entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
			]);
		} catch (error) {
			message.channel.send(`Failed to reconnect to the voice channel. Stopping for now.`);
			connection.destroy();
			return false;
		}
	});
	player.on('error', error => {
		console.error(`Error: ${error.message} with resource ${error.resource.metadata.title}`);
		message.channel.send(`Error while streaming. Stopping for now.`);
		player.stop();
	});
	player.on(dVC.AudioPlayerStatus.Playing, () => {
		message.channel.send(`Playing stream in <#${channel.id}>`);
		connection.paused = false;
	});
	player.on('idle', () => {
		message.channel.send(`Stream idle.`);
	})
	return true;
}

function LeaveVoiceChannel(channel) {
	// Get resource, player, etc, and destroy them
	const connection = dVC.getVoiceConnection(channel.guild.id);
	if (connection) {
		connection.destroy();
		return true
	}
	return false
}

function toggleVoicePause(channel) {
	const connection = dVC.getVoiceConnection(channel.guild.id);
	if (connection) {
		if (connection.paused) {
			connection.player.unpause();
			connection.paused = false;
			return true;
		}
		else {
			connection.player.pause();
			connection.paused = true;
			return true
		}
	}
	else {
		return false;
	}
};

function setVolume(channel, volume) {
	const connection = dVC.getVoiceConnection(channel.guild.id);
	if (connection) {
		connection.player.state.resource.volume.setVolume(volume);
		return true;
	}
}

// func to Generate random string, ({upper, lower, number, special}, length)

const generateRandomString = function (options, length) {
	let result = '';
	const characters = {
		upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
		lower: 'abcdefghijklmnopqrstuvwxyz',
		number: '0123456789',
		special: '!@#$%^&*()_+'
	};
	let chars = '';
	for (const key in options) {
		if (options[key]) {
			chars += characters[key];
		}
	}
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

// Func to generate UUID
const generateUUID = function () {
	return generateRandomString({ lower: true, upper: true, number: true }, 8) + "-" + generateRandomString({ lower: true, upper: true, number: true }, 4) + "-" + generateRandomString({ lower: true, upper: true, number: true }, 4) + "-" + generateRandomString({ lower: true, upper: true, number: true }, 4) + "-" + generateRandomString({ lower: true, upper: true, number: true }, 12);
}

// Variable setup
var iem = []
var startup = true;
var startTimestap = new Date();
var messages = 0;
var errCount = 0;
const curUUID = generateUUID();


const xmpp = client({
	service: "xmpp://conference.weather.im",
	domain: "weather.im",
	resource: `discord-weather-bot-${generateRandomString({ upper: true, lower: true, number: true }, 5)}`, // Weird fix to "Username already in use"
});

//debug(xmpp, true);

xmpp.on("error", (err) => {
	console.log(`${colors.red("[ERROR]")} XMPP Error: ${err}. Trying to reconnect...`);
	setTimeout(() => {
		xmpp.stop().then(() => {
			start();
		});
	}, 5000);
});

xmpp.on("offline", () => {
	console.log(`${colors.yellow("[WARN]")} XMPP offline, trying to reconnect...`);
	xmpp.disconnect().then(() => {
		xmpp.stop().then(() => {
			start();
		})
	})
});

xmpp.on("stanza", (stanza) => {
	// Debug stuff
	if (config.debug >= 2) console.log(`${colors.magenta("[DEBUG]")} Stanza: ${stanza.toString()}`);


	// Handle Room List
	if (stanza.is("iq") && stanza.attrs.type === "result" && stanza.getChild("query")) {
		query = stanza.getChild("query");
		if (query.attrs.xmlns === "http://jabber.org/protocol/disco#items") {
			query.getChildren("item").forEach((item) => {
				// Check if the JID is on the blacklist, if so, ignore it
				if (blacklist.includes(item.attrs.jid)) return;
				// get proper name from wfos
				const wfo = getWFOByRoom(item.attrs.jid.split("@")[0]);
				item.attrs.properName = wfo.location;
				iem.push(item.attrs);
				console.log(`${colors.cyan("[INFO]")} Found room: ${item.attrs.jid}`);
				// Join the room
				//xmpp.send(xml("presence", { to: `${channel.jid}/${channel.name}/${curUUID}` }, xml("item", { role: "visitor" })));
				xmpp.send(xml("presence", { to: `${item.attrs.jid}/${curUUID}` }, xml("item", { role: "visitor" })));
			});
		}
	}
	// Get new messages and log them, ignore old messages
	if (stanza.is("message") && stanza.attrs.type === "groupchat") {
		// Stops spam from getting old messages
		if (startup) return;
		// Get channel name
		fromChannel = stanza.attrs.from.split("@")[0];
		// Ignores
		if (!stanza.getChild("x")) return; // No PID, ignore it
		if (!stanza.getChild("x").attrs.product_id) return;

		const product_id = parseProductID(stanza.getChild("x").attrs.product_id);
		const product_id_raw = stanza.getChild("x").attrs.product_id;
		// Get body of message
		const body = html.decode(stanza.getChildText("body"));
		const bodyData = getFirstURL(body);
		// get product id from "x" tag
		var evt = events[product_id.pil.substring(0, 3)];

		if (!evt) {
			evt = { name: "Unknown", priority: 3 }
			console.log(`${colors.red("[ERROR]")} Unknown event type: ${product_id.pil.substring(0, 3)}. Fix me`);
			console.log(`${colors.magenta("[DEBUG]")} ${bodyData.string}`)
		}

		evt.code = product_id.pil.substring(0, 3);
		// Check timestamp, if not within 3 minutes, ignore it
		const now = new Date();
		const diff = (now - product_id.timestamp) / 1000 / 60;
		if (diff > 3) return;
		if (config.debug >= 1) console.log(`${colors.magenta("[DEBUG]")} New message from ${fromChannel}`);
		messages++;


		// Handle NTFY
		if (config.ntfy.enabled) {
			if (config.debug >= 1) console.log(`${colors.magenta("[DEBUG]")} Sending NTFY for ${config.ntfy.prefix}${fromChannel}`)
			ntfyBody = {
				"topic": `${config.ntfy.prefix}${fromChannel}`,
				"message": bodyData.string,
				"tags": [`Timestamp: ${product_id.timestamp}`, `Station: ${product_id.station}`, `WMO: ${product_id.wmo}`, `PIL: ${product_id.pil}`, `Channel: ${fromChannel}`],
				"priority": evt.priority,
				"actions": [{ "action": "view", "label": "Product", "url": bodyData.url }, { "action": "view", "label": "Product Text", "url": `https://mesonet.agron.iastate.edu/api/1/nwstext/${product_id_raw}` }]
			}
			if (stanza.getChild("x").attrs.twitter_media) {
				ntfyBody.attach = stanza.getChild("x").attrs.twitter_media;
			}
			fetch(config.ntfy.server, {
				method: 'POST',
				body: JSON.stringify(ntfyBody),
				headers: {
					'Authorization': `Bearer ${config.ntfy.token}`
				}
			}).then((res) => {
				if (config.debug >= 1) console.log(`${colors.magenta("[DEBUG]")} NTFY sent for ${config.ntfy.prefix}${fromChannel} with status ${res.status} ${res.statusText}`);
				if (res.status !== 200) console.log(`${colors.red("[ERROR]")} NTFY failed for ${config.ntfy.prefix}${fromChannel} with status ${res.status} ${res.statusText}`);


			}).catch((err) => {
				console.error(err)
			})
		}


		// Send discord msg
		let embed = {
			description: `<t:${product_id.timestamp / 1000}:T> <t:${product_id.timestamp / 1000}:R> ${bodyData.string}`,
			color: parseInt(config.priorityColors[evt.priority].replace("#", ""), 16) || 0x000000,
			timestamp: product_id.timestamp,
			footer: {
				text: `Station: ${product_id.station} PID: ${product_id_raw} Channel: ${fromChannel}`
			}
		}
		if (stanza.getChild("x").attrs.twitter_media) {
			embed.image = {
				url: stanza.getChild("x").attrs.twitter_media
			}
		}

		let discordMsg = {
			embeds: [embed],
			components: [
				{
					type: 1,
					components: [
						{
							type: 2,
							label: "Product",
							style: 5,
							url: bodyData.url
						},
						{
							type: 2,
							style: 1,
							custom_id: product_id_raw,
							label: "Product Text",
							emoji: {
								name: "📄"
							}
						}
					]
				}
			]
		}
		// Discord Channel Handling
		db.all(`SELECT * FROM channels WHERE iemchannel = ?`, [fromChannel], (err, rows) => {
			if (err) {
				console.log(`${colors.red("[ERROR]")} ${err.message}`);
			}
			if (!rows) return; // No channels to alert
			rows.forEach((row) => {
				// Get Filters as arrays
				if (!row.filterEvt) row.filterEvt = "";
				if (!row.filter) row.filter = "";
				let filterEvt = row.filterEvt.toLowerCase().split(",");
				let filters = row.filter.toLowerCase().split(",");
				if (evt.priority < row.minPriority) return;
				// If the event type is not in th filter, ignore it. Make sure filterEvt isnt null
				if (!filterEvt[0]) filterEvt = [];
				if (!filterEvt.includes(evt.code.toLowerCase()) && !filterEvt.length == 0) return;

				let channel = discord.channels.cache.get(row.channelid);
				if (!channel) return console.log(`${colors.red("[ERROR]")} Channel ${row.channelid} not found`);

				// fetch the product text
				trySend = () => {
					fetch(`https://mesonet.agron.iastate.edu/api/1/nwstext/${product_id_raw}`).then((res) => {
						// If neither the body nor the product text contains the filter, ignore it
						res.text().then((text) => {
							if (!filters.some((filter) => body.toLowerCase().includes(filter)) && !filters.some((filter) => text.toLowerCase().includes(filter))) return;
							thisMsg = JSON.parse(JSON.stringify(discordMsg));
							thisMsg.content = row.custommessage || null;
							channel.send(thisMsg).catch((err) => {
								console.error(err);
							}).then((msg) => {
								if (msg.channel.type === Discord.ChannelType.GuildAnnouncement) msg.crosspost();
							});
						});
					}).catch((err) => {
						setTimeout(() => {
							console.log(`${colors.red("[ERROR]")} Failed to fetch product text, retrying... ${err}`)
							trySend();
						})
					});
				}
				trySend();
			});
		});


		// User DM alert handling
		db.all(`SELECT * FROM userAlerts WHERE iemchannel = ?`, [fromChannel], (err, rows) => {
			if (err) {
				console.error(err.message);
			}
			if (!rows) return; // No users to alert
			rows.forEach((row) => {
				// Get Filters as arrays
				if (!row.filterEvt) row.filterEvt = "";
				if (!row.filter) row.filter = "";
				let filterEvt = row.filterEvt.toLowerCase().split(",");
				let filters = row.filter.toLowerCase().split(",");

				// If priority is less than the min priority, ignore it
				if (evt.priority < row.minPriority) return;
				// If the event type is not in th filter, ignore it. Make sure filterEvt isnt null
				if (!filterEvt[0]) filterEvt = [];
				if (!filterEvt.includes(evt.code.toLowerCase()) && !filterEvt.length == 0) return;
				let user = discord.users.cache.get(row.userid);
				if (!user) return console.log(`${colors.red("[ERROR]")} User ${row.userid} not found`);

				// fetch the product text
				trySend = () => {
					fetch(`https://mesonet.agron.iastate.edu/api/1/nwstext/${product_id_raw}`).then((res) => {
						// If neither the body nor the product text contains the filter, ignore it
						res.text().then((text) => {
							if (!filters.some((filter) => body.toLowerCase().includes(filter)) && !filters.some((filter) => text.toLowerCase().includes(filter))) return;
							thisMsg = JSON.parse(JSON.stringify(discordMsg));
							thisMsg.content = row.custommessage || null;
							user.send(thisMsg).catch((err) => {
								console.error(err);
							});
						});
					}).catch((err) => {
						setTimeout(() => {
							console.log(`${colors.red("[ERROR]")} Failed to fetch product text, retrying... ${err}`)
							trySend();
						})
					});;
				}
				trySend();
			});
		});
	}
});



xmpp.on("online", async (address) => {
	if (config["uptime-kuma"].enabled) {
		fetch(config["uptime-kuma"].url).then(() => {
			console.log(`${colors.cyan("[INFO]")} Sent heartbeat to Uptime Kuma`)
		})
		setInterval(() => {
			// Send POST request to config["uptime-kuma"].url
			fetch(config["uptime-kuma"].url).then(() => {
				console.log(`${colors.cyan("[INFO]")} Sent heartbeat to Uptime Kuma`)
			})
		}, config["uptime-kuma"].interval * 1000) // Every X seconds
	}

	errCount = 0;
	// Start listening on all channels, (dont ban me funny man)
	// for (const channel in iem) {
	// 	console.log(`Joining ${channel.name}`)
	// 	await xmpp.send(xml("presence", { to: `${channel.jud}/${channel.name}` }));
	// }
	/* sub format
	<presence to="botstalk@conference.weather.im/add9b8f1-038d-47ed-b708-6ed60075a82f" xmlns="jabber:client">
		<x xmlns="http://jabber.org/protocol/muc#user">
			<item>
				<role>visitor</role>
			</item>
		</x>
	</presence>
	*/

	// Request room list
	// Automatically find room list
	xmpp.send(xml("iq", { type: "get", to: "conference.weather.im", id: "rooms" }, xml("query", { xmlns: "http://jabber.org/protocol/disco#items" })));
	// Join all channels (Old method)
	// iem.forEach((channel => {
	// 	console.log(`${colors.cyan("[INFO]")} Joining ${channel.jid}/${channel.name}/${curUUID}`)
	// 	//xmpp.send(xml("presence", { to: `${channel.jid}/${channel.jid.split("@")[0]}` }));
	// 	xmpp.send(xml("presence", { to: `${channel.jid}/${channel.name}/${curUUID}` }, xml("item", { role: "visitor" })));
	// }))

	console.log(`${colors.cyan("[INFO]")} Connected to XMPP server as ${address.toString()}`);

	setTimeout(() => {
		startup = false;
		console.log(`${colors.cyan("[INFO]")} Startup complete, listening for messages...`);
	}, 1000)
});

xmpp.on("close", () => {
	console.log(`${colors.yellow("[WARN]")} XMPP connection closed, trying to reconnect...`);
	xmpp.disconnect().then(() => {
		xmpp.stop().then(() => {
			start();
		})
	})
})

const start = () => {
	startup = true;
	xmpp.start().catch((err) => {
		errCount++;
		if (errCount >= 5) {
			console.log(`${colors.red("[ERROR]")} XMPP failed to start after 5 attempts, exiting...`);
			process.exit(1);
		}
		console.log(`${colors.red("[ERROR]")} XMPP failed to start: ${err}.`);
		xmpp.disconnect().then(() => {
			xmpp.stop().then(() => {
				start();
			})
		})
	});
}

// END XMPP

// START DISCORD

discord.on('ready', async () => {
	console.log(`${colors.cyan("[INFO]")} Logged in as ${discord.user.tag}`);

	// Get all guilds, and log them
	discord.guilds.cache.forEach((guild) => {
		console.log(`${colors.cyan("[INFO]")} In guild: ${guild.name} (${guild.id})`);
	});

	// Do slash command stuff
	commands = require("./data/commands.json");
	// Add dynamic commands (based on datas files)
	satCommand = {
		"name": "sattelite",
		"description": "Get the latest sattelite images from a given sattelite",
		"options": [
			{
				"name": "sattelite",
				"description": "The sattelite to get images from",
				"type": 3,
				"required": true,
				"choices": []
			}
		]
	}
	for (const key in sattelites) {
		// Push the key to the choices array
		satCommand.options[0].choices.push({
			"name": key,
			"value": key
		});
	}
	commands.push(satCommand);

	if (config.broadcastify.enabled) {
		// Add commands to join vc, leave vc, and play stream
		commands.push(
			{
				"name": "playbcfy",
				"description": "Play the broadcastify stream",
				"options": [
					{
						"name": "id",
						"description": "The ID of the stream to play",
						"type": 3,
						"required": true
					}
				]
			}
		)
	}
	if (config.voice_enabled) {
		// Add commands to join vc, leave vc, and play stream
		commands.push(
			{
				"name": "leave",
				"description": "Leave the current voice chat",
				"default_member_permissions": 0
			},
			{
				"name": "play",
				"description": "Play a stream",
				"options": [
					{
						"name": "url",
						"description": "The URL of the stream to play",
						"type": 3,
						"required": true
					}
				]
			},
			{
				"name": "pause",
				"description": "Pause/Unpause the current stream",
				"type": 1
			},
			{
				"name": "volume",
				"description": "Set the volume of the current stream",
				"options": [
					{
						"name": "volume",
						"description": "The volume to set",
						"type": 4,
						"required": true
					}
				]
			}
		)
	}
	await (async () => {
		try {
			//Global
			await rest.put(Routes.applicationCommands(discord.user.id), { body: commands })
		} catch (error) {
			console.error(error);
		}
	})();

	start();
	setTimeout(() => {
		// Wait 10 seconds, if startup is still true, something went wrong
		if (startup) {
			console.log(`${colors.red("[ERROR]")} Startup failed, exiting...`);
			process.exit(1);
		}
	}, 10000)

	// Check all channels in DB, fetch them, if they dont exist, delete all subscriptions
	db.all(`SELECT channelid FROM channels`, (err, rows) => {
		if (err) {
			console.error(err.message);
		}
		rows.forEach((row) => {
			const channel = discord.channels.cache.get(row.channelid);
			if (!channel) {
				// Delete the channel from the database and return
				return db.run(`DELETE FROM channels WHERE channelid = ?`, [row.channelid], (err) => {
					if (err) {
						console.error(err.message);
					}
					console.log(`${colors.cyan("[INFO]")} Deleted channel ${row.channelid} from database`);
				});
			};
		});
	});

	// Get all users in userAlerts and fetch them
	db.all(`SELECT userid FROM userAlerts`, (err, rows) => {
		if (err) {
			console.error(err.message);
		}
		rows.forEach((row) => {
			discord.users.fetch(row.userid);
		});
	});
});

discord.on("interactionCreate", async (interaction) => {
	switch (interaction.type) {
		case Discord.InteractionType.ApplicationCommand:
			switch (interaction.commandName) {
				case "subscribe":
					room = getWFOroom(interaction.options.getString("room"));
					if (!iem.find((channel) => channel.jid.split("@")[0] === room)) {
						interaction.reply({ content: "Invalid room", ephemeral: true });
						return;
					}
					if (interaction.options.getString("filter")) {
						filter = interaction.options.getString("filter").toLowerCase();
					} else {
						filter = "";
					}
					minPriority = interaction.options.getInteger("minpriority");
					filterEvt = interaction.options.getString("filterevt") || null;
					message = interaction.options.getString("message") || null;
					if (interaction.inGuild()) {
						db.get(`SELECT * FROM channels WHERE channelid = ? AND iemchannel = ?`, [interaction.channel.id, room], (err, row) => {
							if (err) {
								console.error(err.message);
								interaction.reply({ content: "Failed to subscribe to room", ephemeral: true });
							} else if (row) {
								return interaction.reply({ content: `Already subscribed to \`${getWFOByRoom(room).location}\`\nIf you want to update a subscribtion, please unsubscribe and resubscribe. This will be made a command eventually.`, ephemeral: true });
							}
							db.run(`INSERT INTO channels (channelid, iemchannel, custommessage, filter, filterevt, minPriority) VALUES (?, ?, ?, ? ,? ,?)`, [interaction.channel.id, room, message, filter, filterEvt, minPriority], (err) => {
								if (err) {
									console.error(err.message);
									interaction.reply({ content: "Failed to subscribe to room", ephemeral: true });
								} else {
									interaction.reply({ content: `Subscribed to \`${getWFOByRoom(room).location}\``, ephemeral: true });
								}
							});
						});
					} else { // We're in a DM
						db.get(`SELECT * FROM userAlerts WHERE userid = ? AND iemchannel = ?`, [interaction.user.id, room], (err, row) => {
							if (err) {
								console.error(err.message);
								interaction.reply({ content: "Failed to subscribe to room", ephemeral: true });
							} else if (row) {
								return interaction.reply({ content: `Already subscribed to \`${getWFOByRoom(room).location}\`\nIf you want to update a subscribtion, please unsubscribe and resubscribe. This will be made a command eventually.`, ephemeral: true });
							}
							db.run(`INSERT INTO userAlerts (userid, iemchannel, custommessage, filter, filterEvt, minPriority) VALUES (?, ?, ?, ? ,?, ?)`, [interaction.user.id, room, message, filter, filterEvt, minPriority], (err) => {
								if (err) {
									console.error(err.message);
									interaction.reply({ content: "Failed to subscribe to room", ephemeral: true });
								} else {
									interaction.reply({ content: `Subscribed to \`${getWFOByRoom(room).location}\``, ephemeral: true });
								}
							});
						});
					}
					break;
				case "unsubscribe":
					// Check that the room is valid
					room = getWFOroom(interaction.options.getString("room"));
					if (!iem.find((channel) => channel.jid.split("@")[0] === room)) {
						interaction.reply({ content: "Invalid room", ephemeral: true });
						return;
					}
					if (interaction.inGuild()) {
						// Check if subbed
						db.get(`SELECT * FROM channels WHERE channelid = ? AND iemchannel = ?`, [interaction.channel.id, room], (err, row) => {
							if (err) {
								console.error(err.message);
								interaction.reply({ content: "Failed to unsubscribe from room", ephemeral: true });
							}
							if (!row) {
								return interaction.reply({ content: `Not subscribed to \`${getWFOByRoom(room).location}\``, ephemeral: true });
							}
							db.run(`DELETE FROM channels WHERE channelid = ? AND iemchannel = ?`, [interaction.channel.id, room], (err) => {
								if (err) {
									console.error(err.message);
									interaction.reply({ content: "Failed to unsubscribe from room", ephemeral: true });
								}
								interaction.reply({ content: `Unsubscribed from \`${getWFOByRoom(room).location}\``, ephemeral: true });
							});
						});
					} else {
						db.get(`SELECT * FROM userAlerts WHERE userid = ? AND iemchannel = ?`, [interaction.user.id, room], (err, row) => {
							if (err) {
								console.error(err.message);
								interaction.reply({ content: "Failed to unsubscribe from room", ephemeral: true });
							}
							if (!row) {
								return interaction.reply({ content: `Not subscribed to \`${getWFOByRoom(room).location}\``, ephemeral: true });
							}
							db.run(`DELETE FROM userAlerts WHERE userid = ? AND iemchannel = ?`, [interaction.user.id, room], (err) => {
								if (err) {
									console.error(err.message);
									interaction.reply({ content: "Failed to unsubscribe from room", ephemeral: true });
								}
								interaction.reply({ content: `Unsubscribed from \`${getWFOByRoom(room).location}\``, ephemeral: true });
							});
						});
					}
					break;
				case "list":
					// List all the subscribed rooms
					if (interaction.inGuild()) {
						db.all(`SELECT * FROM channels WHERE channelid = ?`, [interaction.channel.id], (err, rows) => {
							if (err) {
								console.error(err.message);
								interaction.reply({ content: "Failed to get subscribed rooms", ephemeral: true });
							}
							if (!rows) {
								return interaction.reply({ content: "No subscribed rooms", ephemeral: true });
							}
							let roomList = [];
							rows.forEach((row) => {
								roomList.push({
									name: `${row.iemchannel}: ${getWFOByRoom(row.iemchannel).location}`,
									value: `Message: \`\`${row.custommessage || "None"}\`\`\nFilter: \`\`${row.filter || "None"}\`\`\nEvent Filter: \`\`${row.filterEvt || "None"}\`\`\nMin Priority: \`\`${row.minPriority || "None"}\`\``
								});
							});
							const embed = {
								title: "Subscribed Rooms",
								fields: roomList,
								color: 0x00ff00
							}
							interaction.reply({ embeds: [embed], ephemeral: true });
						});
					} else {
						db.all(`SELECT * FROM userAlerts WHERE userid = ?`, [interaction.user.id], (err, rows) => {
							if (err) {
								console.error(err.message);
								interaction.reply({ content: "Failed to get subscribed rooms", ephemeral: true });
							}
							if (!rows) {
								return interaction.reply({ content: "No subscribed rooms", ephemeral: true });
							}
							let roomList = [];
							rows.forEach((row) => {
								roomList.push({
									name: `${row.iemchannel}: ${getWFOByRoom(row.iemchannel).location}`,
									value: `Message: \`\`${row.custommessage || "None"}\`\`\nFilter: \`\`${row.filter || "None"}\`\`\nEvent Filter: \`\`${row.filterEvt || "None"}\`\`\nMin Priority: \`\`${row.minPriority || "None"}\`\``
								});
							});
							const embed = {
								title: "Subscribed Rooms",
								fields: roomList,
								color: 0x00ff00
							}
							interaction.reply({ embeds: [embed], ephemeral: true });
						});
					}
					break;
				case "about":
					// Send an embed showing info about the bot, including number of guilds, number of subscribed rooms, etc
					let guilds = discord.guilds.cache.size;
					let channels = 0;
					let uniques = 0;
					await db.get(`SELECT COUNT(*) as count FROM channels`, async (err, row) => {
						channels = row.count

						await getUniqueChannels().then((unique) => {
							uniques = unique;
						});
						const embed = {
							title: "About Me!",
							thumbnail: {
								url: discord.user.avatarURL()
							},
							description: `I listen to all the weather.im rooms and send them to discord channels.\nI am open source, you can find my code [here!](https://github.com/ChrisChrome/iembot-2.0)\n\nThis bot is not affiliated with NOAA, the National Weather Service, or the IEM project.`,
							fields: [
								{
									name: "Uptime",
									value: `Since <t:${Math.floor(startTimestap / 1000)}>, Started <t:${Math.floor(startTimestap / 1000)}:R>`,
								},
								{
									name: "Caught Messages",
									value: `Got ${messages.toLocaleString()} messages since startup`,
								},
								{
									name: "Guilds",
									value: guilds.toLocaleString(),
									inline: true
								},
								{
									name: "Subscribed Rooms",
									value: channels.toLocaleString(),
									inline: true
								},
								{
									name: "Unique Channels",
									value: uniques.toLocaleString(),
									inline: true
								}
							],
							color: 0x00ff00,
							footer: {
								text: "Made by @chrischrome with <3",
								icon_url: discord.users.cache.get("289884287765839882").avatarURL()
							}
						}
						interaction.reply({ embeds: [embed] });
					});
					break;
				case "rooms":
					// // Send an embed showing all the available rooms
					// let roomList = "";
					// iem.forEach((channel) => {
					// 	room = channel.jid.split("@")[0]
					// 	console.log(getWFOByRoom(room))
					// 	roomList += `\`${room}\`: ${getWFOByRoom(room).location}\n`;
					// });
					// const roomEmbed = {
					// 	title: "Available Rooms",
					// 	description: roomList,
					// 	color: 0x00ff00
					// }
					// interaction.reply({ embeds: [roomEmbed], ephemeral: true });
					// Do the above, but paginate like the product text
					let roomList = "";
					iem.forEach((channel) => {
						room = channel.jid.split("@")[0]
						roomList += `\`${room}\`: ${getWFOByRoom(room).location || "Unknown"}\n`;
					});
					const pages = roomList.match(/[\s\S]{1,2000}(?=\n|$)/g);
					embeds = pages.map((page, ind) => ({
						title: `Available Rooms Pg ${ind + 1}/${pages.length}`,
						description: page,
						color: 0x00ff00
					}));
					interaction.reply({ embeds, ephemeral: true });
					break;
				case "setupall":
					if (!interaction.inGuild()) return interaction.reply({ content: "This command can only be used in a guild", ephemeral: true });
					if (!config.discord.owner) return interaction.reply({ content: "Owner not set in config", ephemeral: true });
					if (interaction.user.id !== config.discord.owner) return interaction.reply({ content: "You are not the owner", ephemeral: true });
					await interaction.deferReply({ ephemeral: true })
					var category;



					// New setup, we're pulling from wfos.json now
					const chunks = [];
					const chunkSize = 50;
					const total = iem.length;
					// wfos is object "wfo": {"location": "Text Name", "room": "roomname"}
					for (let i = 0; i < total; i += chunkSize) {
						chunks.push(iem.slice(i, i + chunkSize));
						console.log(iem.slice(i, i + chunkSize))
					}



					chunks.forEach((chunk, index) => {
						const categoryName = `Rooms ${index + 1}`;
						interaction.guild.channels.create({
							name: categoryName,
							type: Discord.ChannelType.GuildCategory
						}).then((newCategory) => {
							console.log(`${colors.cyan("[INFO]")} Created category ${newCategory.name}`);
							chunk.forEach((channel) => {
								channelName = `${channel.jid.split("@")[0]}_${getWFOByRoom(channel.jid.split("@")[0]).location}`
								if (channelName == "Unknown") channelName = channel.jid.split("@")[0]
								newCategory.guild.channels.create({
									name: channelName,
									type: Discord.ChannelType.GuildText,
									parent: newCategory,
									topic: `Weather.im room for ${getWFOByRoom(channel.jid.split("@")[0]).location} - ${channel.jid.split("@")[0]}`
								}).then((newChannel) => {
									console.log(`${colors.cyan("[INFO]")} Created channel ${newChannel.name}`);
									db.run(`INSERT INTO channels (channelid, iemchannel, custommessage) VALUES (?, ?, ?)`, [newChannel.id, channel.jid.split("@")[0], null], (err) => {
										if (err) {
											console.error(err.message);
										}
										console.log(`${colors.cyan("[INFO]")} Added channel ${newChannel.id} to database`);
									});
								}).catch((err) => {
									console.log(`${colors.red("[ERROR]")} Failed to create channel: ${err.message}`);
								});
							});
						}).catch((err) => {
							console.log(`${colors.red("[ERROR]")} Failed to create category: ${err.message}`);
						});
					});
					interaction.editReply({ content: "Setup complete", ephemeral: true });
					break;
				case "support":
					// Generate an invite link to the support server (use widget channel)
					const invite = await discord.guilds.cache.get(config.discord.mainGuild).channels.cache.get(config.discord.inviteChannel).createInvite();
					const embed = {
						title: "Support Server",
						description: `Need help with the bot? Join the support server [here](${invite.url})`,
						color: 0x00ff00
					}
					interaction.reply({ embeds: [embed] });
					break;

				case "playbcfy": // Play broadcastify stream
				if (!interaction.inGuild()) return interaction.reply({ content: "This command can only be used in a guild", ephemeral: true });
					if (!config.broadcastify.enabled) return interaction.reply({ content: "Broadcastify is not enabled", ephemeral: true });
					streamID = interaction.options.getString("id");
					// Check if the stream ID is valid (up to 10 digit alphanumeric)
					if (!streamID.match(/^[a-zA-Z0-9]{1,10}$/)) return interaction.reply({ content: "Invalid stream ID", ephemeral: true });
					// Get the stream URL
					url = `https://${config.broadcastify.username}:${config.broadcastify.password}@audio.broadcastify.com/${streamID}.mp3`;
					// Get the channel
					channel = interaction.member.voice.channel;
					if (!channel) return interaction.reply({ content: "You need to be in a voice channel", ephemeral: true });
					// Join the channel and play the stream
					res = JoinChannel(channel, url, .1, interaction)
					if (res) {
						interaction.reply({ content: "Playing Stream", ephemeral: true });
					} else {
						interaction.reply({ content: `Failed to play stream`, ephemeral: true });
					}
					break;

				case "play": // Play generic stream
				if (!interaction.inGuild()) return interaction.reply({ content: "This command can only be used in a guild", ephemeral: true });
					// Get the URL
					url = interaction.options.getString("url");
					// Sanity check URL for funny stuff
					if (!url.match(/https?:\/\/[^\s]+/)) return interaction.reply({ content: "Invalid URL", ephemeral: true });
					// Get the channel
					channel = interaction.member.voice.channel;
					if (!channel) return interaction.reply({ content: "You need to be in a voice channel", ephemeral: true });
					// Join the channel and play the stream
					st = JoinChannel(channel, url, .1, interaction)
					if (st) {
						interaction.reply({ content: "Joined, trying to start playing.", ephemeral: true });
					} else {
						interaction.reply({ content: `Failed to play stream`, ephemeral: true });
					}
					break;

				case "leave": // Leave broadcastify stream
					if (!interaction.inGuild()) return interaction.reply({ content: "This command can only be used in a guild", ephemeral: true });
					channel = interaction.member.voice.channel;
					if (!channel) return interaction.reply({ content: "You need to be in a voice channel", ephemeral: true });
					res = LeaveVoiceChannel(channel)
					if (res) {
						interaction.reply({ content: "Left voice channel", ephemeral: true });
					} else {
						interaction.reply({ content: "Failed to leave voice channel (Was i ever in one?)", ephemeral: true });
					}

					break;
				case "pause": // Pause/unpause stream
				if (!interaction.inGuild()) return interaction.reply({ content: "This command can only be used in a guild", ephemeral: true });
					channel = interaction.member.voice.channel;
					if (!channel) return interaction.reply({ content: "You need to be in a voice channel", ephemeral: true });
					res = toggleVoicePause(channel)
					if (res) {
						interaction.reply({ content: "Toggled pause", ephemeral: true });
					} else {
						interaction.reply({ content: "Failed to toggle pause", ephemeral: true });
					}
					break;
				case "volume": // Set volume
				if (!interaction.inGuild()) return interaction.reply({ content: "This command can only be used in a guild", ephemeral: true });
					channel = interaction.member.voice.channel;
					if (!channel) return interaction.reply({ content: "You need to be in a voice channel", ephemeral: true });
					volume = interaction.options.getInteger("volume") / 100;
					// Make sure volume isnt negative
					if (volume < 0) volume = 0;
					if (volume > 1) volume = 1;
					res = setVolume(channel, volume)
					if (res) {
						interaction.reply({ content: `Set volume to ${volume * 100}%` });
					} else {
						interaction.reply({ content: "Failed to set volume", ephemeral: true });
					}
					break;
				case "outlook":
					day = interaction.options.getInteger("day");
					type = interaction.options.getString("type");
					if (day < 0 || day > 7) return interaction.reply({ content: "Invalid day", ephemeral: true });
					if (type !== "fire" && type !== "convective") return interaction.reply({ content: "Invalid type", ephemeral: true });
					url = outlookURLs[type][day];
					await interaction.deferReply();
					fetch(url).then((res) => {
						if (res.status !== 200) {
							interaction.editReply({ content: "Failed to get outlook", ephemeral: true });
							return;
						}
						res.buffer().then(async (buffer) => {
							// Check all overlays and add them to image as selected using Jimp
							overlays = ["population", "city", "cwa", "rfc", "interstate", "county", "tribal", "artcc", "fema"]
							await Jimp.read(buffer).then((image) => {
								outImg = image;
								cnt = 0;
								sendMsg = setTimeout(() => {
									interaction.editReply({
										embeds: [{
											title: `${toTitleCase(type)} Outlook Day ${day + 1}`,
											image: {
												url: `attachment://${type}_${day}.png`
											},
											color: 0x00ff00
										}],
										files: [{
											attachment: buffer,
											name: `${type}_${day}.png`
										}]
									});
								}, 150)
								overlays.forEach((overlay) => {
									if (interaction.options.getBoolean(`${overlay}_overlay`)) {
										clearTimeout(sendMsg);
										Jimp.read(`./images/overlays/${overlay}.png`).then((overlayImage) => {
											outImg.composite(overlayImage, 0, 0);
											sendMsg = setTimeout(() => {
												outImg.getBufferAsync(Jimp.MIME_PNG).then((buffer) => {
													interaction.editReply({
														embeds: [{
															title: `${toTitleCase(type)} Outlook Day ${day + 1}`,
															image: {
																url: `attachment://${type}_${day}.png`
															},
															color: 0x00ff00
														}],
														files: [{
															attachment: buffer,
															name: `${type}_${day}.png`
														}]
													});
												});
											}, 150)
										});
									}
								})



								// interaction.editReply({
								// 	embeds: [{
								// 		title: `${toTitleCase(type)} Outlook Day ${day + 1}`,
								// 		image: {
								// 			url: `attachment://${type}_${day}.png`
								// 		},
								// 		color: 0x00ff00
								// 	}],
								// 	files: [{
								// 		attachment: buffer,
								// 		name: `${type}_${day}.png`
								// 	}]
								// });
							});
						});
					}).catch((err) => {
						interaction.editReply({ content: "Failed to get outlook", ephemeral: true });
						console.log(`${colors.red("[ERROR]")} Failed to get outlook: ${err.message}`);
						console.error(err);
					});
					break;
				case "alertmap":
					url = "https://forecast.weather.gov/wwamap/png/US.png"
					await interaction.deferReply();
					fetch(url).then((res) => {
						if (res.status !== 200) {
							interaction.editReply({ content: "Failed to get alert map", ephemeral: true });
							return;
						}
						res.buffer().then(async (buffer) => {
							interaction.editReply({
								embeds: [{
									title: `Alert Map`,
									image: {
										url: `attachment://alerts.png`
									},
									color: 0x00ff00
								}],
								files: [{
									attachment: buffer,
									name: `alerts.png`
								}]
							});
						});
					}).catch((err) => {
						interaction.editReply({ content: "Failed to get alert map", ephemeral: true });
						console.log(`${colors.red("[ERROR]")} Failed to get alert map: ${err.message}`);
						console.error(err);
					});
					break;
				case "sattelite": // Get satellite images
					sat = interaction.options.getString("sattelite");
					if (!sattelites[sat]) return interaction.reply({ content: "Invalid satellite", ephemeral: true });
					// Fetch all the images
					await interaction.deferReply();
					imageBuffers = {};
					embeds = [];
					files = [];
					sattelites[sat].forEach(async (imgData) => {
						// Get a buffer for the data, and put that in imageBuffers with the "name" as the key
						fetch(imgData.url).then((res) => {
							if (res.status !== 200) {
								interaction.editReply({ content: "Failed to get satellite images", ephemeral: true });
								return;
							}
							res.buffer().then((buffer) => {
								imageBuffers[imgData.name] = buffer;
								files.push({
									attachment: buffer,
									name: `${imgData.name}.jpg`
								});
								embeds.push({
									title: `${sat} ${imgData.name}`,
									image: {
										url: `attachment://${imgData.name}.jpg`
									}
								});
								// Check if we have all the images
								if (Object.keys(imageBuffers).length === sattelites[sat].length) {
									// Send the images
									interaction.editReply({
										embeds,
										files
									});
								}
							});
						}).catch((err) => {
							interaction.editReply({ content: "Failed to get satellite images", ephemeral: true });
							console.log(`${colors.red("[ERROR]")} Failed to get satellite images: ${err.message}`);
							console.error(err);
						});
					});
					break;




			}
		case Discord.InteractionType.MessageComponent:
			if (interaction.customId) {
				const product_id = interaction.customId;
				const url = `https://mesonet.agron.iastate.edu/api/1/nwstext/${product_id}`;
				await interaction.deferReply({ ephemeral: true });
				fetch(url).then((res) => {
					if (res.status !== 200) {
						interaction.reply({ content: "Failed to get product text", ephemeral: true });
						return;
					}
					// Retruns raw text, paginate it into multiple embeds if needed
					res.text().then(async (text) => {
						const pages = text.match(/[\s\S]{1,2000}(?=\n|$)/g);
						// const embeds = pages.map((page, ind) => ({
						// 	title: `Product Text for ${product_id} Pg ${ind + 1}/${pages.length}`,
						// 	description: `\`\`\`${page}\`\`\``,
						// 	color: 0x00ff00
						// }));
						const messages = pages.map((page, ind) => {
							return `\`\`\`${page}\`\`\``
						})
						messages.forEach(async (message) => {
							interaction.followUp({ content: message, ephemeral: true });
						})
					});
				}).catch((err) => {
					interaction.reply({ content: "Failed to get product text", ephemeral: true });
					console.log(`${colors.red("[ERROR]")} Failed to get product text: ${err.message}`);
				});
			}
			break;
	}


});

discord.on("guildCreate", (guild) => {
	// Get the main guild
	const myGuild = discord.guilds.cache.get(config.discord.mainGuild);
	// Get the log channel
	const channel = myGuild.channels.cache.get(config.discord.logChannel);
	// Send a message to the log channel
	channel.send({
		embeds: [
			{
				description: `I joined \`${guild.name}\``,
				color: 0x00ff00
			}
		]
	})

})

discord.on("guildDelete", (guild) => {
	// Get the main guild
	const myGuild = discord.guilds.cache.get(config.discord.mainGuild);
	// Get the log channel
	const channel = myGuild.channels.cache.get(config.discord.logChannel);
	// Send a message to the log channel
	channel.send({
		embeds: [
			{
				description: `I left \`${guild.name}\``,
				color: 0xff0000
			}
		]
	})
})

process.on("unhandledRejection", (error, promise) => {
	console.log(`${colors.red("[ERROR]")} Unhandled Rejection @ ${promise}: ${error}`);
	// create errors folder if it doesnt exist
	if (!fs.existsSync("./error")) {
		fs.mkdirSync("./error");
	}
	// write ./error/rejection_timestamp.txt
	fs.writeFileSync(`./error/rejection_${Date.now()}.txt`, `ERROR:\n${error}\n\nPROMISE:\n${JSON.stringify(promise)}`);
	// Send discord log
	const myGuild = discord.guilds.cache.get(config.discord.mainGuild);
	const channel = myGuild.channels.cache.get(config.discord.logChannel);
	channel.send({
		embeds: [
			{
				description: `Unhandled Rejection\n\`\`\`${error}\n${JSON.stringify(promise)}\`\`\``,
				color: 0xff0000
			}
		]
	})
	return;
});

process.on("uncaughtException", (error) => {

	console.log(`${colors.red("[ERROR]")} Uncaught Exception: ${error.message}\n${error.stack}`);
	if (!fs.existsSync("./error")) {
		fs.mkdirSync("./error");
	}
	// write ./error/exception_timestamp.txt
	fs.writeFileSync(`./error/exception_${Date.now()}.txt`, error.stack);
	// Send message to log channel
	const myGuild = discord.guilds.cache.get(config.discord.mainGuild);
	const channel = myGuild.channels.cache.get(config.discord.logChannel);
	channel.send({
		embeds: [
			{
				description: `Uncaught Exception\n\`\`\`${error.message}\n${error.stack}\`\`\``,
				color: 0xff0000
			}
		]
	})
	return;
});

// Login to discord
discord.login(config.discord.token);