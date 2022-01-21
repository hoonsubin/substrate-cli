export interface KsmCrowdloan {
    account_id: string;
    amount: string;
    timestamp: string;
    blocknumber: number;
    how: string;
}

export interface SubscanDotContribution {
    who: string;
    amount: string;
    extrinsic_index: string;
    block_num: number;
    memo: string;
}

export interface DotContribute {
    who: string;
    contributed: string;
    contributing: string;
    block_num: number;
    block_timestamp: number;
    extrinsic_index: string;
    memo: string;
    status: number;
}

export interface RewardData {
    account_id: string;
    amount: string;
}

export interface PlmRewardData extends RewardData {
    vestingFor: '7' | '15';
}