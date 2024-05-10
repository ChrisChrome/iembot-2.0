// load wfos.json, find all wfos that have a 3 character room code, and add `chat` to the end of room codes

const fs = require('fs');
const path = require('path');

const wfos = require('../wfos.json');

// wfos is an object of objects

// const newWfos = Object.keys(wfos).reduce((acc, key) => {
// 	const wfo = wfos[key];
// 	if (wfo.room.length === 3) {
// 		wfo.room = `${wfo.room}chat`;
// 	}
// 	acc[key] = wfo;
// 	return acc;
// }, {});

// Loop thru wfos and find locations that have </td> at the end, remove that
const newWfos = Object.keys(wfos).reduce((acc, key) => {
	const wfo = wfos[key];
	if (wfo.location.endsWith('</td>')) {
		wfo.location = wfo.location.slice(0, -5);
	}
	acc[key] = wfo;
	return acc;
}, {});


fs.writeFileSync(path.join(__dirname, 'wfos.json'), JSON.stringify(newWfos, null, 2));
