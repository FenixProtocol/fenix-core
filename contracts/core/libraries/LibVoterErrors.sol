// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @notice Reverts when access is denied for the operation.
 */
error AccessDenied();

/**
 * @notice Reverts when an invalid address key is provided.
 */
error InvalidAddressKey();

/**
 * @notice Reverts when the vote delay has already been set.
 */
error VoteDelayAlreadySet();

/**
 * @notice Reverts when the provided vote delay exceeds the maximum allowed.
 */
error VoteDelayTooBig();

/**
 * @notice Reverts when an operation is attempted on a gauge that has already been killed.
 */
error GaugeAlreadyKilled();

/**
 * @notice Reverts when an operation is attempted on a gauge that is not currently killed.
 */
error GaugeNotKilled();

/**
 * @notice Reverts when an operation is attempted on a pool that was not created by the factory.
 */
error PoolNotCreatedByFactory();

/**
 * @notice Reverts when an attempt is made to create a gauge for a pool that already has one.
 */
error GaugeForPoolAlreadyExists();

/**
 * @notice Reverts when a voting operation is attempted without a prior reset.
 */
error NoResetBefore();

/**
 * @notice Reverts when the calculated vote power for a pool is zero.
 */
error ZeroPowerForPool();

/**
 * @notice Reverts when the required delay period for voting has not passed.
 */
error VoteDelay();

/**
 * @notice Reverts when the lengths of provided arrays do not match.
 */
error ArrayLengthMismatch();

/**
 * @notice Reverts when an operation is attempted on a disabled managed NFT.
 */
error DisabledManagedNft();

/**
 * @notice Reverts when the operation is attempted outside the allowed distribution window.
 */
error DistributionWindow();

/**
 * @notice Reverts when the try create gauge for pool without setup fees vault.
 */
error PoolNotInitialized();

/**
 * @notice Reverts if voting is currently paused and an action that requires active voting is attempted.
 */
error DisableDuringVotingPaused();

/**
 * @notice Reverts if the user data provided in a Merkl claim does not match the expected target address.
 */
error InvalidMerklDataUser();

/**
 * @notice Reverts if the percentage to lock (e.g., in a veNFT lock) exceeds the maximum permissible value (1e18 = 100%).
 */
error InvalidPercentageToLock();
