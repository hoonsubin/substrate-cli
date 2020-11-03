/* eslint-disable @typescript-eslint/camelcase */
import BigNumber from 'bignumber.js';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Vec } from '@polkadot/types';
import { Hash, Moment, H256, BlockNumber } from '@polkadot/types/interfaces';
import { ClaimId, Claim as LockdropClaim } from '@plasm/types/interfaces';
import * as cliProgress from 'cli-progress';
import * as polkadotUtilCrypto from '@polkadot/util-crypto';
import * as polkadotUtils from '@polkadot/util';
import * as plasmDefinitions from '@plasm/types/interfaces/definitions';
import { Claim, Lockdrop, LockdropType } from '../models/EventTypes';
// it is not good to import a type from a function script
// todo: refactor this to have a dedicated types folder
import { createLockParam, femtoToPlm, NodeEndpoint } from './plasmUtils';
import _ from 'lodash';

export default class PlasmConnect {
    constructor(public network: NodeEndpoint) {
        //this._apiInst = this.createPlasmInstance(network);
    }

    public get api() {
        return this._apiInst;
    }

    private _apiInst: ApiPromise;

    /**
     * Start the api connection.
     */
    public async start() {
        const api = await this.createPlasmInstance(this.network);
        this._apiInst = api;
    }

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

