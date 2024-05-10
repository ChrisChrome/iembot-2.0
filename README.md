[![Join our Discord](https://img.shields.io/discord/1237792259248750673?color=7289DA&label=Discord&logo=discord&logoColor=white&style=for-the-badge)](https://discord.gg/v7aR9MTau8) [![Add the bot](https://img.shields.io/badge/Add%20Bot-Click%20Here-brightgreen?style=for-the-badge&logo=discord&color=7289DA&logoColor=white)](https://discord.com/oauth2/authorize?client_id=1237621947529957426)

## Warning
This is SUPER tossed together. Might bother cleaning it up later.

## What is this?
This is meant to be a public Discord bot. It connects via XMPP to Weather.IM and allows server owners to subscribe a channel to any number of weather alerts.

## Pre-requisites
1. Node.js
2. NPM
3. A Discord bot token

## How do I use this?
1. Clone the repo
2. Install the requirements with `npm install`
3. Copy `config.example.json` to `config.json` and fill in the values
	- `token` is your Discord bot token
	- `owner` is your Discord user ID
	- `mainGuild` is the ID of the guild you want to use as the main guild (This is used for making the support invite)
	- `inviteChannel` is the ID of the channel you want to use for the support invite
	- NTFY config is optional, leave enabled false if you don't want to use it or don't know how.
4. Run `node .`
5. Profit?

## TODO
- [ ] Clean up the code
- [X] Add more error handling
- [X] Add more logging
- [X] Add more features
- [X] Add more documentation