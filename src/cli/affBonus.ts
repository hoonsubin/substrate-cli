import { SubscanApi } from '../model/SubscanTypes';
import { LockEvent, FullClaimData, LockdropType } from '../model/EventTypes';
import _ from 'lodash';
import PlasmConnect from '../helper/plasmApi';
import * as PolkadotUtils from '@polkadot/util';
import { Claim as LockdropClaim } from '@plasm/types/interfaces';
import { defaultAddress, isValidIntroducerAddress } from '../data/affiliationAddress';
import claims from '../data/claim-complete.json';
import locks from '../data/eth-main-locks.json';
import allClaimData from '../data/claim-full-data.json';
import Introducer from '../model/LockdropIntroducer';
import { Utils, EthLockdrop, PlasmUtils } from '../helper';
import { Keyring } from '@polkadot/api';
import path from 'path';
import EthCrypto from 'eth-crypto';

const network: PlasmUtils.NodeEndpoint = 'Local';
const plasmApi = new PlasmConnect(network);

interface PlmTransaction {
    receiverAddress: string;
    sendAmount: string; // femto
}

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

const sendBatchTransaction = async (transactionList: PlmTransaction[], senderSeed: string) => {
    const keyring = new Keyring({ type: 'sr25519' });
    const origin = keyring.addFromSeed(PolkadotUtils.hexToU8a(senderSeed));

    const txVec = _.map(transactionList, (tx) => {
        return plasmApi.api.tx.balances.transfer(tx.receiverAddress, tx.sendAmount);
    });

    //const txHash = await plasmApi.api.tx.balances.
    const res = await plasmApi.api.tx.utility.batch(txVec).signAndSend(origin);
    return res;
};

const getLocksWithIntroducer = (claimList: FullClaimData[], affAddress?: string) => {
    // filter out the list with claims that has an introducer
    const locksWithIntroducer = _.filter(claimList, (i) => {
        const { introducer } = i.lockEvent;
        if (!isValidIntroducerAddress(introducer)) throw new Error(`Address ${introducer} is not a valid introducer`);

        return affAddress ? introducer === affAddress : introducer !== defaultAddress;
    });
    return locksWithIntroducer;
};

const getAllIntroducers = (claimList: FullClaimData[]) => {
    const locksWithIntroducer = getLocksWithIntroducer(claimList);

    // get all introducer addresses that was referenced by a lock
    const introducerAddrWithRef = _.uniq(
        _.map(locksWithIntroducer, (i) => {
            return i.lockEvent.introducer;
        }),
    );

    const introducers = _.map(introducerAddrWithRef, (introducerAddr) => {
        const referencedLocks = _.filter(locksWithIntroducer, (lock) => {
            return lock.lockEvent.introducer === introducerAddr;
        });

        const introducersLocks = _.filter(claimList, (lock) => {
            return lock.lockEvent.lockOwner === introducerAddr;
        });
        return new Introducer({ ethAddress: introducerAddr, locks: introducersLocks, references: referencedLocks });
    });

    return introducers;
};

const getPlmAddrFromPubKey = (introducerEthAddr: string, unCompPubKey: string[]) => {
    const pubKey = _.find(unCompPubKey, (i) => {
        const ethAddr = EthCrypto.publicKey.toAddress(EthCrypto.publicKey.compress(i.replace('0x', '')));
        return ethAddr === introducerEthAddr;
    });
    if (!pubKey) {
        //throw new Error('Failed to find public key for address ' + introducerEthAddr);
        console.warn('Cannot find pub key for ' + introducerEthAddr);
        return '';
    }

    return PlasmUtils.generatePlmAddress(EthCrypto.publicKey.compress(pubKey.replace('0x', '')));
};

// script entry point
export default async () => {
    // cast types for loaded JSON files
    const cachedClaimCompleteEv = (claims as unknown) as SubscanApi.Event[];
    const cachedLockEvents = (locks as unknown) as LockEvent[];

    // this contains both the lock event and the claim event
    const cachedClaimData = (allClaimData as unknown) as FullClaimData[];

    const firstLdPubKeys = (await Utils.loadCsv(path.join(process.cwd(), 'src', 'data', 'first-participant.csv'))).map(
        (i) => i.publicKey,
    );

    const introducers = getAllIntroducers(cachedClaimData);

    const introducerAddrs = introducers.map((intro) => {
        if (intro.locks.length > 0)
            return PlasmUtils.generatePlmAddress((intro.locks[0].params.publicKey as unknown) as string);
        return getPlmAddrFromPubKey(intro.ethAddress, firstLdPubKeys);
    });

    introducerAddrs.forEach((i) => {
        console.log(i);
    });

    //Utils.writeCache(introducers, 'introducer-data', process.cwd());

    console.log('finished');
};
