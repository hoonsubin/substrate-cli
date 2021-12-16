import * as polkadotUtils from '@polkadot/util-crypto';
import ksmCrowdloan from '../data/kusama-crowdloan.json';
import dotCrowdloan from '../data/polkadot-crowdloan.json';
import plmLockdrop from '../data/lockdrop-claim-complete.json';
import _ from 'lodash';
import { KsmCrowdloan, DotContribution, ClaimEvent } from '../types';

const KSM_PREFIX = 2;
const ASTR_PREFIX = 5;
const DOT_PREFIX = 0;

export const KSM_CROWDLOAN_DB = ksmCrowdloan as KsmCrowdloan[];
export const DOT_CROWDLOAN_DB = dotCrowdloan as DotContribution[];
export const PLM_LOCKDROP_DB = plmLockdrop as ClaimEvent[];

export const didParticipateInKsm = (polkadotAddress: string) => {
    const ksmAddr = polkadotUtils.encodeAddress(polkadotAddress, KSM_PREFIX);
    const participation = _.filter(KSM_CROWDLOAN_DB, (i) => {
        return i.account_id === ksmAddr;
    });

    return {
        result: !!participation,
        data: participation,
    };
};

export const didParticipateInLockdrop = (polkadotAddress: string) => {
    const participation = _.filter(PLM_LOCKDROP_DB, (i) => {
        // i.params[1].value = hex public key
        const dotAddr = polkadotUtils.encodeAddress('0x' + i.params[1].value, DOT_PREFIX);
        return dotAddr === polkadotAddress;
    });

    return {
        result: !!participation,
        data: participation,
    };
};
