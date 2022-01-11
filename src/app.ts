import * as utils from './utils';
import _ from 'lodash';
import * as polkadotCryptoUtils from '@polkadot/util-crypto';

import FIRST_LOCKDROP from './data/raw/lockdrop-first-event.json';
import SECOND_LOCKDROP from './data/raw/lockdrop-second-event.json';

export default async function app() {
    //const res = utils.getBonusStatusFullReport(utils.DOT_CROWDLOAN_DB);

    await utils.saveAsCsv(SECOND_LOCKDROP);
}
