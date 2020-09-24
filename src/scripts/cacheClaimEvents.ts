import { PlasmSubscan, Utils, PlasmUtils } from '../helper';
import fs from 'fs';
import PlasmConnect from '../helper/plasmApi';
import { SubscanApi } from '../models/SubscanTypes';
import * as polkadotUtils from '@polkadot/util';

const plasmApi = new PlasmConnect('Main');

const claimAllHangingReq = async (eventData: SubscanApi.ClaimReqEvent[]) => {
    const { voteThreshold, positiveVotes } = await plasmApi.getLockdropVoteRequirements();

    const claimData = await Promise.all(
        eventData.map(async (i) => {
            const claimData = await plasmApi.getClaimData(polkadotUtils.hexToU8a(i.claimId));

            return claimData;
        }),
    );

    claimData.forEach(async (i, index) => {
        const isClaimHanging =
            (!i.complete && i.approve.size - i.decline.size < voteThreshold) || i.approve.size < positiveVotes;

        if (isClaimHanging) {
            const claimId = eventData[index].claimId;
            const claimPoWNonce = PlasmUtils.claimIdToNonceString(claimId);
            const hash = await plasmApi.sendLockClaimRequest(i.params, polkadotUtils.hexToU8a(claimPoWNonce));
            console.log(`Send claim request for ${claimId} with extrinsic hash of ${hash.toHex()}`);
        }
    });
};

// script entry point
(async () => {
    // const cacheDir = 'cache/claim-request-event.json';
    // const cachedEvents = Utils.loadCache<SubscanApi.ClaimReqEvent>(cacheDir);
    // console.log('Fetching claim events...');
    // const allEvents = await PlasmSubscan.fetchPlasmEvents('plasmlockdrop', 'claimrequest', 100, cachedEvents);

    await PlasmSubscan.fetchClaimRequestCall(plasmApi);

    // const unclaimed = await PlasmSubscan.filterClaimed(plasmApi, allEvents);

    // //console.log(allEvents);

    // fs.writeFile(cacheDir, JSON.stringify(unclaimed), function (err) {
    //     if (err) return console.error(err);
    //     console.log('fetched ' + unclaimed.length + ' unclaimed events');
    // });

    // await claimAllHangingReq(plasmApi, unclaimed);
})()
    .catch((err) => {
        console.error(err);
    })
    .finally(async () => {
        const api = await plasmApi.api;
        api.disconnect();
    });
