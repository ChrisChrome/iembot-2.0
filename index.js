// Requires
const config = require("./config.json");
const wfos = require("./wfos.json");
const { client, xml } = require("@xmpp/client");
const fetch = require("node-fetch");
const html = require("html-entities")
const Discord = require("discord.js");
const colors = require("colors");
const sqlite3 = require("sqlite3").verbose();
// Setup Discord
const discord = new Discord.Client({
	intents: [
		"Guilds"
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
	db.run(`CREATE TABLE IF NOT EXISTS channels (channelid TEXT, iemchannel TEXT, custommessage TEXT)`);
});

// Setup stuff
var startup = true;
var startTimestap = new Date();
var messages = 0;
var errCount = 0;
// Random funcs
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
	return new Date(Date.UTC(year, month - 1, day, hours, mins));
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
	return "Unknown";
}

const xmpp = client({
	service: "xmpp://conference.weather.im",
	domain: "weather.im"
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
	setTimeout(() => {
		xmpp.stop().then(() => {
			start();
		});
	}, 5000);
});


xmpp.on("stanza", (stanza) => {
	if (config.debug >= 2) console.log(`${colors.magenta("[DEBUG]")} Stanza: ${stanza.toString()}`);
	// Stops spam from getting old messages
	if (startup) return;
	// Get new messages and log them, ignore old messages
	if (stanza.is("message") && stanza.attrs.type === "groupchat") {
		// Get channel name
		fromChannel = stanza.attrs.from.split("@")[0];

		// Ignores
		if (!stanza.getChild("x")) return; // No PID, ignore it
		if (!stanza.getChild("x").attrs.product_id) return;

		// Get body of message
		const body = html.decode(stanza.getChildText("body"));
		const bodyData = getFirstURL(body);
		// get product id from "x" tag
		const product_id = parseProductID(stanza.getChild("x").attrs.product_id);
		const product_id_raw = stanza.getChild("x").attrs.product_id;
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
				"title": "New Alert",
				"tags": [`Timestamp: ${product_id.timestamp}`, `Station: ${product_id.station}`, `WMO: ${product_id.wmo}`, `PIL: ${product_id.pil}`, `Channel: ${fromChannel}`],
				"priority": 3,
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
				if (config.debug >= 1) console.log(`${colors.magenta("[DEBUG]")} NTFY sent for ${config.ntfy.prefix}${fromChannel} with status ${res.status}`);

			}).catch((err) => {
				console.error(err)
			})
		}


		// Send discord msg
		let embed = {
			title: "New Alert",
			description: bodyData.string,
			color: 0x00ff00,
			timestamp: product_id.timestamp,
			footer: {
				text: `Station: ${product_id.station} WMO: ${product_id.wmo} PIL: ${product_id.pil} Channel: ${fromChannel}`
			}
		}
		if (stanza.getChild("x").attrs.twitter_media) {
			embed.image = {
				url: stanza.getChild("x").attrs.twitter_media
			}
		}
		// Run through the database, and find all channels that are linked to the iem channel
		db.all(`SELECT channelid, custommessage FROM channels WHERE iemchannel = ?`, [fromChannel], (err, rows) => {
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
				channel.send({
					content: row.custommessage, embeds: [embed],
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
				).then((msg) => {
					if (msg.channel.type === Discord.ChannelType.GuildAnnouncement) msg.crosspost();
				}).catch((err) => {
					console.log(`${colors.red("[ERROR]")} Failed to send message to channel ${row.channelid}: ${err.message}`);
				});
			});
		});
	}
});



xmpp.on("online", async (address) => {
	errCount = 0;
	// Start listening on all channels, (dont ban me funny man)
	// for (const channel in config.iem.channels) {
	// 	console.log(`Joining ${channel.name}`)
	// 	await xmpp.send(xml("presence", { to: `${channel.jud}/${channel.name}` }));
	// }

	// Join all channels
	config.iem.channels.forEach((channel => {
		console.log(`${colors.cyan("[INFO]")} Joining ${channel.jid.split("@")[0]}:${channel.name}`)
		xmpp.send(xml("presence", { to: `${channel.jid}/${channel.jid.split("@")[0]}` }));
	}))

	console.log(`${colors.cyan("[INFO]")} Connected to XMPP server as ${address.toString()}`);

	setTimeout(() => {
		startup = false;
		console.log(`${colors.cyan("[INFO]")} Startup complete, listening for messages...`);
	}, 1000)
});

