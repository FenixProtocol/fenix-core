// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./IVoter.sol";

interface ICompoundEmissionExtension {
    /**
     * @notice Describes a specific veNFT token lock target and the fraction (percentage) of emissions to deposit there.
     * @dev `lockPercentage` is expressed in 1e18 format (i.e., 1e18 = 100%).
     * @param tokenId The ID of the veNFT to deposit into.
     * @param lockPercentage The fraction of emissions (in 1e18 scale) allocated to this token lock.
     */
    struct TargetLock {
        uint256 tokenId;
        uint256 lockPercentage;
    }

    /**
     * @notice Configuration options for creating or depositing into veNFT during compounding.
     * @dev
     *  - `shouldBoosted` indicates whether boosted locks (like Liquidity Gauge boosts) should apply.
     *  - `withPermanentLock` indicates whether the lock is permanent.
     *  - `lockDuration` the duration of the lock in seconds (ignored if `withPermanentLock` is true).
     *  - `managedTokenIdForAttach` an existing managed veNFT ID for attaching the deposit.
     */
    struct CreateLockConfig {
        bool shouldBoosted;
        bool withPermanentLock;
        uint256 lockDuration;
        uint256 managedTokenIdForAttach;
    }

    /**
     * @notice Parameters to claim emissions from the Voter, which are then compounded into locks.
     * @dev
     *  - `target` is the user whose emissions are being compounded.
     *  - `gauges` list of gauge addresses for which to claim the user's emissions.
     *  - `merkl` optional data for merkle-based claims (if applicable).
     */
    struct ClaimParams {
        address target;
        address[] gauges;
        IVoter.AggregateClaimMerklDataParams merkl;
    }
    /**
     * @notice Emitted when the default lock configuration is updated.
     * @param config The new default configuration for creating veNFT locks.
     */
    event SetDefaultCreateLockConfig(CreateLockConfig config);

    /**
     * @notice Emitted when a user sets or removes their custom configuration for creating locks.
     * @param user The user whose configuration changed.
     * @param config The new configuration, or default values if removed.
     */
    event SetCreateLockConfig(address indexed user, CreateLockConfig config);

    /**
     * @notice Emitted when a user updates how their emissions are split across multiple veNFT locks.
     * @param user The user whose emission distribution changed.
     * @param toLocksPercentage The fraction of emissions that will be locked.
     * @param targetLocks An array of new `TargetLock` structures describing distribution across locks.
     */
    event SetCompoundEmissionConfig(address indexed user, uint256 toLocksPercentage, TargetLock[] targetLocks);

    /**
     * @notice Emitted when a user changes the veNFT token ID in an existing emission distribution target.
     * @param user The user whose emission target changed.
     * @param targetLockFromId The old token ID that was used.
     * @param targetTokenToId The new token ID that replaced the old one.
     */
    event ChangeEmissionTargetLock(address indexed user, uint256 targetLockFromId, uint256 targetTokenToId);

    /**
     * @notice Emitted when a new veNFT lock is created due to emission compounding.
     * @param user The user who created the lock.
     * @param amount The amount of tokens locked.
     * @param tokenId The newly created veNFT token ID.
     */
    event CreateLockFromCompoundEmission(address indexed user, uint256 indexed tokenId, uint256 amount);

    /**
     * @notice Emitted when a user compounds emissions into a specific veNFT lock.
     * @param user The address of the user compounding emissions.
     * @param tokenId The identifier of the veNFT into which emissions are deposited.
     * @param amount The amount of tokens deposited into the specified veNFT lock.
     */
    event CompoundEmissionToTargetLock(address indexed user, uint256 indexed tokenId, uint256 amount);

    /**
     * @notice Batch operation for compounding emissions for multiple users.
     * @dev Only callable by the COMPOUND_KEEPER_ROLE.
     * @param claimsParams_ An array of `ClaimParams` describing each user's claim details.
     */
    function compoundEmissionClaimBatch(ClaimParams[] calldata claimsParams_) external;

    /**
     * @notice Allows a user to directly compound their emissions for the specified gauges.
     * @dev This can only be called by the user themselves (`claimParams_.target`).
     * @param claimParams_ The `ClaimParams` struct with details of the user's claim and configuration.
     */
    function compoundEmisisonClaim(ClaimParams calldata claimParams_) external;

    /**
     * @notice Updates occurrences of `targetTokenId_` in a user's `TargetLock[]` to `newTokenId_`.
     * @dev
     *  - If there are multiple entries (duplicates) of the same `targetTokenId_`, **all** will be replaced.
     *  - If `newTokenId_ = 0`, any `TargetLock` referencing `targetTokenId_` effectively gets reset,
     *    so a new veNFT can be created the next time `_compoundEmissionClaim` is called (due to `tokenId = 0`).
     *  - Typically called by the Voter contract during token transfers or merges (see `onAfterTokenTransfer` and `onAfterTokenMerge`).
     * @param target_ The user whose TargetLock records will be updated.
     * @param targetTokenId_ The old token ID to search for in the user’s `TargetLock[]`.
     * @param newTokenId_ The new token ID to replace the old one. If zero, the old lock references are removed.
     */
    function changeEmissionTargetLockId(address target_, uint256 targetTokenId_, uint256 newTokenId_) external;

    /**
     * @notice Retrieves the fraction (in 1e18 scale) of a user's emissions that should be sent to locks.
     * @dev 1e18 indicates 100%. If this returns 5e17, that means 50% of emissions go to locks.
     * @param target_ The user address to query.
     * @return The fraction of emissions allocated to locks for the given user.
     */
    function getToLocksPercentage(address target_) external view returns (uint256);

    /**
     * @notice Determines how many tokens will be sent to locks from a given emission amount.
     * @dev Simple utility that multiplies `amountIn_` by the user’s `toLocksPercentage` ratio.
     * @param target_ The user address.
     * @param amountIn_ The emission amount to be distributed.
     * @return The portion of `amountIn_` that should be locked.
     */
    function getAmountOutToLocks(address target_, uint256 amountIn_) external view returns (uint256);
}
