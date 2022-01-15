import * as utils from './utils';
import _ from 'lodash';
import * as polkadotCryptoUtils from '@polkadot/util-crypto';
import * as polkadotUtils from '@polkadot/util';
import BN from 'bn.js';
import { ClaimEvent, DotContribute } from './types';
import BigNumber from 'bignumber.js';
import Web3 from 'web3';
import EthCrypto from 'eth-crypto';

/*
import secondLockdropClaims from './data/raw/second-lockdrop-claims.json';
import additionalLockdropClaims from './data/bonus-reward-user-result.json';
import secondLockdropClaimEvents from './data/raw/lockdrop-claim-complete.json';
*/

import firstLockdropClaims from './data/raw/first-lockdrop-claims.json';
import firstLockdropLockEvent from './data/raw/lockdrop-first-event.json';

import secondLockdropLockEvent from './data/raw/lockdrop-second-event.json';
// at block no 3M
import plmBalanceSnapshot from './data/raw/plasm-balance-snapshot.json';

// vesting for lockdrop participants
// 1000 days: 7 months
// 30, 100, 300 days: 15 months

// vesting for all normal participants
// 88 weeks = 22 months
// todo: need data for address, amount, and vesting period

import lockdropParticipantPlmBalance from './data/lockdrop-participant-balances.json';
export default async function app() {
    const first = firstLockdropClaimToEvent();
    const second = await realtimeLockdropClaimToEvent();
    const both = [...first, ...second];

    //await utils.saveAsCsv(both);
    console.log({
        firstEvents: first.length,
        secondEvents: second.length,
        allEvents: both.length,
        uniqeAccounts: _.uniqBy(both, 'plasmAddress').length,
    });

    await utils.saveAsCsv(first, './first-lockdrop-claims');
}

const astarBasicReward = (contribution: DotContribute[]) => {
    const rewardMultiplier = new BigNumber('101.610752585225');

    const data = _.map(contribution, (i) => {
        const dotAmount = new BigNumber(i.contributed).div(new BigNumber(10).pow(10));
        const astrBaseReward = dotAmount.multipliedBy(rewardMultiplier);
        return {
            who: i.who,
            dotAmount: dotAmount.toFixed(),
            astrBaseReward: astrBaseReward.toFixed(),
            referer: i.memo,
            blockNumber: i.block_num,
        };
    });
    return data;
};

interface LockdropParticipant {
    transactionHash: string;
    ethAddress: string;
    // in ETH unit
    lockedEth: string;
    lockDuration: number;
    plasmAddress: string;
    // in PLM unit
    plmBalance: string;
}

const firstLockdropClaimToEvent = () => {
    const lockdropClaimData = firstLockdropClaims;
    const lockdropLockEvents = firstLockdropLockEvent;

    const lockdropCompleteInfo = _.map(lockdropClaimData, (i) => {
        const ethAddress = EthCrypto.publicKey.toAddress(i.public_key.replace('0x', ''));
        const plmAddress = utils.ss58FromEcdsaPublicKey(EthCrypto.publicKey.compress(i.public_key.replace('0x', '')));

        const allLockEventsByOwner = _.filter(lockdropLockEvents, (j) => {
            return j.lockOwner === ethAddress;
        });

        const plmAccountBalance = _.find(plmBalanceSnapshot, (j) => {
            return j.address === plmAddress;
        });

        const plmUnitBalance = plmAccountBalance
            ? new BigNumber(plmAccountBalance.balance).div(new BigNumber(10).pow(15))
            : new BigNumber(0);

        const lockdropReport = _.map(allLockEventsByOwner, (j) => {
            const ethUnitValue = Web3.utils.fromWei(j.eth, 'ether');
            return {
                transactionHash: j.transactionHash,
                ethAddress: ethAddress,
                lockedEth: ethUnitValue,
                lockDuration: j.duration,
                plasmAddress: plmAddress,
                plmBalance: plmUnitBalance.toFixed(),
            } as LockdropParticipant;
        });

        return lockdropReport;
    });

    return _.flatten(lockdropCompleteInfo);
};

