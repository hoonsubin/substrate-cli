import * as polkadotCryptoUtils from '@polkadot/util-crypto';
import * as polkadotUtils from '@polkadot/util';

/**
 * Decodes the given SS58 address and outputs the public key.
 * @param ss58Address 
 */
export const ss58PublicKey = (ss58Address: string) => {
    const publicKey = polkadotCryptoUtils.decodeAddress(ss58Address);
    
    return polkadotUtils.u8aToHex(publicKey);
}