import * as utils from './utils';
import _ from 'lodash';
import * as polkadotCryptoUtils from '@polkadot/util-crypto';
import * as polkadotUtils from '@polkadot/util';
import { PlmRewardData, RewardData } from './types';
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

// transactions are enabled from 214310

// vesting for all normal participants
// 88 weeks = 22 months
// todo: need data for address, amount, and vesting period



export default async function app() {

    /*
    const plasmSnapshotList = (await utils.readCsv(
        '/Users/hoonkim/Downloads/astar-polkadot-plo-data/third-batch-vesting/astr-distribution-list-for-plasm.csv',
    )) as PlmRewardData[];
    
    const withoutSmallBalance = _.filter(plasmSnapshotList, (i) => {
        const balance = new BigNumber(i.amount);

        return balance.isGreaterThan(500);
    });

    const roundedRewards = _.map(withoutSmallBalance, (i) => {
        const balance = new BigNumber(new BigNumber(i.amount).toFixed(2, 1));
        return {
            account_id: i.account_id,
            amount: balance.toFixed(),
            vestingFor: i.vestingFor,
        };
    });

    const lockdropTierList = utils.splitLockdropTiers(roundedRewards);

    const tier1Vesting = utils.withTenPercentInitVal(lockdropTierList.tier1Vesting);
    const tier2Vesting = utils.withTenPercentInitVal(lockdropTierList.tier2Vesting);
    
    const totalValue = {
        tier1ShortVesting: utils.getTotalRewards(tier1Vesting.initialTransfers).toFixed(),
        tier1LongVesting: utils.getTotalRewards(tier1Vesting.vestedTransfers).toFixed(),
        tier2ShortVesting: utils.getTotalRewards(tier2Vesting.initialTransfers).toFixed(),
        tier2LongVesting: utils.getTotalRewards(tier2Vesting.vestedTransfers).toFixed(),
    }

    console.log(totalValue);
    await utils.saveAsCsv(tier1Vesting.initialTransfers, './lockdrop-tier1-short-vesting.csv');
    await utils.saveAsCsv(tier2Vesting.initialTransfers, './lockdrop-tier2-short-vesting.csv');
    await utils.saveAsCsv(tier1Vesting.vestedTransfers, './lockdrop-tier1-long-vesting.csv');
    await utils.saveAsCsv(tier2Vesting.vestedTransfers, './lockdrop-tier2-long-vesting.csv');
    */
}



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
