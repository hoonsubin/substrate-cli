import * as utils from './utils';
import _ from 'lodash';
import * as polkadotCryptoUtils from '@polkadot/util-crypto';
import BN from 'bn.js';

import lockdropDump from './data/raw/second-lockdrop-claims.json';
import lockEvent from './data/raw/lockdrop-second-event.json';
import plmSnapshot from './data/raw/plasm-balance-snapshot.json';

interface LockdropParticipantData {
    ethereumAddress: string;
    plasmAddress: string;
    lockDuration: number;
    lockTxHash: string;
    reward: string;
}

// vesting for lockdrop participants
// 1000 days: 7 months
// 30, 100, 300 days: 15 months

export default async function app() {
    /*
    const res = _.map(lockdropDump, (i) => {

        const lockdropData = _.find(utils.PLM_LOCKDROP_DB, (j) => {
            const formatAddr = polkadotCryptoUtils.encodeAddress('0x' + j.params[1].value, 5);
            return formatAddr === polkadotCryptoUtils.encodeAddress(i.plasmAddress, 5);
        });

        if (!lockdropData) {
            console.log(`Cannot find balance for ${i.transactionHash}`);
        }

        const reward = lockdropData?.params[2].value || '0';

        const rewardData: LockdropParticipantData = {
            ethereumAddress: i.ethereumAddress,
            plasmAddress: i.plasmAddress,
            lockDuration: i.lockDuration,
            reward,
            lockTxHash: i.transactionHash,
        };
        return rewardData;
    });
*/
    console.log({
        lockEvent: lockEvent.length,
        claimEvent: lockdropDump.length
    });

    //await utils.saveAsCsv(res);
}
