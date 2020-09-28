/* eslint-disable @typescript-eslint/camelcase */
import BigNumber from 'bignumber.js';
import { H256 } from '@polkadot/types/interfaces';
import * as polkadotUtilCrypto from '@polkadot/util-crypto';
import * as polkadotUtils from '@polkadot/util';
import { u8aConcat } from '@polkadot/util';
import { Struct, TypeRegistry, u64, u128, U8aFixed, u8 } from '@polkadot/types';
import { LockdropType, Claim, Lockdrop, LockEvent } from '../models/EventTypes';

/**
 * Plasm Network node endpoint type
 */
export type NodeEndpoint = 'Local' | 'Dusty' | 'Main';

/**
 * converts the plasm network minimum denominator to PLM
 * @param femto minimum token value
 */
export function femtoToPlm(femto: BigNumber) {
    if (femto.isLessThanOrEqualTo(new BigNumber(0))) {
        return new BigNumber(0);
    }
    const plmDenominator = new BigNumber(10).pow(new BigNumber(15));
    return femto.dividedBy(plmDenominator);
}

/**
 * a Proof-of-Work function that hashes the lockdrop claim ID and the nonce
 * together to verify the unsigned transaction.
 * this will return the correct nonce in hex string
 * @param claimId the real-time lockdrop claim ID (blake2 hashed lock parameter)
 */
export function claimPowNonce(claimId: Uint8Array | H256): Uint8Array {
    let nonce = polkadotUtilCrypto.randomAsU8a();
    while (true) {
        const hash = polkadotUtilCrypto.blake2AsU8a(u8aConcat(claimId, nonce));
        //console.log('PoW hash: ' + u8aToHex(hash));
        if (hash[0] > 0) {
            nonce = polkadotUtilCrypto.randomAsU8a();
            //console.log('Next nonce: ' + u8aToHex(nonce));
        } else {
            return nonce;
        }
    }
}

/**
 * used for adding new polkadot-js api types for communicating with plasm node
 */
const plasmTypeReg = new TypeRegistry();

/**
 * convert the given lock duration in to PLM issue bonus rate
 * @param duration token lock duration
 */
export function lockDurationToRate(duration: number) {
    if (duration < 30) {
        return 0;
    } else if (duration < 100) {
        return 24;
    } else if (duration < 300) {
        return 100;
    } else if (duration < 1000) {
        return 360;
    } else {
        return 1600;
    }
}

/**
 * Create a lock parameter object with the given lock information.
 * This is used for the real-time lockdrop module in Plasm for both ETH and BTC locks
 * @param network the lockdrop network type
 * @param transactionHash the lock transaction hash in hex string
 * @param publicKey locker's public key in hex string
 * @param duration lock duration in Unix epoch (seconds)
 * @param value lock value in the minimum denominator (Wei or Satoshi)
 */
export function createLockParam(
    network: LockdropType,
    transactionHash: string,
    publicKey: string,
    duration: string,
    value: string,
) {
    const lockParam = new Struct(
        plasmTypeReg,
        {
            type: u8,
            transactionHash: 'H256',
            publicKey: U8aFixed, // [u8; 33]
            duration: u64,
            value: u128,
        },
        {
            type: network, // enum is converted to number
            transactionHash: transactionHash,
            publicKey: new U8aFixed(plasmTypeReg, publicKey, 264),
            duration: new u64(plasmTypeReg, duration),
            value: new u128(plasmTypeReg, value),
        },
    );

    return lockParam;
}

/**
 * signature message that is used for the claim_to() function.
 * sign this message with a ECDSA private key to generate the correct signature.
 * the 0x prefix will be automatically removed
 * @param claimId lockdrop claim ID in hex string
 * @param plasmAddress plasm network public address in ss58 encoding. This is the receiving address
 */
export const claimToMessage = (claimId: string, plasmAddress: string) => {
    const addressHex = polkadotUtils.u8aToHex(polkadotUtilCrypto.decodeAddress(plasmAddress)).replace('0x', '');

    return `I declare to claim lockdrop reward with ID ${claimId.replace('0x', '')} to AccountId ${addressHex}`;
};

/**
 * generates a Plasm public address with the given ethereum public key
 * @param ethPubKey an compressed ECDSA public key. With or without the 0x prefix
 */
export function generatePlmAddress(publicKey: string) {
    // converts a given hex string into Uint8Array
    const toByteArray = (hexString: string) => {
        const result = [];
        for (let i = 0; i < hexString.length; i += 2) {
            result.push(parseInt(hexString.substr(i, 2), 16));
        }
        return new Uint8Array(result);
    };

    // hash to blake2
    const plasmPubKey = polkadotUtilCrypto.blake2AsU8a(toByteArray(publicKey.replace('0x', '')), 256);
    // encode address
    const plasmAddress = polkadotUtilCrypto.encodeAddress(plasmPubKey, 5);
    return plasmAddress;
}

/**
 * converts lockdrop parameter into a Lockdrop type
 * @param lockdropParam lockdrop parameter type in polakdot-js structure
 */
export function structToLockdrop(lockdropParam: Struct) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const claim = lockdropParam as any;
    const param: Lockdrop = {
        type: claim.get('type'),
        transactionHash: claim.get('transactionHash'),
        publicKey: claim.get('publicKey'),
        duration: claim.get('duration'),
        value: claim.get('value'),
    };

    return param;
}

const durationToEpoch = (duration: number) => {
    const epochDays = 60 * 60 * 24;
    return duration * epochDays;
};

/**
 * a utility function that obtains the claim PoW nonce in hex string from the given claim ID.
 * This is used to manually send claim requests from polkadot-js app portal
 * @param claimId claim ID in hex string
 */
export const claimIdToNonceString = (claimId: string) => {
    const nonce2 = claimPowNonce(polkadotUtils.hexToU8a(claimId));

    return polkadotUtils.u8aToHex(nonce2);
};

/**
 * converts all lockdrops on ethereum into plasm lockdrop claim parameter
 * @param pubKey the public key of the locker
 * @param locks the lock event that has been parsed from the chain
 * @param latestBlock the current highest ethereum block number
 */
export const getClaimParamsFromEth = (pubKey: string, locks: LockEvent[], latestBlock: number) => {
    if (typeof pubKey === 'undefined' || pubKey === '') {
        throw new Error('No public key was provided');
    }

    if (locks.length === 0) {
        throw new Error('No lock events found');
    }

    const claimableLocks = locks.filter((i) => {
        // check if the lock as been confirmed for at least 5 blocks
        const blockPassed = i.blockNo + 5 < latestBlock;
        return blockPassed;
    });

    const claimIDs = claimableLocks.map((lock) => {
        const _wei = lock.eth;
        const _param = createLockParam(
            LockdropType.Ethereum,
            lock.transactionHash,
            pubKey,
            durationToEpoch(lock.duration).toString(),
            _wei,
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return structToLockdrop(_param as any);
    });

    return claimIDs;
};
