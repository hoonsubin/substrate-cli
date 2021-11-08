import { ApiPromise, WsProvider } from '@polkadot/api';
import * as polkadotUtils from '@polkadot/util-crypto';
import ObjectsToCsv from 'objects-to-csv';
import claimData from './data/claim-complete.json';
import _ from 'lodash';

const endpoints = {
    polkadot: 'wss://rpc.polkadot.io',
    shiden: 'wss://rpc.shiden.astar.network',
    local: 'ws://localhost:9944',
};

export default async function app() {
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

    const provider = new WsProvider(endpoints.local);
    // Create our API with a default connection to the local node
    const api = await (
        await ApiPromise.create({
            provider,
            types: shidenTypes
        })
    ).isReady;

    await getLockdropParticipantBalance(api);
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

const saveAsCsv = async (list: Array<object>) => {
    const csv = new ObjectsToCsv(list);

    await csv.toDisk('./list.csv');
};
