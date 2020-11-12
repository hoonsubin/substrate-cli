export interface PlmTransaction {
    receiverAddress: string;
    sendAmount: string; // femto normal number string
}

/**
 * Reward for an affiliated address
 */
export interface AffiliationReward extends PlmTransaction {
    ethAddress: string;
    numberOfRefs: number;
}

/**
 * Bonus for locks referencing an affiliated address
 */
export interface ReferenceReward extends PlmTransaction {
    introducer: string;
    lockTx: string;
    claimId: string;
}
