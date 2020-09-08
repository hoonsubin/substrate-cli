import { EtherScanApi } from '../models/EtherScanTypes';
import _ from 'lodash';
import { LockEvent } from '../models/LockEvent';
import Web3Utils from 'web3-utils';
import { firstLockContract, secondLockContract } from '../data/lockdropContracts';
import fetch from 'node-fetch';
import Web3 from 'web3';
import ContractAbi from '../contracts/Lockdrop.json';

// we import with the require method due to an error with the lib
const Web3EthAbi = require('web3-eth-abi');

/**
 * a wrapper for node-fetch. Returns the JSON body of the response as string.
 * The body must be a JSON in order for this to work
 * @param url url of the request in string
 */
const fetchJsonData = async (url: string) => {
    const response = await fetch(url);
    const json = await response.json();
    return JSON.stringify(json);
};

/**
 * wait for the given time. A utility tool used to prevent API spamming
 * @param ms
 */
function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
    if (!Web3Utils.isAddress(contractAddress)) {
        throw new Error(`${contractAddress} is not a valid ethereum address`);
    }

    const networkToken = ropsten ? 'api-ropsten' : 'api';
    const api = `https://${networkToken}.etherscan.io/api?module=logs&action=getLogs&fromBlock=${fromBlock}&toBlock=${toBlock}&address=${contractAddress}&apikey=YourApiKeyToken`;

    // delay for 4 seconds to prevent IP ban
    await wait(4000);
    const res = await fetchJsonData(api);
    const logs: EtherScanApi.LogResponse = JSON.parse(res);

    if (logs.status === '0') {
        throw new Error(logs.message);
    }

    //const a = ContractAbi.abi.find((i) => i.name === 'Locked').inputs;

    const lockdropAbiInputs = ContractAbi.abi.find((i) => i.name === 'Locked').inputs;

    const INFURA_PROVIDER = `https://${ropsten ? 'ropsten' : 'mainnet'}.infura.io/v3/${process.env.INFURA_PROJ_ID}`;

    const web3 = new Web3(INFURA_PROVIDER);

    const lockEvents = logs.result.map(async (event) => {
        const decoded = Web3EthAbi.decodeLog(lockdropAbiInputs, event.data, event.topics);
        const senderTx = await web3.eth.getTransaction(event.transactionHash);
        //const senderTx = (await fetchTransaction(event.transactionHash, ropsten))[0];

        const ev = {
            eth: senderTx.value,
            duration: Web3Utils.hexToNumber(event.topics[2]),
            lock: decoded['lock'],
            introducer: decoded['introducer'],
            blockNo: Web3Utils.hexToNumber(event.blockNumber),
            timestamp: Web3Utils.hexToNumber(event.timeStamp),
            lockOwner: senderTx.from,
            transactionHash: event.transactionHash,
        } as LockEvent;
        return ev;
    });

    return Promise.all(lockEvents);
}

/**
 * gets the ethereum network type of the lockdrop smart contract based on the address.
 * @param contractAddr smart contract address
 */
export function contractToNetwork(contractAddr: string) {
    const allContracts = [...firstLockContract, ...secondLockContract];
    const network = allContracts.find((i) => i.address === contractAddr).type;
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
 * This function will return the full list (i.e. previous events + new events).
 * Ethereum chain ID will be automatically detected.
 * @param contract the contract address with the lock events
 * @param prevEvents previous event lists loaded from the cache
 */
export async function getAllLockEvents(contract: string, prevEvents?: LockEvent[]): Promise<LockEvent[]> {
    // set the correct block number either based on the create block or the latest event block
    const { blockHeight, type } = [...firstLockContract, ...secondLockContract].find(
        (i) => i.address.toLowerCase() === contract.toLowerCase(),
    );

    let startBlock = blockHeight;

    if (prevEvents.length > 0 && Array.isArray(prevEvents)) {
        startBlock = getHighestBlockNo(prevEvents);
        console.log('Found existing cache, starting from block number ' + startBlock);
    } else {
        console.log('No cache found, starting from block number ' + startBlock);
    }

    const isTestnet = type === 'ropsten';

    const newEvents = await fetchLockdropEvents(contract, startBlock, 'latest', isTestnet);

    // checking the same block will always return at least 1 event
    if (newEvents.length < 2) {
        console.log('No new events found, skipping...');
        return prevEvents;
    }

    const allEvents = [...prevEvents, ...newEvents];

    // filter objects so that the list only contains unique lock address
    const uniqueEvents = _.uniqBy(allEvents, (i) => {
        return i.lock;
    });

    const sortedList = _.sortBy(uniqueEvents, (e) => {
        return e.blockNo;
    });

    return sortedList;
}
