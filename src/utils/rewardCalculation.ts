import * as polkadotUtils from '@polkadot/util-crypto';
import ksmCrowdloan from '../data/kusama-crowdloan.json';
import dotCrowdloan from '../data/polkadot-crowdloan.json';
import plmLockdrop from '../data/lockdrop-claim-complete.json';
import ksmCrowdloandParticipants from '../data/ksm-crowdloan-participants.json';
import plmLockdropParticipants from '../data/lockdrop-participants.json';
import _ from 'lodash';
import { KsmCrowdloan, ClaimEvent } from '../types';

interface Contribute {
    who: string;
    contributed: string;
    contributing: string;
    block_num: number;
    block_timestamp: number;
    extrinsic_index: string;
    memo: string;
}

const KSM_PREFIX = 2;
const ASTR_PREFIX = 5;
const DOT_PREFIX = 0;

export const KSM_CROWDLOAN_DB = ksmCrowdloan as KsmCrowdloan[];
export const DOT_CROWDLOAN_DB = dotCrowdloan as Contribute[];
export const PLM_LOCKDROP_DB = plmLockdrop as ClaimEvent[];

export const KSM_CROWDLOAN_PARTICIPANTS = ksmCrowdloandParticipants as { address: string }[];
export const PLM_LOCKDROP_PARTICIPANTS = plmLockdropParticipants as { address: string }[];

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
        return i.address === polkadotAddress;
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

export const getReferrals = (contributions: Contribute[]) => {
    const contributionWithRefs = _.map(
        _.filter(contributions, (i) => {
            return !!i.memo;
        }),
        (j) => {
            return {
                contributor: j.who,
                referred: j.memo,
            };
        },
    );

    const refs = _.uniq(
        _.map(contributionWithRefs, (i) => {
            return polkadotUtils.encodeAddress('0x' + i.referred, DOT_PREFIX);
        }),
    );

    console.log(refs);
};

export const getBonusStatus = (contributions: Contribute[]) => {
    const withEarlyBonus = _.map(contributions, (i) => {
        return {
            who: i.who,
            amount: i.contributing,
            timestamp: i.block_timestamp,
            extrinsicId: i.extrinsic_index,
            blockNumber: i.block_num,
            lockdropBonus: didParticipateInLockdrop(i.who) ? 'yes' : 'no',
            ksmBonus: didParticipateInKsm(i.who) ? 'yes' : 'no',
        };
    });
    return withEarlyBonus;
};
