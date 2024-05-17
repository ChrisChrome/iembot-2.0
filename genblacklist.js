const goodrooms = require("./goodrooms.json");
// goodrooms is an array of objects {room: string, name: string}
const { client, xml } = require("@xmpp/client");
const colors = require("colors");

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

const xmpp = client({
	service: "xmpp://conference.weather.im",
	domain: "weather.im",
	resource: `discord-weather-bot-${generateRandomString({ upper: true, lower: true, number: true }, 5)}`, // Weird fix to "Username already in use"
});

var blacklist = [];
var rooms = {};
xmpp.on("stanza", (stanza) => {
	// Debug stuff


	// Handle Room List
	if (stanza.is("iq") && stanza.attrs.type === "result" && stanza.getChild("query")) {
		query = stanza.getChild("query");
		if (query.attrs.xmlns === "http://jabber.org/protocol/disco#items") {
			query.getChildren("item").forEach((item) => {
				roomname = item.attrs.jid.split("@")[0];
				console.log(`${colors.cyan("[INFO]")} Found room: ${item.attrs.jid}`);
				// if room not in goodrooms list add to blacklist array
				if (!goodrooms.find(room => room.room === roomname)) {
					blacklist.push(item.attrs.jid);
					return console.log(`${colors.red("[INFO]")} Added room to blacklist: ${roomname}`);
				}

				// Get proper text name from goodrooms
				properName = goodrooms.find(room => room.room === roomname).name;
				console.log(properName)

				// room is in goodrooms, get first 3 of room name, add it to rooms object 3char: {room: roomname, name: name}
				rooms[roomname.substring(0, 3)] = { room: roomname, location: properName };
			});
			clearTimeout(start);
			start = setTimeout(() => {
				console.log(`${colors.green("[INFO]")} Blacklist: ${JSON.stringify(blacklist)}`);
				console.log(`${colors.green("[INFO]")} Rooms: ${JSON.stringify(rooms)}`);

				xmpp.stop();
			}, 5000);
		}
	}

});

xmpp.on("online", async (address) => {

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

var start = setTimeout(() => {
	console.log(`${colors.green("[INFO]")} Blacklist: ${blacklist}`);
	console.log(`${colors.green("[INFO]")} Rooms: ${rooms}`);
	xmpp.stop();
}, 5000);
xmpp.start().catch(console.error);
