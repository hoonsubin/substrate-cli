import { PlmTransaction, ReferenceReward } from '../model/AffiliateReward';
import _ from 'lodash';
import PlasmConnect from '../helper/plasmApi';
import * as PolkadotUtils from '@polkadot/util';
import * as PolkadotCryptoUtils from '@polkadot/util-crypto';
import { Utils, PlasmUtils } from '../helper';
import { Keyring } from '@polkadot/api';
import path from 'path';
import BN from 'bn.js';

const network: PlasmUtils.NodeEndpoint = 'Main';
const plasmApi = new PlasmConnect(network);
const keyring = new Keyring({ type: 'sr25519' });

const sendBatchTransaction = async (transactionList: PlmTransaction[], senderSeed: string) => {
    const origin = keyring.addFromUri(senderSeed);

    const validAddr = _.filter(transactionList, (tx) => {
        return PolkadotCryptoUtils.checkAddress(tx.receiverAddress, 5)[0];
    });

    const txVec = _.map(validAddr, (tx) => {
        return plasmApi.api.tx.balances.transfer(tx.receiverAddress, new BN(tx.sendAmount));
    });

    //const txHash = await plasmApi.api.tx.balances.
    const unsub = await plasmApi.api.tx.utility.batch(txVec).signAndSend(origin, (result) => {
        console.log(result.status);
        if (result.status.isFinalized) unsub();
    });

    return true;
};

// script entry point
export default async () => {
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

    console.log(transactionList);

    //await sendBatchTransaction(transactionList, reserveSeed);

    console.log('finished');
};
