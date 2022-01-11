import * as polkadotUtils from '@polkadot/util-crypto';
import ksmCrowdloan from '../data/raw/kusama-crowdloan.json';
import dotCrowdloan from '../data/raw/polkadot-crowdloan.json';
import plmLockdrop from '../data/raw/lockdrop-claim-complete.json';
import ksmCrowdloandParticipants from '../data/ksm-crowdloan-participants.json';
import plmLockdropParticipants from '../data/lockdrop-participants.json';
import dotCrowdloandParticipants from '../data/dot-crowdloan-participants.json';
import sdnSnapshot from '../data/sdn-balance-snapshot-753857.json';
import sdnKsmReward from '../data/sdn-ksm-crowdloan-reward.json';
import _ from 'lodash';
import BN from 'bn.js';
import { KsmCrowdloan, ClaimEvent, DotContribute } from '../types';

const KSM_PREFIX = 2;
const ASTR_PREFIX = 5;
const DOT_PREFIX = 0;

// local json storage
export const KSM_CROWDLOAN_DB = ksmCrowdloan as KsmCrowdloan[];
export const DOT_CROWDLOAN_DB = dotCrowdloan as DotContribute[];
export const PLM_LOCKDROP_DB = plmLockdrop as ClaimEvent[];

export const KSM_CROWDLOAN_PARTICIPANTS = ksmCrowdloandParticipants as { address: string }[];
export const DOT_CROWDLOAN_PARTICIPANTS = dotCrowdloandParticipants as { address: string }[];
export const PLM_LOCKDROP_PARTICIPANTS = plmLockdropParticipants as { address: string }[];

export const SDN_KSM_REWARD_DB = sdnKsmReward as { account_id: string; amount: string }[];
export const SDN_SNAPSHOT_DB = sdnSnapshot as { address: string; balance: string }[];

export const didParticipateInKsm = (polkadotAddress: string) => {
    // convert polkadot address to kusama address
    const ksmAddr = polkadotUtils.encodeAddress(polkadotAddress, KSM_PREFIX);
    const participation = _.find(KSM_CROWDLOAN_PARTICIPANTS, (i) => {
        return i.address === ksmAddr;
    });

    return !!participation;
};

export const getKsmParticipants = (contributors: KsmCrowdloan[]) => {
    return _.uniq(
        _.map(contributors, (i) => {
            return i.account_id;
        }),
    );
};

export const didParticipateInLockdrop = (polkadotAddress: string) => {
    const participation = _.find(PLM_LOCKDROP_PARTICIPANTS, (i) => {
        // ensure the address in the database is ecoded in polkdaot prefix
        const lockdropDotAddr = polkadotUtils.encodeAddress(i.address, DOT_PREFIX);
        return lockdropDotAddr === polkadotAddress;
    });

    return !!participation;
};

export const getLockdropParticipants = (lockClaimEv: ClaimEvent[]) => {
    return _.uniq(
        _.map(lockClaimEv, (i) => {
            // convert public key hex to polkadot address
            // i.params[1].value = hex public key
            const dotAddr = polkadotUtils.encodeAddress('0x' + i.params[1].value, DOT_PREFIX);
            return dotAddr;
        }),
    );
};

// returns the number of referrals based on the referred accounts
export const getReferrals = (contributions: DotContribute[]) => {
    const contributionWithRefs = _.map(
        _.filter(contributions, (i) => {
            // filter contributions where it has a referral and the referral is not the contributor
            return !!i.memo && polkadotUtils.encodeAddress('0x' + i.memo, DOT_PREFIX) !== i.who;
        }),
        (j) => {
            return {
                contributor: j.who,
                referred: polkadotUtils.encodeAddress('0x' + j.memo, DOT_PREFIX),
            };
        },
    );

    // get a list of a referrals without duplication
    const refs = _.uniq(
        _.map(contributionWithRefs, (i) => {
            return i.referred;
        }),
    );

    const accountsWithReferrals = _.map(refs, (i) => {
        // get a list of accounts that uses the current address (i) as the referral
        const DotContributeRefs = _.filter(contributionWithRefs, (j) => {
            return j.referred === i;
        });
        return {
            reference: i,
            // only return unique referrals (note: do we want to allow multiple referrals?)
            referrals: _.uniq(
                _.map(DotContributeRefs, (j) => {
                    return j.contributor;
                }),
            ),
        };
    });

    return accountsWithReferrals;
};

const canGetSdnBonus = (account: string) => {
    // ensure that the provided account is in the correct format
    const sdnAccount = polkadotUtils.encodeAddress(account, ASTR_PREFIX);

    // note: I know this is ridiculously inefficient
    const ksmCrowdloanReward = _.find(SDN_KSM_REWARD_DB, (i) => {
        return i.account_id === sdnAccount;
    });

    // search through the snapshot
    const currentBalance = _.find(SDN_SNAPSHOT_DB, (i) => {
        return i.address === sdnAccount;
    });

    // get the balance information for SDN at the reward and at the end of the polkadot auction
    const balDiff = {
        sdnReward: new BN(ksmCrowdloanReward ? ksmCrowdloanReward.amount : '0'),
        currentSdn: new BN(currentBalance ? currentBalance.balance : '0'),
    };

    // accounts can have up to 0.1 SDN difference in their balance for the bonus
    const rewardBuffer = new BN(10).pow(new BN(17));

    // can get bonus if currentBal >= sdnReward - 0.1 SDN
    return balDiff.currentSdn.gte(balDiff.sdnReward.sub(rewardBuffer));
};

export const calculateBonusRewards = (contributor: DotContribute) => {
    let totalBonus = new BN(0);

    // calculate early bird bonus
    if (contributor.block_num < 7758292) {
        // 20% bonus for people joined the auction before block number 7758292
    }

    if (didParticipateInLockdrop(contributor.who)) {
        // lockdrop bonus formula 1 DOT = 101.61 ASTR * 0.1(10%) = 10.161 ASTR
    }

    // calculate KSM crowdloan bonus
    if (canGetSdnBonus(contributor.who)) {
    }

    // the following bonuses should be applied separately after all the other calculations

    // calculate referral bonus
    if (contributor.memo !== '') {
        // 10% of the total contributed amount
    }

    // calculate referrer bonus

    return totalBonus;
};

// returns a list of Ethereum accounts that participated in the lockdrop but did (could) not participate in the crowdloan
// we need this list for those who participated in the crowdloan from a different account
export const needLockdropBonusConfirmation = () => {
    const needSign = _.filter(DOT_CROWDLOAN_PARTICIPANTS, (i) => {
        return didParticipateInLockdrop(i.address);
    });

    return needSign;
};

export const getBonusStatusFullReport = (contributions: DotContribute[]) => {
    const totalItems = contributions.length;
    console.log(`Total contributions ${totalItems}`);
    let progress = 0;
    const withEarlyBonus = _.map(contributions, (i) => {
        progress += 1;
        console.log(`Finished ${progress} items out of ${totalItems}`);
        return {
            who: i.who,
            amount: i.contributing,
            timestamp: i.block_timestamp,
            extrinsicId: i.extrinsic_index,
            blockNumber: i.block_num,
            referral: i.memo ? polkadotUtils.encodeAddress('0x' + i.memo, DOT_PREFIX) : '',
            lockdropBonus: didParticipateInLockdrop(i.who) ? 'yes' : 'no',
            ksmBonus: canGetSdnBonus(i.who) ? 'yes' : 'no',
        };
    });
    return withEarlyBonus;
};
