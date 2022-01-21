import BigNumber from 'bignumber.js';
import BN from 'bn.js';

export const durationToVestingSchedule = (startingBlock: number, totalAmount: string, durationMonths: number) => {
    const ASTR_TOKEN_DECIMAL = new BigNumber(10).pow(18);
    const ONE_MONTH = 28 * 24 * 60 * 60;
    const BLOCK_PER_SECOND = 12;
    // one month in block numbers
    const ONE_MONTH_BLOCKS_PER_12_SECONDS = ONE_MONTH / BLOCK_PER_SECOND;

    const totalVestedBlocks = ONE_MONTH_BLOCKS_PER_12_SECONDS * durationMonths;
    //console.log(totalVestedBlocks)
    // amount per block * total vested block number must equal the total amount
    const astrVal = new BigNumber(totalAmount).multipliedBy(ASTR_TOKEN_DECIMAL);
    const amountPerBlock = astrVal.dividedBy(totalVestedBlocks);

    return {
        locked: astrVal.toFixed(),
        perBlock: amountPerBlock.toFixed(),
        startingBlock,
    };
};