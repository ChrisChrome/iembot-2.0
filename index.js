const config = require("./config.json");
const { client, xml } = require("@xmpp/client");
const fetch = require("node-fetch");
const html = require("html-entities")
const Discord = require("discord.js");
var hook;
if (config.discord.enabled) {
	hook = new Discord.WebhookClient({ url: config.discord.webhook })
}
var startup = true;
const channel = config.iem.channel
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
	domain: "weather.im",
	resource: channel
});

//debug(xmpp, true);

xmpp.on("error", (err) => {
	console.log("ERROR")
	console.error(err);
	xmpp.start().catch(console.error);
});

xmpp.on("offline", () => {
	console.log("offline");
});




// Simple echo bot example
xmpp.on("stanza", (stanza) => {
	if (startup) return;
	// Get new messages and log them, ignore old messages
	if (stanza.is("message") && stanza.attrs.type === "groupchat") {
		if (!stanza.getChild("x")) return; // No PID, ignore it
		if (!stanza.getChild("x").attrs.product_id) return;
		const body = html.decode(stanza.getChildText("body"));
		// get product id from "x" tag
		const product_id = parseProductID(stanza.getChild("x").attrs.product_id);

		// Check timestamp, if not within 2 minutes, ignore it
		const now = new Date();
		const diff = (now - product_id.timestamp) / 1000 / 60;
		if (diff > 3) return;

		// Handle NTFY
		if (config.ntfy.enabled) {
			ntfyBody = {
				"topic": config.ntfy.topic,
				"message": body,
				"title": "New Alert",
				"priority": config.ntfy.priority,
				"tags": [`Station:${product_id.station}`, `WMO:${product_id.wmo}`, `PIL:${product_id.pil}`, `Channel:${channel}`],
			}

			if (stanza.getChild("x").attrs.twitter_media) {
				ntfyBody.attach = stanza.getChild("x").attrs.twitter_media;
			}
			if (body) {
				fetch(config.ntfy.server, {
					method: 'POST',
					body: JSON.stringify(ntfyBody)
				})
			}
		}

		// Handle Discord
		if (config.discord.enabled) {
			let embed = {
				title: "New Alert",
				description: body,
				color: 0x00ff00,
				timestamp: product_id.timestamp,
				footer: {
					text: `Station: ${product_id.station} WMO: ${product_id.wmo} PIL: ${product_id.pil} Channel: ${channel}`
				}
			}
			if (stanza.getChild("x").attrs.twitter_media) {
				embed.image = {
					url: stanza.getChild("x").attrs.twitter_media
				}
			}
			hook.send({
				embeds: [embed]
			});
		}
	}
});



xmpp.on("online", async (address) => {
	// Makes itself available
	await xmpp.send(xml("presence", { to: `${channel}@conference.weather.im/${channel}` }));
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
start();