const { client, xml } = require("@xmpp/client");

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
const colors = require("colors");
//nwws@nwws-oi.weather.gov/nwws-oi
const xmpp = client({
	service: "xmpp://nwws-oi.weather.gov",
	domain: "weather.gov",
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
		const message = stanza.getChildText("body");
		const from = stanza.attrs.from;
		console.log(`${colors.green("[MESSAGE]")} ${from}: ${message}`);
	}
});

xmpp.on("online", async (address) => {

	errCount = 0;
	// Start listening on all channels, (dont ban me funny man)
	// for (const channel in iem.channels) {
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
	// Join all channels
	xmpp.send(xml("presence", { to: `nwws@nwws-oi.weather.gov/nwws-oi/${generateUUID()}` }, xml("item", { role: "visitor" })));

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

start()