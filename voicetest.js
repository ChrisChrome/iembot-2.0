const Discord = require('discord.js');
const { Client, Intents } = require('discord.js');
const client = new Client({ intents: ["GuildVoiceStates", "Guilds"] });

const config =  require('./config.json');

const dVC = require('@discordjs/voice');
const { join } = require('path');

// get user input for url and channel
console.log(process.argv)

channelIN = process.argv[2];
urlIN = process.argv[3];

client.once('ready', () => {
    console.log("ready");
    JoinChannel(client.channels.cache.get(channelIN), urlIN);  
});

client.login(config.discord.token);

function JoinChannel(channel, track, volume) {
	const connection = dVC.joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
		selfDeaf: true
    });


    const resource = dVC.createAudioResource(track, {inlineVolume: true, silencePaddingFrames: 5});
    const player = dVC.createAudioPlayer();
	resource.volume.setVolume(2);
    connection.subscribe(player)
    player.play(resource);

    connection.on(dVC.VoiceConnectionStatus.Ready, () => {console.log("ready"); player.play(resource);})
    connection.on(dVC.VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
        try {
            console.log("Disconnected.")
            await Promise.race([
                dVC.entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                dVC.entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
            ]);
        } catch (error) {
            connection.destroy();
        }
    });
    player.on('error', error => {
        console.error(`Error: ${error.message} with resource ${error.resource.metadata.title}`);
        player.stop();
    });
    player.on(dVC.AudioPlayerStatus.Playing, () => {
        console.log('The audio player has started playing!');
    }); 
    player.on('idle', () => {
        connection.destroy();
    })
	console.log(player.state.resource.volume.volume)
}

function LeaveVoiceChannel(channel) {
	// Get resource, player, etc, and destroy them
	const connection = dVC.getVoiceConnection(channel.guild.id);
	if (connection) {
		connection.destroy();
	}
}