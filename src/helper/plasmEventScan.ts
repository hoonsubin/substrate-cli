import _ from 'lodash';
import PlasmConnect from './plasmApi';
import { Claim } from '../models/EventTypes';

export async function fetchAllClaimData(plasmApi: PlasmConnect, prevEvents: Claim[] = []) {
    // fetch from the highest blocknumber in cache
    let reqEvents = await plasmApi.fetchClaimRequestCall(prevEvents.length > 0 && prevEvents[0].blockNumber);

    reqEvents = reqEvents.concat(prevEvents);

    // ensure no duplicates are there
    const cleanList = _.uniqBy(reqEvents, (i) => {
        return i.claimId;
    });
    return cleanList;
}

export async function findHangingClaims(
    plasmApi: PlasmConnect,
    claimData: Claim[],
    validatorWaitTime: number = 30 * 60,
) {
    const { voteThreshold, positiveVotes } = await plasmApi.getLockdropVoteRequirements();

    const hanging = claimData.filter((i) => {
        const isClaimHanging = i.approve.size - i.decline.size < voteThreshold || i.approve.size < positiveVotes;
        const isValidClaim = i.approve.size > 0;
        const isVoteLate = i.timestamp + validatorWaitTime < Date.now().valueOf() / 1000;
        //console.log(`Claim ${i.claimId} has ${i.approve.size} approvals and ${i.decline.size} disapprovals`);

        return (
            (isClaimHanging && isVoteLate && isValidClaim) ||
            (i.approve.size === 0 && i.decline.size === 0 && isVoteLate)
        );
    });

    return hanging;
}
