const Discord = require('discord.js');
const client = new Discord.Client({intents: ["Guilds"]})
const config = require('./config.json');

categories = ["1237805446019154003", "1237805447004553266", "1237805448128630795", "1237805449089384508"]

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