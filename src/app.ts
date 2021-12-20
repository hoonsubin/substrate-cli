import * as utils from './utils';
import _ from 'lodash';
import * as polkadotUtils from '@polkadot/util-crypto';

export default async function app() {
    const res = utils.needLockdropBonusConfirmation();

    //console.log(res);
    await utils.saveAsJson(res);
}
