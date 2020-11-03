import { SubscanApi } from '../src/models/SubscanTypes';
import claims from './data/claim-complete.json';
import locks from './data/eth-main-locks.json';
import _ from 'lodash';

const parseClaimCompleteParam = () => {
    const eventParams = _.map(claims as SubscanApi.Event[], (i) => {
        const claimEvent = i.params;
    });
};

// script entry point
(async () => {
    console.log('Hello World, this is a node sandbox to test things');
})().catch((err) => {
    console.error(err);
});
