const { client, xml } = require("@xmpp/client");
const fetch = require("node-fetch");
const html = require("html-entities")
var startup = true;
const channel = "botstalk"
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
	console.log(`new msg`)
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
		console.log(diff)
		if (diff > 3) return;
		//
		ntfyBody = {
			"topic": "iem",
			"message": body,
			"title": "New Alert",
			"priority": 3
		}
		console.log(stanza.getChild("x"))
		if (stanza.getChild("x").attrs.twitter_media) {
			ntfyBody.attach = stanza.getChild("x").attrs.twitter_media;
			console.log("Image attached")
		}
		if (body) {
			console.log(body)
			fetch('https://ntfy.chrischro.me', {
				method: 'POST',
				body: JSON.stringify(ntfyBody)
			})
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

xmpp.start().catch(console.error);