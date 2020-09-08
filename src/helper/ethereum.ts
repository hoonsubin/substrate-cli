import { EtherScanApi } from '../models/EtherScanTypes';
import _ from 'lodash';
import { LockEvent } from '../models/LockEvent';
import BigNumber from 'bignumber.js';
import Web3Utils from 'web3-utils';
import { AbiCoder } from 'web3-eth-abi';
import { firstLockContract, secondLockContract } from '../data/lockdropContracts';

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchTransaction(transactionHash: string, ropsten?: boolean) {
    const networkToken = ropsten ? 'api-ropsten' : 'api';
    const api = `https://${networkToken}.etherscan.io/api?module=account&action=txlistinternal&txhash=${transactionHash}&apikey=YourApiKeyToken`;

    // delay for 3 seconds to prevent IP ban
    await wait(3000);
    const res = await (await fetch(api)).text();
    const logs: EtherScanApi.TransactionResponse = JSON.parse(res);

    if (logs.status === '0') {
        throw new Error(logs.message);
    }

    // returns an array, but there will only be one entry
    return logs.result;
}

/**
 * fetch contract logs from etherscan. Because there is no API keys, the fetch will be limited to 1 time ever second
 * @param contractAddress lockdrop smart contract address
 * @param fromBlock which block to search from
 * @param toBlock up to what block the API should fetch for
 * @param ropsten pass true to search for ropsten network
 */
export async function fetchLockdropEvents(
    contractAddress: string,
    fromBlock: number | 'latest' | 'pending' | 'earliest' | 'genesis' = 'genesis',
    toBlock: number | 'latest' | 'pending' | 'earliest' | 'genesis' = 'latest',
    ropsten?: boolean,
) {
    const networkToken = ropsten ? 'api-ropsten' : 'api';
    const api = `https://${networkToken}.etherscan.io/api?module=logs&action=getLogs&fromBlock=${fromBlock}&toBlock=${toBlock}&address=${contractAddress}&apikey=YourApiKeyToken`;

    // delay for 3 seconds to prevent IP ban
    await wait(3000);
    const res = await (await fetch(api)).text();
    const logs: EtherScanApi.LogResponse = JSON.parse(res);

    if (logs.status === '0') {
        throw new Error(logs.message);
    }

    const lockdropAbiInputs = [
        {
            indexed: true,
            internalType: 'uint256',
            name: 'eth',
            type: 'uint256',
        },
        {
            indexed: true,
            internalType: 'uint256',
            name: 'duration',
            type: 'uint256',
        },
        {
            indexed: false,
            internalType: 'address',
            name: 'lock',
            type: 'address',
        },
        {
            indexed: false,
            internalType: 'address',
            name: 'introducer',
            type: 'address',
        },
    ];

    const lockEvents = logs.result.map(async (event) => {
        const abiDecoder = new AbiCoder();
        const decoded = abiDecoder.decodeLog(lockdropAbiInputs, event.data, event.topics);
        const senderTx = (await fetchTransaction(event.transactionHash, ropsten))[0];

        //console.log(new BigNumber(senderTx.value));

        const ev = {
            eth: new BigNumber(senderTx.value),
            duration: Web3Utils.hexToNumber(event.topics[2]),
            lock: decoded['lock'],
            introducer: decoded['introducer'],
            blockNo: Web3Utils.hexToNumber(event.blockNumber),
            timestamp: Web3Utils.hexToNumber(event.timeStamp).toFixed(),
            lockOwner: senderTx.from,
            transactionHash: event.transactionHash,
        } as LockEvent;
        return ev;
    });

    return Promise.all(lockEvents);
}

export function contractToNetwork(contractAddr: string) {
    const allContracts = [...firstLockContract, ...secondLockContract];
    const network = allContracts.find((i) => i.address === contractAddr).type;

    // if the result is falsy
    if (!!network) {
        throw new Error('Could not find address ' + contractAddr);
    }
    return network;
}

/**
 * finds the highest block number from the given lock event
 * @param lockEvents lock event list
 */
export function getHighestBlockNo(lockEvents: LockEvent[]) {
    const latestBlock = Math.max(
        ...lockEvents.map((o) => {
            return o.blockNo;
        }),
    );
    return latestBlock;
}

/**
 * returns an array of locked events for the lock contract from the latest event block number.
 * This function will return the full list (i.e. previous events + new events) and handle caching as well
 * @param web3 a web3.js instance to interact with the blockchain
 * @param instance a contract instance to parse the contract events
 */
export async function getAllLockEvents(contract: string, prevEvents?: LockEvent[]): Promise<LockEvent[]> {
    // set the correct block number either based on the create block or the latest event block
    const mainnetStartBlock =
        prevEvents.length === 0 || !Array.isArray(prevEvents)
            ? [...firstLockContract, ...secondLockContract].find(
                  (i) => i.address.toLowerCase() === contract.toLowerCase(),
              )?.blockHeight
            : getHighestBlockNo(prevEvents);

    const isDusty = contractToNetwork(contract) === 'ropsten';

    const newEvents = await fetchLockdropEvents(contract, mainnetStartBlock, 'latest', isDusty);

    if (newEvents.length < 2) return prevEvents;

    const allEvents = [...prevEvents, ...newEvents];

    // filter objects so that the list only contains unique transaction hashes
    const uniqueEvents = _.uniqBy(allEvents, (i) => {
        return i.lock;
    });

    const sortedList = _.sortBy(uniqueEvents, (e) => {
        return e.blockNo;
    });

    return sortedList;
}