    /**
     * sends the unclaimed lockdrop reward to the given plasm address.
     * the signature must derive from the public key that made the lock.
     * @param claimId lockdrop claim ID hash in raw byte stream
     * @param recipient plasm address in decoded form
     * @param signature hex string without the 0x for the ECDSA signature from the user
     */
    public async claimTo(claimId: Uint8Array | H256, recipient: Uint8Array | string, signature: Uint8Array) {
        const api = this._apiInst;
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
    public async sendLockClaimRequest(lockParam: Lockdrop, nonce: Uint8Array): Promise<Hash> {
        const api = this._apiInst;
        if (typeof api.tx.plasmLockdrop === 'undefined') {
            throw new Error('Plasm node cannot find lockdrop module');
        }

        const claimParam = createLockParam(
            lockParam.type,
            lockParam.transactionHash.toHex(),
            polkadotUtils.u8aToHex(lockParam.publicKey),
            lockParam.duration.toString(),
            lockParam.value.toString(10),
        );

        const claimRequestTx = api.tx.plasmLockdrop.request(claimParam.toU8a(), nonce);

        const txHash = await claimRequestTx.send();

        return txHash;
    }

    /**
     * Fetches the number of free balance for the given address in femto.
     * @param plasmAddress Plasm network address
     * @param asPlm if the output value should be in PLM. Default denominator is in femto
     */
    public async getAddressBalance(plasmAddress: string | Uint8Array, asPlm?: boolean) {
        const api = this._apiInst;
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
     * Maps the given block number into hash
     * @param blockNumber
     */
    public async blockNoToHash(blockNumber: number) {
        const api = this._apiInst;

        const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
        return blockHash;
    }

    /**
     * Fetches Plasm real-time lockdrop vote threshold and positive vote values
     */
    public async getLockdropVoteRequirements() {
        const api = this._apiInst;
        // number of minium votes required for a claim request to be accepted
        const _voteThreshold = Number.parseInt((await api.query.plasmLockdrop.voteThreshold()).toString());
        // number of outstanding votes (approve votes - decline votes) required for a claim request to be accepted
        const _positiveVotes = Number.parseInt((await api.query.plasmLockdrop.positiveVotes()).toString());

        return {
            voteThreshold: _voteThreshold,
            positiveVotes: _positiveVotes,
        };
    }

    public async getLockdropDuration() {
        const api = this._apiInst;

        const lockdropBounds = await api.query.plasmLockdrop.lockdropBounds();

        return (lockdropBounds as unknown) as [BlockNumber, BlockNumber];
    }

    /**
     * sends a lockdrop claim request to Plasm net node. This will fund the ECDSA address.
     * @param api polkadot API instance
     * @param claimId real-time lockdrop claim ID
     */
    public async sendLockdropClaim(claimId: Uint8Array | H256) {
        const api = this._apiInst;

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
    public async getClaimData(claimId: Uint8Array | H256, blockHash: Hash): Promise<Claim | null> {
        const api = this._apiInst;

        const blockData = (await api.rpc.chain.getBlock(blockHash)).block;
        const blockNumber = blockData.header.number.unwrap().toNumber();
        const timestamp = blockData.extrinsics.find((i) => {
            return i.method.section === 'timestamp';
        })!.method.args[0] as Moment;

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
            complete: claim.get('complete').valueOf(),
            blockNumber,
            timestamp: Math.trunc(timestamp.toNumber() / 1000),
            claimId: polkadotUtils.u8aToHex(claimId),
        };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const [_key, value] of Object.entries(data.params)) {
            // check if data exists on chain
            if (
                typeof value === 'undefined' ||
                value.toHex() === '0x000000000000000000000000000000000000000000000000000000000000000000' || // pub key
                value.toHex() === '0x0000000000000000000000000000000000000000000000000000000000000000' // tx hash
            ) {
                return null;
            }
        }

        return data;
    }

    /**
     * Fetches all lockdrop reward claim request events from the node.
     * @param startFrom block number for where
     */
    public async fetchClaimRequestCall(startFrom?: number) {
        const api = this._apiInst;
        // maximum number of block range the API can cover
        const maxRequests = 2500;

        // start from the given block number, or at the beginning of the lockdrop
        const startBlock = startFrom || ((await api.query.plasmLockdrop.lockdropBounds()) as any).toNumber();

        console.log('Starting from block ' + startBlock);

        const lastHdr = (await api.rpc.chain.getHeader()).number.unwrap();

        const _queryRange = lastHdr.subn(startBlock).toNumber();

        // ensure no negative value is passed
        const lockdropBlockRange = Math.max(_queryRange, maxRequests);
        // number of calls needed to cover all the blocks
        const pages = Math.round(lockdropBlockRange / maxRequests);

        let blockEventList: {
            blockHash: Hash;
            claimIds: Vec<ClaimId>;
        }[] = [];

        console.log('Fetching ' + pages + ' pages from plasm node...\n');

        const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        progressBar.start(pages - 1, 0);
        for (let i = 0; i < pages; i++) {
            const startBlockNo = startBlock + i * maxRequests;
            const endBlockNo = Math.min(startBlockNo + maxRequests, lastHdr.toNumber());

            const startHdr = await api.rpc.chain.getBlockHash(startBlockNo);
            const endHdr = await api.rpc.chain.getBlockHash(endBlockNo);

            const lockdropEvents = await api.query.plasmLockdrop.requests.range([startHdr, endHdr]);

            const _events = lockdropEvents.filter(([_hash, request]) => {
                return !request.isEmpty;
            });

            const reqs = _events.map(([hash, extr]) => {
                const claimIds = extr as Vec<ClaimId>;
                return {
                    blockHash: hash,
                    claimIds,
                };
            });
            // flip the array to ensure new blocks go first
            blockEventList = blockEventList.concat(reqs.reverse());
            progressBar.update(i);
        }
        progressBar.stop();

        if (blockEventList.length === 0) {
            console.log('No new claim events found');
            return [];
        }

        const claimList = blockEventList.map(({ blockHash, claimIds }) => {
            const ids = claimIds.map((i) => {
                return {
                    claimId: i.toHex(),
                    blockHash,
                };
            });
            return ids;
        });

        // flatten the list
        const claimEvents = claimList.reduce((accumulator, currentValue) => {
            return accumulator.concat(currentValue);
        });

        console.log(`Fetching claim params and timestamping them...\n`);
        const fetchTimeStampPrg = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        fetchTimeStampPrg.start(claimEvents.length, 0);
        const blocks = await Promise.all(
            claimEvents.map(async (i, index) => {
                const _block = (await api.rpc.chain.getBlock(i.blockHash)).block;
                const blockNumber = _block.header.number.unwrap().toNumber();
                const timestamp = _block.extrinsics.find((i) => {
                    return i.method.section === 'timestamp';
                })!.method.args[0] as Moment;
                const claimData = (await api.query.plasmLockdrop.claims(
                    polkadotUtils.hexToU8a(i.claimId),
                )) as LockdropClaim;

                const _claim: Claim = {
                    params: {
                        // we use snake case here because this data is directly parsed from the node
                        type: claimData.params.type.toNumber() as LockdropType,
                        transactionHash: claimData.params.transaction_hash,
                        publicKey: claimData.params.public_key,
                        duration: claimData.params.duration,
                        value: claimData.params.value,
                    },
                    approve: claimData.approve,
                    decline: claimData.decline,
                    amount: claimData.amount,
                    complete: claimData.complete.valueOf(),
                    blockNumber,
                    timestamp: Math.trunc(timestamp.toNumber() / 1000),
                    claimId: i.claimId,
                };
                fetchTimeStampPrg.update(index + 1);
                return _claim;
            }),
        );

        fetchTimeStampPrg.stop();

        const ordered = blocks.sort((a, b) => {
            return b.timestamp - a.timestamp;
        });
        return ordered;
    }

    public async getLockdropAlpha() {
        const api = this._apiInst;
        const alpha = await api.query.plasmLockdrop.alpha();
        // the queried data will always be a whole number, but the calculated data is between 0 ~ 1.
        // so we need to manually convert them
        return parseFloat('0.' + alpha.toString());
    }

    public async getCoinRate() {
        const api = this._apiInst;
        const rate = ((await api.query.plasmLockdrop.dollarRate()) as unknown) as [number, number];
        return rate;
    }
}
