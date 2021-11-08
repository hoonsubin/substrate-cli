import { ApiPromise, WsProvider } from '@polkadot/api';
import * as polkadotUtils from '@polkadot/util-crypto';
import ObjectsToCsv from 'objects-to-csv';
import claimData from './data/claim-complete.json';
import _ from 'lodash';

export default async function app() {
    const endpoint = 'wss://rpc.shiden.astar.network';

    const provider = new WsProvider(endpoint);
    // Create our API with a default connection to the local node
    const api = await (
        await ApiPromise.create({
            provider,
            types: {
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
            },
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

    const balanceList = await api.query.system.account.multi(participantAddrList);

    const participantBalances = _.map(balanceList, (value, index) => {
        const { data } = value;
        
        const address = participantAddrList[index];
        return { address, freeBalance: data.free.toHuman(), reservedBalance: data.reserved.toHuman() };
    });

    const csv = new ObjectsToCsv(participantBalances);

    await csv.toDisk('./list.csv');

    participantBalances.forEach((i) => {
        console.log(i);
    });
    //console.log(participantBalances);

    // const unsub = await api.query.system.account.multi(participantAddrList, (bal) => {
    //     const balance = _.map(bal, (i) => {
    //         const { data } = i;

    //         return data.free.toHuman();
    //     });
    //     console.log(balance);
    // });

    // const participantBalanceList = _.map(participantAddrList, (participant) => {

    // })
    // participantAddrList.forEach((i) => {
    //     console.log(i);
    // })
};
