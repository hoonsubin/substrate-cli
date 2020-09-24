import { u64, u128, U8aFixed, BTreeSet } from '@polkadot/types';
import { H256, AuthorityId } from '@polkadot/types/interfaces';
import { BigNumber } from 'bignumber.js';

export interface LockEvent {
    eth: string; // locked value in wei
    duration: number; // in Unix epoch seconds
    lock: string; // lock address
    introducer: string;
    blockNo: number;
    timestamp: number; // in Unix epoch seconds
    lockOwner: string; // locker's address
    transactionHash: string;
}

export interface LockdropContract {
    type: 'main' | 'ropsten';
    address: string;
    blockHeight: number;
}

export interface PlasmChainEvent {
    type: string;
    value: string;
}

/**
 * The lockdrop lock token type. This is used for the real-time lockdrop module
 */
export enum LockdropType {
    Bitcoin,
    Ethereum,
}

/**
 * used for real-time lockdrop parameter
 * this data is used to communicate with Substrate
 */
export interface Lockdrop {
    type: LockdropType;
    transactionHash: H256; //H256
    publicKey: U8aFixed; // [u8; 33]
    duration: u64; // u64
    value: u128; // u128
}

export interface Claim {
    params: Lockdrop;
    timestamp?: number;
    blockNumber?: number;
    approve: BTreeSet<AuthorityId>;
    decline: BTreeSet<AuthorityId>;
    amount: u128; // u128
    complete: boolean;
}
