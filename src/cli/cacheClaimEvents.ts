import { PlasmEventScan, Utils, PlasmUtils } from '../helper';
import fs from 'fs';
import PlasmConnect from '../helper/plasmApi';
import { Claim } from '../model/EventTypes';
import { PlasmSubscan } from '../helper';
import _ from 'lodash';

const network: PlasmUtils.NodeEndpoint = 'Main';
const plasmApi = new PlasmConnect(network);

function cacheUnclaimed(claimReqs: Claim[]) {
    const cacheDir = `cache/${network}-unclaimed-requests.json`;
    const unclaimed = claimReqs.filter((call) => {
        return !call.complete;
    });
    const sorted = unclaimed.sort((a, b) => {
        return b.timestamp - a.timestamp;
    });
    const uniq = _.uniqBy(sorted, (call) => {
        return call.claimId;
    });

    fs.writeFile(cacheDir, JSON.stringify(uniq), function (err) {
        if (err) return console.error(err);
        console.log(`Successfully cached ${uniq.length} unclaimed requests`);
    });

    return uniq;
}

async function fetchClaimRequests() {
    await plasmApi.start();
    const cacheDir = `cache/${network}-all-claim-requests.json`;

    const cachedEvents = Utils.loadCache<Claim>(cacheDir);

    console.log('Fetching all unclaimed requests...');

    const data = await PlasmEventScan.fetchAllClaimData(plasmApi, cachedEvents);

    const newCalls = data.length - cachedEvents.length;

    if (newCalls > 0) {
        fs.writeFile(cacheDir, JSON.stringify(data), function (err) {
            if (err) return console.error(err);
            console.log(`Successfully cached ${data.length - cachedEvents.length} new events`);
        });

        const unclaimed = cacheUnclaimed(data);

        const hanging = await PlasmEventScan.findHangingClaims(plasmApi, unclaimed);

        if (hanging.length > 0) {
            console.log(`There are ${hanging.length} hanging claims`);

            fs.writeFile(`cache/${network}-hanging-claims.json`, JSON.stringify(hanging), function (err) {
                if (err) return console.error(err);
                console.log('Successfully cached hanging events');
            });
        }
    }
}

async function fetchClaimComplete() {
    const cacheDir = 'cache/claim-complete.json';
    const allEvents = await PlasmSubscan.fetchPlasmEvents('plasmlockdrop', 'claimcomplete', 100, 'all');

    console.log(allEvents);

    fs.writeFile(cacheDir, JSON.stringify(allEvents), function (err) {
        if (err) return console.error(err);
        console.log('fetched ' + allEvents.length + ' events');
    });
}

// script entry point
export default async () => {
    console.log('Fetching Plasm chain events...');
    await fetchClaimComplete();
};
