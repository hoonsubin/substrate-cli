import { ApiPromise } from '@polkadot/api';
import * as polkadotUtils from '@polkadot/util-crypto';
import { saveAsCsv } from '../utils';
import claimData from '../data/lockdrop-claim-complete.json';
import _ from 'lodash';
import { ClaimEvent } from '../types';

export const getLockdropParticipantBalance = async (api: ApiPromise) => {
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
