import { PlasmSubscan, Utils, PlasmUtils } from '../helper';
import fs from 'fs';
import PlasmConnect from '../helper/plasmApi';
import { Claim } from '../models/EventTypes';
import * as polkadotUtils from '@polkadot/util';
import _ from 'lodash';

const network: PlasmUtils.NodeEndpoint = 'Main';
const plasmApi = new PlasmConnect(network);

async function claimAllHangingReq(hangingClaims: Claim[]) {
    const res = await Promise.all(
        hangingClaims.map(async (i) => {
            const claimNonce = PlasmUtils.claimPowNonce(polkadotUtils.hexToU8a(i.claimId));
            const hash = await plasmApi.sendLockClaimRequest(i.params, claimNonce);
            return {
                hash,
                claimId: i.claimId,
            };
        }),
    );

    res.forEach((i) => {
        console.log(`Sent claim request for ${i.claimId} with the hash ${i.hash.toHex()}`);
    });
}

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

// script entry point
(async () => {
    await plasmApi.start();
    const cacheDir = `cache/${network}-all-claim-requests.json`;

    const cachedEvents = Utils.loadCache<Claim>(cacheDir);

    console.log('Fetching all unclaimed requests...');

    const data = await PlasmSubscan.fetchAllClaimData(plasmApi, cachedEvents);

    const newCalls = data.length - cachedEvents.length;

    if (newCalls > 0) {
        fs.writeFile(cacheDir, JSON.stringify(data), function (err) {
            if (err) return console.error(err);
            console.log(`Successfully cached ${data.length - cachedEvents.length} new events`);
        });

        const unclaimed = cacheUnclaimed(data);

        const hanging = await PlasmSubscan.findHangingClaims(plasmApi, unclaimed);

        if (hanging.length > 0) {
            console.log(`There are ${hanging.length} hanging claims`);

            fs.writeFile(`cache/${network}-hanging-claims.json`, JSON.stringify(hanging), function (err) {
                if (err) return console.error(err);
                console.log('Successfully cached hanging events');
            });
            await claimAllHangingReq(hanging);
        }
    }
})()
    .catch((err) => {
        console.error(err);
    })
    .finally(async () => {
        const api = plasmApi.api;
        api.disconnect();
    });
