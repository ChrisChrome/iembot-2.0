// Requires
const config = require("./config.json");
const { client, xml } = require("@xmpp/client");
const fetch = require("node-fetch");
const html = require("html-entities")
const Discord = require("discord.js");
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
		console.error(err.message);
	}
	console.log("Connected to the channels database.");
	// Create tables if they dont exist
	db.run(`CREATE TABLE IF NOT EXISTS channels (channelid TEXT, iemchannel TEXT, custommessage TEXT)`);
});

// Setup stuff
var startup = true;
// Random funcs
const parseProductID = function (product_id) {
	const [timestamp, station, wmo, pil] = product_id.split("-");
	return {
		timestamp: convertDate(timestamp),
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




const xmpp = client({
	service: "xmpp://conference.weather.im",
	domain: "weather.im"
});

//debug(xmpp, true);

xmpp.on("error", (err) => {
	console.log("ERROR")
	console.error(err);
	start();
});

xmpp.on("offline", () => {
	console.log("offline");
	start();
});


xmpp.on("stanza", (stanza) => {
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
		// get product id from "x" tag
		const product_id = parseProductID(stanza.getChild("x").attrs.product_id);
		// Check timestamp, if not within 3 minutes, ignore it
		const now = new Date();
		const diff = (now - product_id.timestamp) / 1000 / 60;
		if (diff > 3) return;
		let embed = {
			title: "New Alert",
			description: body,
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
						console.log(`Deleted channel ${row.channelid} from database`)
					});
				};
				channel.send({ content: row.custommessage, embeds: [embed] }).then((msg) => {
					if (msg.channel.type === Discord.ChannelType.GuildAnnouncement) msg.crosspost();
				})
			});
		});
	}
});



xmpp.on("online", async (address) => {
	// Start listening on all channels, (dont ban me funny man)
	// for (const channel in config.iem.channels) {
	// 	console.log(`Joining ${channel.name}`)
	// 	await xmpp.send(xml("presence", { to: `${channel.jud}/${channel.name}` }));
	// }

	// Join all channels
	config.iem.channels.forEach((channel => {
		console.log(`Joining ${channel.name}`)
		xmpp.send(xml("presence", { to: `${channel.jid}/${channel.jid.split("@")[0]}` }));
	}))

	console.log("online as", address.toString());

	setTimeout(() => {
		startup = false;
	}, 1000)
});

const start = () => {
	xmpp.start().catch((err) => {
		console.error(`start failed, ${err}\nGonna try again in 5 seconds...`);
		xmpp.stop();
		setTimeout(() => {
			start();
		}, 5000);
	});
}

// END XMPP

// START DISCORD

discord.on('ready', async () => {
	console.log(`Logged in as ${discord.user.tag}!`);
	// Do slash command stuff
	const commands = [
		{
			"name": "subscribe",
			"description": "Subscribe to a weather.im room",
			"default_member_permissions": 0,
			"options": [
				{
					"name": "room",
					"description": "The room you want to subscribe to",
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
					"description": "The room you want to set a message for",
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
					"description": "The room you want to unsubscribe from",
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
	switch(interaction.type) {
		case Discord.InteractionType.ApplicationCommand:
			if (!interaction.channel) return interaction.reply({ content: "This command can only be run in a text channel", ephemeral: true });
			if (interaction.channel.type !== Discord.ChannelType.GuildText && interaction.channel.type !== Discord.ChannelType.GuildAnnouncement) {
				interaction.reply({ content: "This command can only be run in a text channel", ephemeral: true });
				return;
			}
			switch (interaction.commandName) {
				case "subscribe":
					room = interaction.options.getString("room");
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
							interaction.reply({ content: "Subscribed to room", ephemeral: true });
						}
					});
					break;
				case "unsubscribe":
					// Check that the room is valid
					room = interaction.options.getString("room");
					if (!config.iem.channels.find((channel) => channel.jid.split("@")[0] === room)) {
						interaction.reply({ content: "Invalid room", ephemeral: true });
						return;
					}
					db.run(`DELETE FROM channels WHERE channelid = ? AND iemchannel = ?`, [interaction.channel.id, room], (err) => {
						if (err) {
							console.error(err.message);
							interaction.reply({ content: "Failed to unsubscribe from room", ephemeral: true });
						} else {
							interaction.reply({ content: "Unsubscribed from room", ephemeral: true });
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
								message += `Room: \`${row.iemchannel}\` Custom Message: \`\`${row.custommessage}\`\`\n`;
							});
							if (message === "") {
								message = "No subscribed rooms";
							}
							interaction.reply({ content: message, ephemeral: true });
						}
					});
					break;
				case "setmessage":
					room = interaction.options.getString("room");
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
							interaction.reply({ content: "Set message", ephemeral: true });
						}
					});
					break;
				case "about":
					// Send an embed showing info about the bot, including number of guilds, number of subscribed rooms, etc
					let guilds = discord.guilds.cache.size;
					let channels = 0;
					await db.get(`SELECT COUNT(*) as count FROM channels`, (err, row) => {
						channels = row.count
						const embed = {
							title: "About Me!",
							thumbnail: {
								url: discord.user.avatarURL()
							},
							description: `I am a bot that listens to weather.im alerts and sends them to discord channels.\nI am open source, you can find my code [here!](https://github.com/ChrisChrome/iembot-2.0)`,
							fields: [
								{
									name: "Guilds",
									value: guilds
								},
								{
									name: "Subscribed Rooms",
									value: channels
								}
							],
							color: 0x00ff00,
							footer: {
								text: "Made by @chrischrome with <3",
								icon_url: discord.users.cache.get("289884287765839882").avatarURL()
							}
						}
						interaction.reply({ embeds: [embed]});
					});
			}
			break;
	}

});
// Login to discord
discord.login(config.discord.token);