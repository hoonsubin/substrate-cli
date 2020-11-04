import { SubscanApi } from '../src/models/SubscanTypes';
import { LockEvent, Claim, LockdropType } from '../src/models/EventTypes';
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

const getEventParamValue = (eventList: SubscanApi.Event, type: string) => {
    const eventValue = eventList.params.find((i) => i.type === type)?.value;
    if (!eventValue) throw new Error('Could not find type ' + type);
    return eventValue;
};

const getClaimedTime = (claimId: string) => {
    const eventTime = _.find(claims as SubscanApi.Event[], (i) => {
        return getEventParamValue(i, 'ClaimId') === claimId;
    });
    return {
        blockNumber: eventTime.block_num,
        timestamp: eventTime.block_timestamp,
    };
};

const getClaimData = async (claimId: string) => {
    console.log('fetching claim data from chain...');
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
    } as Claim;
};

// script entry point
(async () => {
    await plasmApi.start();
    const claimIdList = _.map(claims as SubscanApi.Event[], (claim) => {
        const claimId = getEventParamValue(claim, 'ClaimId');
        const claimedAddress = getEventParamValue(claim, 'AccountId');
        const amount = getEventParamValue(claim, 'Balance');
        return {
            claimId,
            claimedAddress,
            amount,
        };
    });

    const claimParams = allClaimData as { claimData: Claim; claimedAddress: string }[];

    // only get locks with a valid introducer
    const locksWithAff = _.filter(locks as LockEvent[], (lock) => {
        return isValidIntroducerAddress(lock.introducer);
    });

    const claimsWithAff = _.map(claimParams, (i) => {
        // filter claims with an introducer address
        const _claimsWithAff = _.filter(claimParams, (claim) => {
            const hasAff = _.find(locksWithAff, (i) => {
                return i.transactionHash === claim.claimData.params.transactionHash.toHex();
            });
            return !!hasAff;
        });
    });

    //console.log(claimsWithAff);
    console.log('writing the data locally...');
    const resFile = `${__dirname}/response.json`;
    fs.writeFileSync(resFile, JSON.stringify(locksWithAff));
    console.log('finished');
    process.exit(0);
})().catch((err) => {
    console.error(err);
});