const realtimeLockdropClaimToEvent = async () => {
    // read the csv raw data
    const lockdropClaimData = (await utils.readCsv(
        '/Users/hoonkim/Projects/substrate-cli/src/data/raw/plasm-realtime-lockdrop-recipients.csv',
    )) as { transaction_hash: string; account_id: string }[];
    const lockdropLockEvents = secondLockdropLockEvent;

    const lockdropCompleteInfo = _.map(lockdropClaimData, (i) => {
        // find the lock event
        const lockEvent = _.find(lockdropLockEvents, (j) => {
            return i.transaction_hash === j.transactionHash;
        });

        const plmAccount = _.find(plmBalanceSnapshot, (j) => {
            return j.address === i.account_id;
        });

        const plmUnitBalance = plmAccount
            ? new BigNumber(plmAccount.balance).div(new BigNumber(10).pow(15))
            : new BigNumber(0);
        const ethUnitValue = Web3.utils.fromWei(lockEvent ? lockEvent.eth : '0', 'ether');

        return {
            transactionHash: i.transaction_hash,
            ethAddress: lockEvent ? lockEvent.lockOwner : '',
            lockedEth: ethUnitValue,
            lockDuration: lockEvent ? lockEvent.duration : 0,
            plasmAddress: i.account_id,
            plmBalance: plmUnitBalance.toFixed(),
        } as LockdropParticipant;
    });

    return lockdropCompleteInfo;
};

/*
const lockdropParticipants = () => {
    const ADDRESS_PREFIX = utils.AddressPrefix.DOT_PREFIX;
    const firstLockdrop = firstLockdropClaims;
    const secondLockdrop = secondLockdropClaims;
    const secondLockdropClaimComplete = secondLockdropClaimEvents as ClaimEvent[];
    const additionalLockdrop = additionalLockdropClaims;

    const firstLockdropParticipants = _.map(firstLockdrop, (i) => {
        const compressedPubKey = EthCrypto.publicKey.compress(i['public key'].replace('0x', ''));
        // const eth = EthCrypto.publicKey.toAddress(compressedPubKey);
        const ss58 = utils.convertSs58Format(utils.ss58FromEcdsaPublicKey(compressedPubKey), 0);
        return { address: ss58 };
    });
    const secondLockdropParticipants = _.map(secondLockdrop, (i) => {
        const ss58 = utils.convertSs58Format(i.plasmAddress as string, ADDRESS_PREFIX);
        return { address: ss58 };
    });
    const secondLockdropFromEvent = _.map(secondLockdropClaimComplete, (i) => {
        const ss58 = utils.convertSs58Format('0x' + i.params[1].value, ADDRESS_PREFIX);
        return { address: ss58 };
    });

    const additionalLockdropApplicants = _.map(additionalLockdrop, (i) => {
        const ss58 = utils.convertSs58Format(i.targetBonusAddress, ADDRESS_PREFIX);
        return { address: ss58 };
    });

    const allParticipants = [
        ...firstLockdropParticipants,
        ...secondLockdropParticipants,
        ...secondLockdropFromEvent,
        ...additionalLockdropApplicants,
    ];
    return _.uniq(allParticipants);
};
*/

const durationToVestingSchedule = (startingBlock: number, totalAmount: BN, durationMonths: number) => {
    const ONE_MONTH = 28 * 24 * 60 * 60;
    const BLOCK_PER_SECOND = 12;
    // one month in block numbers
    const ONE_MONTH_BLOCKS_PER_12_SECONDS = ONE_MONTH / BLOCK_PER_SECOND;

    const totalVestedBlocks = ONE_MONTH_BLOCKS_PER_12_SECONDS * durationMonths;
    //console.log(totalVestedBlocks)
    // amount per block * total vested block number must equal the total amount
    const amountPerBlock = totalAmount.divn(totalVestedBlocks);

    return {
        locked: totalAmount,
        perBlock: amountPerBlock,
        startingBlock,
    };
};

const readCrowdloanRewardList = async () => {
    const data = (await utils.readCsv(
        '/Users/hoonkim/Projects/substrate-cli/report/astar-crowdloan-reward-88w.csv',
    )) as {
        account_id: string;
        amount: string;
        memo: string;
    }[];

    const res = _.map(data, (i) => {
        const polkadotAddress = utils.convertSs58Format(i.account_id, utils.AddressPrefix.DOT_PREFIX);
        //const amountInAstr = new BigNumber(i.amount).div(new BigNumber(10).pow(18));
        return {
            account_id: polkadotAddress,
            amount: i.amount,
            memo: i.memo,
        };
    });

    const onlyPartners = _.filter(res, (i) => {
        return i.memo !== '';
    });
    const withoutPartners = _.filter(res, (i) => {
        return i.memo === '';
    });

    await utils.saveAsCsv(onlyPartners, './crowdloan-partners.csv');
    await utils.saveAsCsv(withoutPartners, './crowdloan-rewards.csv');
};
