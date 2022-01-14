import * as utils from './utils';
import _ from 'lodash';
import * as polkadotCryptoUtils from '@polkadot/util-crypto';
import * as polkadotUtils from '@polkadot/util';
import BN from 'bn.js';
import EthCrypto from 'eth-crypto';
import { ClaimEvent } from './types';
import BigNumber from 'bignumber.js';

/*
import firstLockdropClaims from './data/raw/first-lockdrop-claims.json';
import secondLockdropClaims from './data/raw/second-lockdrop-claims.json';
import additionalLockdropClaims from './data/bonus-reward-user-result.json';
import secondLockdropClaimEvents from './data/raw/lockdrop-claim-complete.json';
*/

// vesting for lockdrop participants
// 1000 days: 7 months
// 30, 100, 300 days: 15 months

// vesting for all normal participants
// 96 weeks = 24 months
// todo: need data for address, amount, and vesting period

export default async function app() {
    const data = (await utils.readCsv(
        '/Users/hoonkim/Projects/substrate-cli/src/data/crowdloan-reward-96weeks.csv',
    )) as { address: string; amount: string; memo: string }[];

    const res = _.map(data, (i) => {
        const astarAddress = utils.convertSs58Format(i.address, utils.AddressPrefix.ASTR_PREFIX);
        const amountInAstr = new BigNumber(i.amount).div(new BigNumber(10).pow(18));
        return {
            account_id: astarAddress,
            amount: amountInAstr.toFixed(),
        };
    });

    await utils.saveAsCsv(res);
}

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
