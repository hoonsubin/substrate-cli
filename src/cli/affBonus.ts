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
const keyring = new Keyring({ type: 'sr25519' });

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
    {
        // @rheeunion
        ethAddr: '0x3937B5F83f8e3DB413bD202bAf4da5A64879690F',
        plmAddr: 'bUUve83HysJPyXGfbAPcGdV2YujGPVMqZgM61fio4WTrQSs',
    },
    {
        // @Rafael
        ethAddr: '0xf5d7d97b33c4090a8cace5f7c5a1cc54c5740930',
        plmAddr: 'aerRsAR8oK3VwiA1TtaqTbeMc9TMFFVXiuSkb44n3P2PxKn',
    },
    {
        // @Jimmy Tudesky
        ethAddr: '0xa451fd5fcc0d389e0c27ff22845c0e17153f7dc8',
        plmAddr: 'bUVmJR3gu1hi9qa41pzFWWfFP4QVUYPyntNKjhort4BPovK',
    },
];

const getPlmAddrFromPubKey = async (introducerEthAddr: string, unCompPubKeyListDir: string) => {
    const firstLdPubKeys = (await Utils.loadCsv(unCompPubKeyListDir)).map((i) => i.publicKey);

    const pubKey = _.find(firstLdPubKeys, (i) => {
        const ethAddr = EthCrypto.publicKey.toAddress(EthCrypto.publicKey.compress(i.replace('0x', '')));
        return ethAddr.toLowerCase() === introducerEthAddr.toLowerCase();
    });
    if (!pubKey) {
        const addrFromKnown = _.find(
            knownPlmAddress,
            (i) => i.ethAddr.toLowerCase() === introducerEthAddr.toLowerCase(),
        )?.plmAddr;

        if (!addrFromKnown) console.warn('Cannot find pub key for ' + introducerEthAddr);
        // cross reference from known addresses
        return addrFromKnown || 'N/A';
    }

    return PlasmUtils.generatePlmAddress(EthCrypto.publicKey.compress(pubKey.replace('0x', '')));
};

const getRefRewardAmount = (introducer: Introducer) => {
    const allRefLocks = introducer.locks
        .filter((i) => i.lockEvent.introducer !== defaultAddress)
        .concat(introducer.references);
    const refRewards = _.map(allRefLocks, (lock) => {
        const lockReward = new BigNumber((lock.amount as unknown) as string).multipliedBy(introducer.bonusRate);

        const receivingPlmAddress = keyring.encodeAddress(PolkadotUtils.hexToU8a('0x' + lock.claimedAddress), 5);

        return {
            introducer: lock.lockEvent.introducer,
            receiverAddress: receivingPlmAddress,
            sendAmount: lockReward.toFixed(),
            lockTx: (lock.params.transactionHash as unknown) as string,
            claimId: lock.claimId,
        } as ReferenceReward;
    });

    return refRewards;
};

// script entry point
export default async () => {
    const dataSaveFolder = path.join(process.cwd(), 'report');
    // cast types for loaded JSON files
    const cachedClaimCompleteEv = (claims as unknown) as SubscanApi.Event[];
    const cachedLockEvents = (locks as unknown) as LockEvent[];

    // this contains both the lock event and the claim event
    const cachedClaimData = (allClaimData as unknown) as FullClaimData[];

    const introducers = getAllIntroducers(cachedClaimData);

    const refRewards = _.flatten(_.map(introducers, (i) => getRefRewardAmount(i)));

    const affRewards = await Promise.all(
        _.map(introducers, async (i) => {
            const ethAddress = i.ethAddress;
            const sendAmount = i.totalBonus;
            const receiverAddress = await getPlmAddrFromPubKey(
                ethAddress,
                path.join(process.cwd(), 'src', 'data', 'first-participant.csv'),
            );
            return {
                ethAddress,
                receiverAddress,
                sendAmount,
                numberOfRefs: i.references.length,
            } as AffiliationReward;
        }),
    );

    // record the data locally
    Utils.writeCache({ referenceBonus: refRewards, affiliationBonus: affRewards }, 'bonus-reward-data', dataSaveFolder);

    Utils.writeCsv(refRewards, 'reference-rewards', dataSaveFolder);
    Utils.writeCsv(affRewards, 'affiliation-rewards', dataSaveFolder);

    console.log('finished');
};
