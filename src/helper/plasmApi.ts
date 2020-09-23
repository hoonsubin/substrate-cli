/* eslint-disable @typescript-eslint/camelcase */
import BigNumber from 'bignumber.js';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Hash, H256 } from '@polkadot/types/interfaces';
import * as polkadotUtilCrypto from '@polkadot/util-crypto';
import { Struct } from '@polkadot/types';
import * as plasmDefinitions from '@plasm/types/interfaces/definitions';
import { Claim } from '../models/EventTypes';
// it is not good to import a type from a function script
// todo: refactor this to have a dedicated types folder
import { femtoToPlm, NodeEndpoint } from './plasmUtils';

export class PlasmApi {
    constructor(public network: NodeEndpoint) {
        this._apiInst = this.createPlasmInstance(network);
        this.inst = this._apiInst;
    }

    public inst: Promise<ApiPromise>;

    private _apiInst: Promise<ApiPromise>;

    /**
     * establishes a connection between the client and the plasm node with the given endpoint.
     * this will default to the main net node
     * @param network end point for the client to connect to
     */
    private async createPlasmInstance(network?: NodeEndpoint) {
        const types = Object.values(plasmDefinitions).reduce((res, { types }): object => ({ ...res, ...types }), {});
        let endpoint = '';
        switch (network) {
            case 'Local':
                endpoint = 'ws://127.0.0.1:9944';
                break;
            case 'Dusty':
                endpoint = 'wss://rpc.dusty.plasmnet.io/';
                break;
            case 'Main': // main net endpoint will be the default value
            default:
                endpoint = 'wss://rpc.plasmnet.io';
                break;
        }

        const wsProvider = new WsProvider(endpoint, 10 * 1000);

        const api = await ApiPromise.create({
            provider: wsProvider,
            types: {
                ...types,
                // chain-specific overrides
                Address: 'GenericAddress',
                Keys: 'SessionKeys4',
            },
        });

        return await api.isReady;
    }

    public async lockdrop() {}

    /**
     * sends the unclaimed lockdrop reward to the given plasm address.
     * the signature must derive from the public key that made the lock.
     * @param claimId lockdrop claim ID hash in raw byte stream
     * @param recipient plasm address in decoded form
     * @param signature hex string without the 0x for the ECDSA signature from the user
     */
    public async claimTo(claimId: Uint8Array, recipient: Uint8Array | string, signature: Uint8Array) {
        const api = await this._apiInst;
        const encodedAddr = recipient instanceof Uint8Array ? polkadotUtilCrypto.encodeAddress(recipient) : recipient;
        const addrCheck = polkadotUtilCrypto.checkAddress(encodedAddr, 5);
        if (!addrCheck[0]) {
            throw new Error('Plasm address check error: ' + addrCheck[1]);
        }

        const claimToTx = api.tx.plasmLockdrop.claimTo(claimId, encodedAddr, signature);

        const txHash = await claimToTx.send();

        return txHash;
    }

    /**
     * submits a real-time lockdrop claim request to plasm node and returns the transaction hash.
     * this is a unsigned transaction that is only authenticated by a simple PoW to prevent spamming
     * @param lockParam lockdrop parameter that contains the lock data
     * @param nonce nonce for PoW authentication with the node
     */
    public async sendLockClaimRequest(lockParam: Struct, nonce: Uint8Array): Promise<Hash> {
        const api = await this._apiInst;
        if (typeof api.tx.plasmLockdrop === 'undefined') {
            throw new Error('Plasm node cannot find lockdrop module');
        }

        const claimRequestTx = api.tx.plasmLockdrop.request(lockParam.toU8a(), nonce);

        const txHash = await claimRequestTx.send();

        return txHash;
    }

    /**
     * Fetches the number of free balance for the given address in femto.
     * @param plasmAddress Plasm network address
     * @param asPlm if the output value should be in PLM. Default denominator is in femto
     */
    public async getAddressBalance(plasmAddress: string | Uint8Array, asPlm?: boolean) {
        const api = await this._apiInst;
        const encodedAddr =
            plasmAddress instanceof Uint8Array ? polkadotUtilCrypto.encodeAddress(plasmAddress) : plasmAddress;
        const addrCheck = polkadotUtilCrypto.checkAddress(encodedAddr, 5);
        if (!addrCheck[0]) {
            throw new Error('Plasm address check error: ' + addrCheck[1]);
        }

        const { data: balance } = await api.query.system.account(plasmAddress);
        let _bal = new BigNumber(balance.free.toString());
        if (asPlm) {
            _bal = femtoToPlm(new BigNumber(balance.free.toString()));
        }
        return _bal;
    }

    /**
     * Fetches Plasm real-time lockdrop vote threshold and positive vote values
     */
    public async getLockdropVoteRequirements() {
        const api = await this._apiInst;
        // number of minium votes required for a claim request to be accepted
        const _voteThreshold = Number.parseInt((await api.query.plasmLockdrop.voteThreshold()).toString());
        // number of outstanding votes (approve votes - decline votes) required for a claim request to be accepted
        const _positiveVotes = Number.parseInt((await api.query.plasmLockdrop.positiveVotes()).toString());

        return {
            voteThreshold: _voteThreshold,
            positiveVotes: _positiveVotes,
        };
    }

    /**
     * sends a lockdrop claim request to Plasm net node. This will fund the ECDSA address.
     * @param api polkadot API instance
     * @param claimId real-time lockdrop claim ID
     */
    public async sendLockdropClaim(claimId: Uint8Array | H256) {
        const api = await this._apiInst;

        const claimRequestTx = api.tx.plasmLockdrop.claim(claimId);

        const txHash = await claimRequestTx.send();

        return txHash;
    }

    /**
     * Plasm network real-time lockdrop claim data query wrapper.
     * This will query the node with the given claim ID and wrap the data to a readable interface.
     * This function will return undefined if the claim data does not exists on the chain.
     * @param api Polkadot-js API instance
     * @param claimId real-time lockdrop claim ID
     */
    public async getClaimStatus(claimId: Uint8Array | H256) {
        const api = await this._apiInst;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const claim = (await api.query.plasmLockdrop.claims(claimId)) as any;

        // wrap block query data to TypeScript interface
        const data: Claim = {
            params: {
                // we use snake case here because this data is directly parsed from the node
                type: claim.get('params').get('type'),
                transactionHash: claim.get('params').get('transaction_hash'),
                publicKey: claim.get('params').get('public_key'),
                duration: claim.get('params').get('duration'),
                value: claim.get('params').get('value'),
            },
            approve: claim.get('approve'),
            decline: claim.get('decline'),
            amount: claim.get('amount'),
            complete: claim.get('complete'),
        };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const [_key, value] of Object.entries(data.params)) {
            // check if data exists on chain
            if (
                typeof value === 'undefined' ||
                value.toHex() === '0x000000000000000000000000000000000000000000000000000000000000000000' || // pub key
                value.toHex() === '0x0000000000000000000000000000000000000000000000000000000000000000' // tx hash
            ) {
                return undefined;
            }
        }

        return data;
    }

    public async getLockdropAlpha() {
        const api = await this._apiInst;
        const alpha = await api.query.plasmLockdrop.alpha();
        // the queried data will always be a whole number, but the calculated data is between 0 ~ 1.
        // so we need to manually convert them
        return parseFloat('0.' + alpha.toString());
    }

    public async getCoinRate() {
        const api = await this._apiInst;
        const rate = ((await api.query.plasmLockdrop.dollarRate()) as unknown) as [number, number];
        return rate;
    }
}
