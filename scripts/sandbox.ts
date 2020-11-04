import { SubscanApi } from '../src/models/SubscanTypes';
import { LockEvent, ClaimResult, FullClaimData, LockdropType } from '../src/models/EventTypes';
import _ from 'lodash';
import * as PlasmUtils from '../src/helper/plasmUtils';
import PlasmConnect from '../src/helper/plasmApi';
import fs from 'fs';
import * as PolkadotUtils from '@polkadot/util';
import { Claim as LockdropClaim } from '@plasm/types/interfaces';
import { isValidIntroducerAddress } from '../src/data/affiliationAddress';
import claims from './data/claim-complete.json';
import locks from './data/eth-main-locks.json';
import allClaimData from './data/claim-params.json';

const network: PlasmUtils.NodeEndpoint = 'Main';
const plasmApi = new PlasmConnect(network);

// cast types for loaded JSON files
const cachedClaimData = (allClaimData as unknown) as FullClaimData[];
const cachedClaimCompleteEv = (claims as unknown) as SubscanApi.Event[];
const cachedLockEvents = (locks as unknown) as LockEvent[];

const getEventParamValue = (eventList: SubscanApi.Event, type: string) => {
    const eventValue = eventList.params.find((i) => i.type === type)?.value;
    if (!eventValue) throw new Error('Could not find type ' + type);
    return eventValue;
};

const getClaimedTime = (claimId: string) => {
    const eventTime = _.find(cachedClaimCompleteEv, (i) => {
        return getEventParamValue(i, 'ClaimId') === claimId;
    });
    if (!eventTime) throw new Error('Could not fetch event time for ' + claimId);
    return {
        blockNumber: eventTime.block_num,
        timestamp: eventTime.block_timestamp,
    };
};

const getLockContractEvent = (transactionHash: string) => {
    const ethLog = _.find(cachedLockEvents, (lock) => {
        return lock.transactionHash === transactionHash;
    }) as LockEvent;
    if (!ethLog) throw new Error('Could not find contract event with the tx hash of ' + transactionHash);
    return ethLog;
};

const getFullClaimData = async (claimId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const claim = (await plasmApi.api.query.plasmLockdrop.claims(PolkadotUtils.hexToU8a(claimId))) as LockdropClaim;
    const { params } = claim;
    const blockEvTime = getClaimedTime(claimId);
    return {
        params: {
            type: LockdropType.Ethereum,
            transactionHash: params.transaction_hash,
            publicKey: params.public_key,
            duration: params.duration,
            value: params.value,
        },
        timestamp: blockEvTime.timestamp,
        blockNumber: blockEvTime.blockNumber,
        claimId,
        approve: claim.approve,
        decline: claim.decline,
        amount: claim.amount,
        complete: claim.complete.toHuman(),
        lockEvent: getLockContractEvent(params.transaction_hash.toHex()),
    } as FullClaimData;
};

const cacheObject = <T>(data: T, name?: string, path?: string) => {
    console.log('writing the data locally...');
    const dirName = `${path || __dirname}/${name || 'response'}.json`;
    fs.writeFileSync(dirName, JSON.stringify(data));
};

// script entry point
(async () => {
    await plasmApi.start();

    const claimIdList = _.map(cachedClaimCompleteEv, (claim) => {
        const claimId = getEventParamValue(claim, 'ClaimId');
        const claimedAddress = getEventParamValue(claim, 'AccountId');
        const amount = getEventParamValue(claim, 'Balance');
        return {
            claimId,
            claimedAddress,
            amount,
        };
    });

    // append introducer checks
    const locksWithAff = _.map(cachedClaimData, (claim) => {
        const lockOwner = claim.lockEvent.lockOwner;
        const claimedEvent = _.find(claimIdList, (i) => {
            return i.claimId === claim.claimId;
        });

        const isIntroducer = isValidIntroducerAddress(lockOwner);

        if (!lockOwner) throw new Error('No introducer found for claim ' + claim.claimId);
        if (!claimedEvent) throw new Error('No claimed event was found for ' + claim.claimId);

        return {
            claimData: claim,
            isIntroducer,
            claimedAddress: claimedEvent.claimedAddress,
        } as ClaimResult;
    });

    cacheObject(locksWithAff, 'claim-result');
    console.log('finished');
    process.exit(0);
})().catch((err) => {
    console.error(err);
});
