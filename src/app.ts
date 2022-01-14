import * as utils from './utils';
import _ from 'lodash';
import * as polkadotCryptoUtils from '@polkadot/util-crypto';
import * as polkadotUtils from '@polkadot/util';
import BN from 'bn.js';
import EthCrypto from 'eth-crypto';

import secondLockdropClaims from './data/raw/second-lockdrop-claims.json';
import firstLockdropClaims from './data/raw/first-lockdrop-claims.json';
import earlyBirdRegistration from './data/bonus-reward-user-result.json';
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

// todo: redo the lockdrop participant bonus

export default async function app() {
    const res = utils.getBonusStatusFullReport(utils.DOT_CROWDLOAN_DB);

    await utils.saveAsCsv(res);
}

const lockdropParticipantList = () => {
    const firstLockdrop = firstLockdropClaims;
    const secondLockdrop = secondLockdropClaims;
    const additionalClaims = earlyBirdRegistration;

    const firstParticipants = _.map(firstLockdrop, (i) => {
        const plmAddress = generatePlmAddress(EthCrypto.publicKey.compress(i['public key'].replace('0x', '')));
        return plmAddress;
    })
    const secondParticipants = _.map(secondLockdrop, (i) => {
        return polkadotCryptoUtils.encodeAddress(i.plasmAddress, 0);
    });
    const additionalParticipants = _.map(additionalClaims, (i) => {
        return polkadotCryptoUtils.encodeAddress(i.targetBonusAddress, 0);
    });

    const allParticipants = _.uniq([...firstParticipants, ...secondParticipants, ...additionalParticipants]);

    return _.map(allParticipants, (i) => {
        return {
            address: i,
        };
    });
};

/**
 * generates a Plasm public address with the given ethereum public key
 * @param ethPubKey an compressed ECDSA public key. With or without the 0x prefix
 */
 const generatePlmAddress = (publicKey: string) => {
    // hash to blake2
    const plasmPubKey = polkadotCryptoUtils.blake2AsU8a(polkadotUtils.hexToU8a(publicKey.startsWith('0x') ? publicKey : '0x' + publicKey), 256);
    // encode address
    const plasmAddress = polkadotCryptoUtils.encodeAddress(plasmPubKey, 5);
    return plasmAddress;
}