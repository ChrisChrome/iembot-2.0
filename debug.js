const Discord = require('discord.js');
const client = new Discord.Client({intents: ["Guilds"]})
const config = require('./config.json');

categories = ["1237806700879417416", "1237806701722337451", "1237806702473121853", "1237806703010123857"]

client.once('ready', () => {
	console.log('Ready!');
	client.guilds.cache.get("1237792259248750673").channels.cache.forEach(channel => {
		if (!channel.parent) return;
		if (categories.includes(channel.parent.id)) {
			channel.delete();
		}
	})
})

client.login(config.discord.token);