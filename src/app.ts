import { ApiPromise, WsProvider } from '@polkadot/api';
import * as polkadotUtils from '@polkadot/util-crypto';
import { saveAsCsv } from './utils';
import claimData from './data/claim-complete.json';
import _ from 'lodash';

const endpoints = {
    polkadot: 'wss://rpc.polkadot.io',
    shiden: 'wss://rpc.shiden.astar.network',
    local: 'ws://localhost:9944',
};

const shidenTypes = {
    Keys: 'AccountId',
    SmartContract: {
        _enum: {
            Evm: 'H160',
            Wasm: 'AccountId',
        },
    },
    EraIndex: 'u32',
    EraStakingPoints: {
        total: 'Balance',
        stakers: 'BTreeMap<AccountId, Balance>',
        _formerStakedEra: 'EraIndex',
        claimedRewards: 'Balance',
    },
    EraRewardAndStake: {
        rewards: 'Balance',
        staked: 'Balance',
    },
};

export default async function app() {
    const provider = new WsProvider(endpoints.polkadot);
    // Create our API with a default connection to the local node
    const api = await (
        await ApiPromise.create({
            provider,
        })
    ).isReady;

    await getUnbondEvents(api);
}

interface ClaimEvent {
    event_index: string;
    block_num: number;
    extrinsic_idx: number;
    module_id: string;
    event_id: string;
    params: EventParam[];
    event_idx: number;
    extrinsic_hash: string;
    block_timestamp: number;
}

interface EventParam {
    type: string;
    value: string;
    value_raw: string;
}

const getLockdropParticipantBalance = async (api: ApiPromise) => {
    const claimList = claimData as ClaimEvent[];

    // get all lockdrop participants
    const participantAddrList = _.map(claimList, (claimEv) => {
        const pubkey = claimEv.params[1].value;
        // encode public key to ss58 address
        return polkadotUtils.encodeAddress('0x' + pubkey, 5);
    });

    // obtain all account balances in header
    const currentAccountList = await api.query.system.account.multi(participantAddrList);

    const currentBalances = _.map(currentAccountList, (value, index) => {
        const { data } = value;

        const address = participantAddrList[index];
        return { address, freeBalance: data.free.toHuman(), reservedBalance: data.reserved.toHuman() };
    });

    // obtain all account balances in genesis
    const genesisHash = await api.rpc.chain.getBlockHash(1);
    console.log(`Genesis hash: ${genesisHash}`);

    const genesisApi = await api.at(genesisHash);

    const genesisQueryList = _.map(participantAddrList, (addr) => {
        return [genesisApi.query.system.account, addr];
    });

    // we can only use this method due to storage metadata changes in old blocks
    const genesisAccountList = await genesisApi.queryMulti(genesisQueryList as any);

    const genesisBalances = _.map(genesisAccountList, (value, index) => {
        const { data } = value as any;

        const address = participantAddrList[index];
        return {
            address,
            freeBalance: data.free.toHuman() as string,
            reservedBalance: data.reserved.toHuman() as string,
        };
    });

    // combine the genesis list and the header list
    const combinedList = _.map(participantAddrList, (value, index) => {
        const genesisBalance = genesisBalances[index];
        const currentBalance = currentBalances[index];

        return {
            address: value,
            genesisFree: genesisBalance.freeBalance,
            genesisReserved: genesisBalance.reservedBalance,
            currentFree: currentBalance.freeBalance,
            currentReserved: currentBalance.reservedBalance,
        };
    });

    await saveAsCsv(combinedList);

    //console.log(genesisAccountList[0].toHuman());

    console.log('Finished saving');
};

const getUnbondEvents = async (api: ApiPromise) => {

    // Set the Start and Eng blocknumber.
    // This script will search the events in the blocks generated between [endBlockNumber, startBlockNumber]
    const startBlockNumber = 7362891;
    const endBlockNumber = 7334256;
    if (startBlockNumber < endBlockNumber) {
        console.error("StartBlockNumber should be more than EndBlockNumber");
        return;
    }

    // Loop until reaching the endBlockNumber
    let currentBlockNumber = startBlockNumber + 1;
    let output = new Array();    
    while ( --currentBlockNumber >= endBlockNumber) {
        const currentBlockHash = await api.rpc.chain.getBlockHash(currentBlockNumber);
        const currentApi = await api.at(currentBlockHash);
        const currentTime = await currentApi.query.timestamp.now();
        console.log(`last header hash ${currentBlockHash.toHex()} (at #${currentBlockNumber})`);

        await (await currentApi.query.system.events()).map( eventRecord => {
            const event = eventRecord.event;
            if (event.section === 'staking' && event.method === 'Unbonded') {
                console.log(`${event.data}`);
                output.push({
                    timestamp: new Date(currentTime.toNumber()).toISOString(),
                    blockNumber: currentBlockNumber,
                    accountId: event.data[0],
                    amount: event.data[1]
                })
            }
        });
    }

    // Export to CSV
    await saveAsCsv(output);
}
