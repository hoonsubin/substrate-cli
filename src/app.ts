import {
    getBonusStatus,
    DOT_CROWDLOAN_DB,
    KSM_CROWDLOAN_DB,
    saveAsCsv,
    saveAsJson,
    getLockdropParticipants,
    getKsmParticipants,
    PLM_LOCKDROP_DB,
    SDN_KSM_REWARD_DB,
} from './utils';
import _ from 'lodash';
import * as polkadotUtils from '@polkadot/util-crypto';

export default async function app() {
    const res = _.map(DOT_CROWDLOAN_DB, (i) => {
        return { address: i.who };
    });

    await saveAsJson(res, './src/data/dot-crowdloan-participants.json');
}

const saveLockdropAddrList = async () => {
    const participants = getLockdropParticipants(PLM_LOCKDROP_DB);
    await saveAsJson(
        participants.map((i) => {
            return { address: i };
        }),
        './src/data/lockdrop-participants.json',
    );
};

const saveKsmCrowdloanAddrList = async () => {
    const participants = getKsmParticipants(KSM_CROWDLOAN_DB);
    await saveAsJson(
        participants.map((i) => {
            return { address: i };
        }),
        './src/data/ksm-crowdloan-participants.json',
    );
};
