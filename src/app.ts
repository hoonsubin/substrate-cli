import * as utils from './utils';
import _ from 'lodash';
import * as polkadotCryptoUtils from '@polkadot/util-crypto';
import BN from 'bn.js';

import lockdropDump from './data/raw/realtime-lockdrop-dump.json';

export default async function app() {
    //const res = utils.totalDotContributed('13wNbioJt44NKrcQ5ZUrshJqP7TKzQbzZt5nhkeL4joa3PAX');
    const cleanData = _.map(lockdropDump, (i) => {
        const dayBySeconds = 60 * 60 * 24;
        const ss58Addr = polkadotCryptoUtils.encodeAddress(i.account_id, 5);
        const lockDuration = new BN(i.duration).divn(dayBySeconds).toNumber();

        return {
            ethAddr: i.ethereum_address,
            lockDuration,
            plasmAddress: ss58Addr,
            transactionHash: i.transaction_hash,
            publicKey: i.public_key
        }
    });
    await utils.saveAsCsv(cleanData);
    console.log(cleanData);
}
