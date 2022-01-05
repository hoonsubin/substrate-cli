import * as utils from './utils';
import _ from 'lodash';
import * as polkadotCryptoUtils from '@polkadot/util-crypto';

export default async function app() {
    const res = utils.getReferrals(utils.DOT_CROWDLOAN_DB);

    await utils.saveAsJson(res);
}