const start = () => {
	xmpp.start().catch((err) => {
		errCount++;
		if (errCount >= 5) {
			console.log(`${colors.red("[ERROR]")} XMPP failed to start after 5 attempts, exiting...`);
			process.exit(1);
		}
		console.log(`${colors.red("[ERROR]")} XMPP failed to start: ${err}. Trying again in 5 seconds...`);
		setTimeout(() => {
			start();
		}, 5000);
	});
}

// END XMPP

// START DISCORD

discord.on('ready', async () => {
	console.log(`${colors.cyan("[INFO]")} Logged in as ${discord.user.tag}`);
	// Do slash command stuff
	const commands = [
		{
			"name": "subscribe",
			"description": "Subscribe to a weather.im room",
			"default_member_permissions": 0,
			"options": [
				{
					"name": "room",
					"description": "The room/WFO you want to subscribe to",
					"type": 3,
					"required": true,
					"autocomplete": false
				},
				{
					"name": "message",
					"description": "Custom message to send when alert is sent",
					"type": 3,
					"required": false
				}
			]
		},
		{
			"name": "setmessage",
			"description": "Set a custom message for a room",
			"default_member_permissions": 0,
			"options": [
				{
					"name": "room",
					"description": "The room/WFO you want to set a message for",
					"type": 3,
					"required": true,
					"autocomplete": false
				},
				{
					"name": "message",
					"description": "Custom message to send when alert is sent",
					"type": 3,
					"required": true
				}
			]
		},
		{
			"name": "unsubscribe",
			"description": "Unsubscribe from a weather.im room",
			"default_member_permissions": 0,
			"options": [
				{
					"name": "room",
					"description": "The room/WFO you want to unsubscribe from",
					"type": 3,
					"required": true,
					"autocomplete": false
				},
			]
		},

		{
			"name": "list",
			"description": "List all subscribed rooms for this channel",
			"default_member_permissions": 0
		},
		{
			"name": "about",
			"description": "About this bot"
		},
		{
			"name": "rooms",
			"description": "List all available rooms"
		},
		{
			"name": "setupall",
			"description": "[OWNER ONLY] Setup channels in a category for all rooms",
			"default_member_permissions": 0,
			"type": 1
		}
	];

	await (async () => {
		try {
			//Global
			await rest.put(Routes.applicationCommands(discord.user.id), { body: commands })
		} catch (error) {
			console.error(error);
		}
	})();

	start();
});

