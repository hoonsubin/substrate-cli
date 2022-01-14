import * as polkadotCryptoUtils from '@polkadot/util-crypto';
import * as polkadotUtils from '@polkadot/util';

export enum AddressPrefix {
    KSM_PREFIX = 2,
    ASTR_PREFIX = 5,
    DOT_PREFIX = 0,
}

/**
 * Decodes the given SS58 address and outputs the public key.
 * @param ss58Address
 */
export const ss58PublicKey = (ss58Address: string) => {
    const publicKey = polkadotCryptoUtils.decodeAddress(ss58Address);

    return polkadotUtils.u8aToHex(publicKey);
};

export const convertSs58Format = (addressOrAccountId: string, prefix: AddressPrefix | number) => {
    return polkadotCryptoUtils.encodeAddress(addressOrAccountId, prefix);
};

/**
 * generates a Plasm public address with the given ethereum public key
 * @param ethPubKey an compressed ECDSA public key. With or without the 0x prefix
 */
export const ss58FromEcdsaPublicKey = (publicKey: string) => {
    const prefixedHex = publicKey.startsWith('0x') ? publicKey : '0x' + publicKey;
    // hash to blake2
    const plasmPubKey = polkadotCryptoUtils.blake2AsU8a(polkadotUtils.hexToU8a(prefixedHex), 256);
    // encode address
    const plasmAddress = polkadotCryptoUtils.encodeAddress(plasmPubKey, 5);
    return plasmAddress;
};
