import { SubscanApi } from '../src/models/SubscanTypes';
import { LockEvent, Claim, LockdropType } from '../src/models/EventTypes';
import claims from './data/claim-complete.json';
import locks from './data/eth-main-locks.json';
import _ from 'lodash';
import * as PlasmUtils from '../src/helper/plasmUtils';
import PlasmConnect from '../src/helper/plasmApi';
import fs from 'fs';
import * as PolkadotUtils from '@polkadot/util';
import { Claim as LockdropClaim } from '@plasm/types/interfaces';

const network: PlasmUtils.NodeEndpoint = 'Main';
const plasmApi = new PlasmConnect(network);

const getEventParamValue = (eventList: SubscanApi.Event, type: string) => {
    const eventValue = eventList.params.find((i) => i.type === type)?.value;
    if (!eventValue) throw new Error('Could not find type ' + type);
    return eventValue;
};

const getClaimData = async (claimId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const claim = (await plasmApi.api.query.plasmLockdrop.claims(PolkadotUtils.hexToU8a(claimId))) as LockdropClaim;
    const { params } = claim;
    return {
        params: {
            type: LockdropType.Ethereum,
            transactionHash: params.transaction_hash,
            publicKey: params.public_key,
            duration: params.duration,
            value: params.value,
        },
        timestamp: Date.now(),
        blockNumber: 0,
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
    const claimParams = await Promise.all(
        _.map(claimIdList, async (claim) => {
            const claimData = await getClaimData(claim.claimId);
            return { claimData, claimedAddress: claim.claimedAddress };
        }),
    );

    const claimsWithAff = _.filter(claimParams, (claim) => {});

    console.log(claimParams);

    const resFile = `response.json`;
    fs.writeFile(resFile, JSON.stringify(claimParams), function (err) {
        if (err) return console.error(err);
        console.log('Saved data to a local json file');
    });

    process.exit(0);
})().catch((err) => {
    console.error(err);
});