discord.on("interactionCreate", async (interaction) => {
	switch (interaction.type) {
		case Discord.InteractionType.ApplicationCommand:
			if (!interaction.channel) return interaction.reply({ content: "This command can only be run in a text channel", ephemeral: true });
			if (interaction.channel.type !== Discord.ChannelType.GuildText && interaction.channel.type !== Discord.ChannelType.GuildAnnouncement) {
				interaction.reply({ content: "This command can only be run in a text channel", ephemeral: true });
				return;
			}
			switch (interaction.commandName) {
				case "subscribe":
					room = getWFOroom(interaction.options.getString("room"));
					if (!config.iem.channels.find((channel) => channel.jid.split("@")[0] === room)) {
						interaction.reply({ content: "Invalid room", ephemeral: true });
						return;
					}
					message = interaction.options.getString("message") || null;
					db.run(`INSERT INTO channels (channelid, iemchannel, custommessage) VALUES (?, ?, ?)`, [interaction.channel.id, room, message], (err) => {
						if (err) {
							console.error(err.message);
							interaction.reply({ content: "Failed to subscribe to room", ephemeral: true });
						} else {
							interaction.reply({ content: `Subscribed to \`${getWFOByRoom(room).location}\``, ephemeral: true });
						}
					});
					break;
				case "unsubscribe":
					// Check that the room is valid
					room = getWFOroom(interaction.options.getString("room"));
					if (!config.iem.channels.find((channel) => channel.jid.split("@")[0] === room)) {
						interaction.reply({ content: "Invalid room", ephemeral: true });
						return;
					}
					db.run(`DELETE FROM channels WHERE channelid = ? AND iemchannel = ?`, [interaction.channel.id, room], (err) => {
						if (err) {
							console.error(err.message);
							interaction.reply({ content: "Failed to unsubscribe from room", ephemeral: true });
						} else {
							interaction.reply({ content: `Unsubscribed from \`${getWFOByRoom(room).location}\``, ephemeral: true });
						}
					});
					break;
				case "list":
					db.all(`SELECT iemchannel, custommessage FROM channels WHERE channelid = ?`, [interaction.channel.id], (err, rows) => {
						if (err) {
							console.error(err.message);
							interaction.reply({ content: "Failed to list subscribed rooms", ephemeral: true });
						} else {
							let message = "";
							rows.forEach((row) => {
								message += `\`${row.iemchannel}\`: ${getWFOByRoom(row.iemchannel).location || "Unknown"} Custom Message: \`${row.custommessage || "None"}\`\n`;
							});
							if (message === "") {
								message = "No subscribed rooms";
							}
							interaction.reply({ content: message, ephemeral: true });
						}
					});
					break;
				case "setmessage":
					room = getWFOroom(interaction.options.getString("room"));
					if (!config.iem.channels.find((channel) => channel.jid.split("@")[0] === room)) {
						interaction.reply({ content: "Invalid room", ephemeral: true });
						return;
					}
					message = interaction.options.getString("message");
					db.run(`UPDATE channels SET custommessage = ? WHERE channelid = ? AND iemchannel = ?`, [message, interaction.channel.id, room], (err) => {
						if (err) {
							console.error(err.message);
							interaction.reply({ content: "Failed to set message", ephemeral: true });
						} else {
							interaction.reply({ content: `Message for ${getWFOByRoom(room).location} to \`${message}\``, ephemeral: true });
						}
					});
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
							description: `I listen to all the weather.im rooms and send them to discord channels.\nI am open source, you can find my code [here!](https://github.com/ChrisChrome/iembot-2.0)\n\nThough this is definitely a spiritual successor to NWSBot, we are not affiliated with NWSBot or the National Weather Service.`,
							fields: [
								{
									name: "Uptime",
									value: `Since <t:${Math.floor(startTimestap / 1000)}>, Started <t:${Math.floor(startTimestap / 1000)}:R>`,
								},
								{
									name: "Caught Messages",
									value: `Got ${messages} messages since startup`,
								},
								{
									name: "Guilds",
									value: guilds,
									inline: true
								},
								{
									name: "Subscribed Rooms",
									value: channels,
									inline: true
								},
								{
									name: "Unique Channels",
									value: uniques,
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
					// config.iem.channels.forEach((channel) => {
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
					config.iem.channels.forEach((channel) => {
						room = channel.jid.split("@")[0]
						roomList += `\`${room}\`: ${getWFOByRoom(room).location || "Unknown"}\n`;
					});
					const pages = roomList.match(/[\s\S]{1,2000}(?=\n|$)/g);
					const embeds = pages.map((page, ind) => ({
						title: `Available Rooms Pg ${ind + 1}/${pages.length}`,
						description: page,
						color: 0x00ff00
					}));
					interaction.reply({ embeds, ephemeral: true });
					break;
				case "setupall":
					if (!interaction.member.user.id === config.discord.owner) {
						interaction.reply({ content: "You are not the bot owner", ephemeral: true });
						return;
					};
					interaction.deferReply({ ephemeral: true })
					var category;

					// Create channels for all rooms
					const chunks = [];
					const chunkSize = 50;
					const totalRooms = config.iem.channels.length;
					for (let i = 0; i < totalRooms; i += chunkSize) {
						chunks.push(config.iem.channels.slice(i, i + chunkSize));
					}

					chunks.forEach((chunk, index) => {
						const categoryName = `Rooms ${index + 1}`;
						interaction.guild.channels.create({
							name: categoryName,
							type: Discord.ChannelType.GuildCategory
						}).then((newCategory) => {
							console.log(`${colors.cyan("[INFO]")} Created category ${newCategory.name}`);
							chunk.forEach((channel) => {
								channelName = getWFOByRoom(channel.jid.split("@")[0]).location
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



			}
			break;
		case Discord.InteractionType.MessageComponent:
			if (interaction.customId) {
				const product_id = interaction.customId;
				const url = `https://mesonet.agron.iastate.edu/api/1/nwstext/${product_id}`;
				fetch(url).then((res) => {
					if (res.status !== 200) {
						interaction.reply({ content: "Failed to get product text", ephemeral: true });
						return;
					}
					// Retruns raw text, paginate it into multiple embeds if needed
					res.text().then((text) => {
						const pages = text.match(/[\s\S]{1,2000}(?=\n|$)/g);
						const embeds = pages.map((page, ind) => ({
							title: `Product Text for ${product_id} Pg ${ind + 1}/${pages.length}`,
							description: `\`\`\`${page}\`\`\``,
							color: 0x00ff00
						}));
						interaction.reply({ embeds, ephemeral: true });
					});
				});
			}
			break;
	}

});

process.on("unhandledRejection", (error) => {
	console.log(`${colors.red("[ERROR]")} Unhandled Rejection: ${error.message}`);
});

process.on("uncaughtException", (error) => {
	console.log(`${colors.red("[ERROR]")} Uncaught Exception: ${error.message}`);
});

// Login to discord
discord.login(config.discord.token);