import { SubscanApi } from '../model/SubscanTypes';
import { LockEvent, FullClaimData, LockdropType } from '../model/EventTypes';
import { PlmTransaction, AffiliationReward, ReferenceReward } from '../model/AffiliateReward';
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
import BigNumber from 'bignumber.js';

const network: PlasmUtils.NodeEndpoint = 'Local';
const plasmApi = new PlasmConnect(network);

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

const knownPlmAddress = [
    {
        ethAddr: '0x9498db340a3ecab7bb0973ee36e95e58c8e58a41',
        plmAddr: 'Xp5rb4ioj84w8CUL2hZ95BGih4AT1NVDt1av6hZwKrR8n8t',
    },
    {
        ethAddr: '0xF22b286fdA7369255376742f360fFCEE4e1FBD42',
        plmAddr: 'Zw2EAFAXyeNwzzC6FS5baNMADcUExShmPTBk3UAbH8VtNoU',
    },
    {
        ethAddr: '0x55763D6dB54736084c1B8d010Aa1d99F0DC6d07C',
        plmAddr: 'aQUgPgajuzeEgk1FEbpNCDhCd9seUftaXQ7hrXWdoXnCUkf',
    },
    {
        ethAddr: '0x9F4f9E15a4A963a9a3885979Cc64B326dCAa18A8',
        plmAddr: 'VxwWY69vTJ4chHoaEfHaUVSQ3BeJNtLFYByhKaRPefujSz6',
    },
    {
        ethAddr: '0x1080355C93A1B4c0Dd3c340Eed4f7E514c583077',
        plmAddr: 'YwnuNtrGcHa7jxz4jLibeCxxrqKcrUurYAjM2GTLVPr3Kbf',
    },
];

const getPlmAddrFromPubKey = (introducerEthAddr: string, unCompPubKey: string[]) => {
    const pubKey = _.find(unCompPubKey, (i) => {
        const ethAddr = EthCrypto.publicKey.toAddress(EthCrypto.publicKey.compress(i.replace('0x', '')));
        return ethAddr === introducerEthAddr;
    });
    if (!pubKey) {
        //throw new Error('Failed to find public key for address ' + introducerEthAddr);
        console.warn('Cannot find pub key for ' + introducerEthAddr);
        // cross reference from known addresses
        return _.find(knownPlmAddress, (i) => i.ethAddr === introducerEthAddr)?.plmAddr || introducerEthAddr;
    }

    return PlasmUtils.generatePlmAddress(EthCrypto.publicKey.compress(pubKey.replace('0x', '')));
};

const getRewardAmount = (introducer: Introducer) => {
    const allRefLocks = introducer.locks.concat(introducer.references);
    const refRewards = _.map(allRefLocks, (lock) => {
        const lockReward = new BigNumber((lock.amount as unknown) as string);
        // todo: hash the claim address to be substrate compatible
        const receivingPlmAddress = lock.claimedAddress;
    });
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
