import { SubscanApi } from '../src/models/SubscanTypes';
import { LockEvent, FullClaimData, LockdropType } from '../src/models/EventTypes';
import _ from 'lodash';
import * as PlasmUtils from '../src/helper/plasmUtils';
import PlasmConnect from '../src/helper/plasmApi';
import fs from 'fs';
import * as PolkadotUtils from '@polkadot/util';
import { Claim as LockdropClaim } from '@plasm/types/interfaces';
import { defaultAddress, isValidIntroducerAddress } from '../src/data/affiliationAddress';
import claims from './data/claim-complete.json';
import locks from './data/eth-main-locks.json';
import allClaimData from './data/claim-full-data.json';

const network: PlasmUtils.NodeEndpoint = 'Local';
const plasmApi = new PlasmConnect(network);

const cacheObject = <T>(data: T, name?: string, path?: string) => {
    console.log('writing the data locally...');
    const dirName = `${path || __dirname}/${name || 'response'}.json`;
    fs.writeFileSync(dirName, JSON.stringify(data));
};

const getEventParamValue = (eventList: SubscanApi.Event, type: string) => {
    const eventValue = eventList.params.find((i) => i.type === type)?.value;
    if (!eventValue) throw new Error('Could not find type ' + type);
    return eventValue;
};

const fetchClaimData = async (claimId: string) => {
    return (await plasmApi.api.query.plasmLockdrop.claims(PolkadotUtils.hexToU8a(claimId))) as LockdropClaim;
};

const appendFullClaimData = (claim: LockdropClaim, claimEvent: SubscanApi.Event, lockEvent: LockEvent) => {
    const claimId = getEventParamValue(claimEvent, 'ClaimId');
    const claimedAddress = getEventParamValue(claimEvent, 'AccountId');

    const { params } = claim;

    return {
        params: {
            type: LockdropType.Ethereum,
            transactionHash: params.transaction_hash,
            publicKey: params.public_key,
            duration: params.duration,
            value: params.value,
        },
        timestamp: claimEvent.block_timestamp,
        blockNumber: claimEvent.block_num,
        claimId,
        approve: claim.approve,
        decline: claim.decline,
        amount: claim.amount,
        complete: claim.complete.toHuman(),
        lockEvent,
        claimedAddress,
        isIntroducer: isValidIntroducerAddress(lockEvent.lockOwner),
    } as FullClaimData;
};

const fetchAllClaims = async (lockEvents: LockEvent[], claimEvents: SubscanApi.Event[]) => {
    const allClaims = await Promise.all(
        _.map(claimEvents, async (claimEvent) => {
            const id = getEventParamValue(claimEvent, 'ClaimId');
            const claimData = await fetchClaimData(id);
            const lockEvent = _.find(lockEvents, (lockEv) => {
                return lockEv.transactionHash === claimData.params.transaction_hash.toHex();
            });
            if (!lockEvent) throw new Error('Could not find a lock event for claim ' + id);
            return {
                claimData,
                lockEvent,
                claimEvent,
            };
        }),
    );

    const appendData = _.map(allClaims, (i) => {
        return appendFullClaimData(i.claimData, i.claimEvent, i.lockEvent);
    });

    return appendData;
};

const getLocksWithIntroducer = (claimList: FullClaimData[], affAddress?: string) => {
    // filter out the list with claims that has an introducer
    const locksWithIntroducer = _.filter(claimList, (i) => {
        const { introducer } = i.lockEvent;
        return affAddress ? introducer === affAddress : introducer !== defaultAddress;
    });
    return locksWithIntroducer;
};

// script entry point
(async () => {
    // cast types for loaded JSON files
    const cachedClaimCompleteEv = (claims as unknown) as SubscanApi.Event[];
    const cachedLockEvents = (locks as unknown) as LockEvent[];

    // this contains both the lock event and the claim event
    const cachedClaimData = (allClaimData as unknown) as FullClaimData[];

    // we only need this when we're calling a function that uses it
    // await plasmApi.start();
    // const fullData = await fetchAllClaims(cachedLockEvents, cachedClaimCompleteEv);
    // cacheObject(fullData, 'claims-with-aff');

    const locksWithIntroducer = getLocksWithIntroducer(cachedClaimData);

    const referencedIntroducers = _.uniq(
        _.map(locksWithIntroducer, (i) => {
            return i.lockEvent.introducer;
        }),
    );

    console.log('finished');
    process.exit(0);
})().catch((err) => {
    console.error(err);
});
