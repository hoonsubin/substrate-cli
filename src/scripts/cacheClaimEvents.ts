import { PlasmSubscan } from '../helper';
import fs from 'fs';

// script entry point
(async () => {
    const cacheDir = 'cache/claim-request-event.json';
    console.log('fetching claim events...');
    const allEvents = await PlasmSubscan.fetchPlasmEvents('plasmlockdrop', 'claimrequest', 100, 'all');

    //console.log(allEvents);

    fs.writeFile(cacheDir, JSON.stringify(allEvents), function (err) {
        if (err) return console.error(err);
        console.log('fetched ' + allEvents.length + ' events');
    });
})().catch((err) => {
    console.log(err);
});
