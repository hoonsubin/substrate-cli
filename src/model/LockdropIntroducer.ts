import { FullClaimData } from './EventTypes';
import _ from 'lodash';
import BigNumber from 'bignumber.js';

type IntroducerParams = {
    ethAddress: string;
    locks: FullClaimData[]; // lock references if the affiliate has locked themselves
    references: FullClaimData[]; // locks that references this introducer
};

export default class Introducer {
    constructor(private _params: IntroducerParams) {
        if (_params.references.length < 1)
            throw new Error(`Introducer ${_params.ethAddress} does not have any references`);

        this._totalBonus = this._calculateTotalBonus();
    }

    public get bonusRate() {
        return 0.01;
    }

    public get ethAddress() {
        return this._params.ethAddress;
    }

    public get plmAddress() {
        // note: a user can claim from multiple PLM addresses
        // note: if the introducer did not participate, we don't know the public key
        return _.map(this._params.locks, (i) => i.claimedAddress);
    }

    public get locks() {
        return this._params.locks;
    }

    public get references() {
        return this._params.references;
    }

    public get totalBonus() {
        return this._totalBonus;
    }

    public get totalBonusToRefs() {
        return new BigNumber(this._totalBonus).multipliedBy(this.bonusRate);
    }

    private _totalBonus: string;

    private _calculateTotalBonus() {
        const totalBonus = _.reduce(
            _.map(this._params.references, (i) => {
                const claimedPlm = new BigNumber(i.amount.toString());
                return claimedPlm.multipliedBy(this.bonusRate);
            }),
            (sum, current) => {
                return sum.plus(current);
            },
            new BigNumber(0),
        );

        return totalBonus.toFixed();
    }
}
