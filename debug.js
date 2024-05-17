const Discord = require('discord.js');
const client = new Discord.Client({intents: ["Guilds"]})
const config = require('./config.json');

categories = ["1237807432311373895", "1237807432709963807", "1237807433678590023", "1237807434425434164"]

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