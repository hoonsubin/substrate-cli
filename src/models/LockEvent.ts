import BigNumber from 'bignumber.js';

export interface LockEvent {
    eth: BigNumber; // locked value in wei
    duration: number; // in Unix epoch seconds
    lock: string; // lock address
    introducer: string;
    blockNo: number;
    timestamp: string; // in Unix epoch seconds
    lockOwner: string; // locker's address
    transactionHash: string;
}

export interface LockdropContract {
    type: 'main' | 'ropsten' | 'private';
    address: string;
    blockHeight: number;
}
