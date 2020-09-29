import { PlasmSubscan, Utils, PlasmUtils } from '../helper';
import fs from 'fs';
import PlasmConnect from '../helper/plasmApi';
import { Claim } from '../models/EventTypes';
import * as polkadotUtils from '@polkadot/util';

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

// script entry point
(async () => {
    await plasmApi.start();
    const cacheDir = `cache/${network}-claim-events.json`;

    const cachedEvents = Utils.loadCache<Claim>(cacheDir);

    console.log('Fetching all unclaimed requests...');
    // fetch all lock events
    const allData = await PlasmSubscan.fetchAllClaimData(plasmApi, cachedEvents);

    fs.writeFile(cacheDir, JSON.stringify(allData), function (err) {
        if (err) return console.error(err);
        console.log(`Successfully cached ${allData.length - cachedEvents.length} new events`);
    });

    const hanging = await PlasmSubscan.findHangingClaims(
        plasmApi,
        allData.filter((i) => {
            return !i.complete && i.approve.size > 0;
        }),
    );

    if (hanging.length > 0) {
        console.log(`There are ${hanging.length} hanging claims`);

        fs.writeFile(`cache/${network}-hanging-claims.json`, JSON.stringify(hanging), function (err) {
            if (err) return console.error(err);
            console.log('Successfully cached hanging events');
        });
        //await claimAllHangingReq(hanging);
    }
})()
    .catch((err) => {
        console.error(err);
    })
    .finally(async () => {
        const api = plasmApi.api;
        api.disconnect();
    });
