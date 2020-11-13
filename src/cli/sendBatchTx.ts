import { PlmTransaction, ReferenceReward } from '../model/AffiliateReward';
import _ from 'lodash';
import PlasmConnect from '../helper/plasmApi';
import * as PolkadotUtils from '@polkadot/util';
import * as PolkadotCryptoUtils from '@polkadot/util-crypto';
import { Utils, PlasmUtils } from '../helper';
import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import path from 'path';
import BN from 'bn.js';
import * as plasmDefinitions from '@plasm/types/interfaces/definitions';
import { NodeEndpoint } from '../helper/plasmUtils';

const network: PlasmUtils.NodeEndpoint = 'Local';
const keyring = new Keyring({ type: 'sr25519' });

const createPlasmInstance = async (network?: NodeEndpoint) => {
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
};

const sendBatchTransaction = async (api: ApiPromise, transactionList: PlmTransaction[], senderSeed: string) => {
    const origin = keyring.addFromUri('//Alice', { name: 'Alice default' });

    const validAddr = _.filter(transactionList, (tx) => {
        return PolkadotCryptoUtils.checkAddress(tx.receiverAddress, 5)[0];
    });

    const txVec = _.map(validAddr, (tx) => {
        return api.tx.balances.transfer(tx.receiverAddress, new BN(tx.sendAmount.replace('0x', ''), 'hex'));
    });

    //const txHash = await plasmApi.api.tx.balances.
    const unsub = await api.tx.utility.batchAll(txVec).signAndSend(origin, { nonce: 32 }, (result) => {
        console.log(result.status);
        if (result.status.isFinalized) unsub();
    });

    return true;
};

// script entry point
export default async () => {
    const api = await createPlasmInstance(network);

    const recipientList = (
        await Utils.loadCsv(path.join(process.cwd(), 'src', 'data', '.temp', 'test-address.csv'))
    ).map((i) => i.address);

    const transactionList = recipientList.map((addr, index) => {
        const sendAmount = new BN(index + 1).mul(PolkadotUtils.BN_TEN).pow(new BN(15));
        return {
            receiverAddress: addr,
            sendAmount: PolkadotUtils.bnToHex(sendAmount),
        } as PlmTransaction;
    });

    // send the rewards
    const reserveSeed = process.env.PLM_SEED;
    if (!reserveSeed) throw new Error('Sender seed was not provided');
    //console.log({ transactionList, reserveSeed });
    await sendBatchTransaction(api, transactionList, reserveSeed);

    console.log('finished');
};
