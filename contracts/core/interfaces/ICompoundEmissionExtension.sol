// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./IVoter.sol";

/**
 * @title ICompoundEmissionExtension
 * @notice
 *  This interface defines the external functions and data structures for an extension
 *  that automatically compounds user emissions into veNFT locks and/or bribe pools.
 *  Users can configure how their claimed emissions are split across multiple veNFTs
 *  (`TargetLock[]`) and multiple bribe pools (`TargetPool[]`).
 */
interface ICompoundEmissionExtension {
    /**
     * @notice Describes a specific veNFT token lock target and the fraction of emissions to deposit there.
     * @dev
     *  - `percentage` is in 1e18 format (1e18 = 100%).
     *  - If `tokenId` is zero, a new veNFT lock may be created in the compounding process.
     */
    struct TargetLock {
        /**
         * @notice The identifier of an existing veNFT. If zero, a new veNFT may be created.
         */
        uint256 tokenId;
        /**
         * @notice Fraction of allocated emissions for this target (1e18 = 100%).
         */
        uint256 percentage;
    }

    /**
     * @notice Defines the fraction of emissions to be sent to a particular pool's bribe contract.
     * @dev
     *  - `percentage` is in 1e18 format (1e18 = 100%).
     *  - If the associated gauge is dead/killed, fallback logic may apply (e.g., lock creation).
     */
    struct TargetPool {
        /**
         * @notice The address of the pool whose external bribe contract will receive emissions.
         */
        address pool;
        /**
         * @notice Fraction of allocated emissions for this pool (1e18 = 100%).
         */
        uint256 percentage;
    }

    /**
     * @notice Encapsulates parameters for updating a user's compound-emission configuration in a single call.
     * @dev
     *  - `toLocksPercentage + toBribePoolsPercentage` must not exceed 1e18.
     *  - Sum of percentages in `targetLocks` must be 1e18 if `toLocksPercentage > 0`.
     *  - Sum of percentages in `targetsBribePools` must be 1e18 if `toBribePoolsPercentage > 0`.
     *  - If updating `TargetLock[]` or `TargetPool[]`, the array must match the respective percentage being >0.
     */
    struct UpdateCompoundEmissionConfigParams {
        /**
         * @notice Whether to update the overall fraction sent to locks vs. bribe pools.
         */
        bool shouldUpdateGeneralPercentages;
        /**
         * @notice Whether to replace the user's entire array of `TargetLock[]`.
         */
        bool shouldUpdateTargetLocks;
        /**
         * @notice Whether to replace the user's entire array of `TargetPool[]`.
         */
        bool shouldUpdateTargetBribePools;
        /**
         * @notice Fraction of the user's total emissions allocated to veNFT locks (1e18 = 100%).
         */
        uint256 toLocksPercentage;
        /**
         * @notice Fraction of the user's total emissions allocated to bribe pools (1e18 = 100%).
         */
        uint256 toBribePoolsPercentage;
        /**
         * @notice The new set of veNFT lock targets (replaces the old array if updated).
         */
        TargetLock[] targetLocks;
        /**
         * @notice The new set of bribe pool targets (replaces the old array if updated).
         */
        TargetPool[] targetsBribePools;
    }

    /**
     * @notice Configuration options for creating or depositing into veNFTs during compounding.
     * @dev
     *  - If `withPermanentLock` is `true`, `lockDuration` is ignored (the lock is permanent).
     *  - If `managedTokenIdForAttach` is nonzero, the deposit may be attached to an existing managed veNFT.
     */
    struct CreateLockConfig {
        /**
         * @notice Whether the created lock should be considered "boosted" (if the underlying system supports boosted logic).
         */
        bool shouldBoosted;
        /**
         * @notice Whether the lock is permanent (no withdrawal).
         */
        bool withPermanentLock;
        /**
         * @notice Duration in seconds for the lock if it is not permanent.
         */
        uint256 lockDuration;
        /**
         * @notice An optional managed veNFT ID for attaching a new deposit.
         */
        uint256 managedTokenIdForAttach;
    }

    /**
     * @notice Parameters to claim emissions from the Voter, which are then compounded into locks and/or bribe pools.
     * @dev
     *  - `target` is the user whose emissions are being claimed.
     *  - `gauges` is a list of gauge addresses for which to claim the user’s emissions.
     *  - `merkl` is optional merkle-based claim data (if the Voter supports merkle proofs).
     */
    struct ClaimParams {
        /**
         * @notice The user whose emissions will be claimed and compounded.
         */
        address target;
        /**
         * @notice The gauge addresses to claim emissions from.
         */
        address[] gauges;
        /**
         * @notice Optional data for merkle-based claims, if applicable in the Voter implementation.
         */
        IVoter.AggregateClaimMerklDataParams merkl;
    }

    // --------------------- Events ---------------------

    /**
     * @notice Emitted when the default lock configuration is updated.
     * @param config The new default configuration for creating veNFT locks.
     */
    event SetDefaultCreateLockConfig(CreateLockConfig config);

    /**
     * @notice Emitted when a user sets or removes their custom configuration for creating veNFT locks.
     * @param user   The user whose configuration changed.
     * @param config The new config, or default values if removed.
     */
    event SetCreateLockConfig(address indexed user, CreateLockConfig config);

    /**
     * @notice Emitted when a user updates their overall percentages of emissions allocated to locks vs. bribe pools.
     * @param user                The user whose allocation changed.
     * @param toLocksPercentage   Fraction of emissions allocated to locks (1e18 = 100%).
     * @param toBribePoolsPercentage Fraction of emissions allocated to bribe pools (1e18 = 100%).
     */
    event SetCompoundEmissionGeneralPercentages(address indexed user, uint256 toLocksPercentage, uint256 toBribePoolsPercentage);

    /**
     * @notice Emitted when a user replaces or updates their entire array of lock targets.
     * @param user        The user whose targets changed.
     * @param targetLocks The new array of `TargetLock` structs.
     */
    event SetCompoundEmissionTargetLocks(address indexed user, TargetLock[] targetLocks);

    /**
     * @notice Emitted when a user replaces or updates their entire array of bribe pool targets.
     * @param user              The user whose targets changed.
     * @param targetBribePools  The new array of `TargetPool` structs.
     */
    event SetCompoundEmissionTargetBribePools(address indexed user, TargetPool[] targetBribePools);

    /**
     * @notice Emitted when a user changes the veNFT token ID in an existing emission distribution target lock.
     * @param user             The user making the change.
     * @param targetLockFromId The old token ID to be replaced.
     * @param targetTokenToId  The new token ID (0 if effectively removing the old lock reference).
     */
    event ChangeEmissionTargetLock(address indexed user, uint256 targetLockFromId, uint256 targetTokenToId);

    /**
     * @notice Emitted when a new veNFT lock is created due to emission compounding.
     * @param user    The user for whom the lock was created.
     * @param tokenId The newly created veNFT token ID.
     * @param amount  The amount of tokens locked.
     */
    event CreateLockFromCompoundEmission(address indexed user, uint256 indexed tokenId, uint256 amount);

    /**
     * @notice Emitted when a new veNFT lock is created during fallback logic for bribe pools (e.g., if the gauge is killed).
     * @param user    The user for whom the fallback lock was created.
     * @param pool    The bribe pool that was originally intended to receive tokens.
     * @param tokenId The newly created veNFT token ID.
     * @param amount  The amount of tokens locked instead of bribe distribution.
     */
    event CreateLockFromCompoundEmissionForBribePools(address indexed user, address pool, uint256 indexed tokenId, uint256 amount);

    /**
     * @notice Emitted when a user compounds emissions into a specific bribe pool.
     * @param user   The user compounding emissions.
     * @param pool   The bribe pool receiving the tokens.
     * @param amount The amount of tokens deposited.
     */
    event CompoundEmissionToBribePool(address indexed user, address pool, uint256 amount);

    /**
     * @notice Emitted when a user compounds emissions into an existing veNFT lock.
     * @param user    The address of the user compounding emissions.
     * @param tokenId The identifier of the veNFT receiving the deposit.
     * @param amount  The amount of tokens deposited into the lock.
     */
    event CompoundEmissionToTargetLock(address indexed user, uint256 indexed tokenId, uint256 amount);

    // --------------------- External Functions ---------------------

    /**
     * @notice Batch operation to claim and compound emissions for multiple users simultaneously.
     * @dev
     *  - Only callable by addresses with the COMPOUND_KEEPER_ROLE.
     *  - Iterates over each user's claim, collecting and distributing emissions according to user configs.
     *
     * @param claimsParams_ An array of `ClaimParams`, one for each user to process.
     */
    function compoundEmissionClaimBatch(ClaimParams[] calldata claimsParams_) external;

    /**
     * @notice Allows an individual user to claim and compound emissions for specified gauges.
     * @dev
     *  - Only callable by the user matching `claimParams_.target`.
     *  - Collects emissions from the specified gauges, then distributes them to veNFT locks and bribe pools.
     *
     * @param claimParams_ The struct containing:
     *  - `target`: user whose emissions are being claimed.
     *  - `gauges`: gauges to claim from.
     *  - `merkl`: optional merkle claim data.
     */
    function compoundEmisisonClaim(ClaimParams calldata claimParams_) external;

    /**
     * @notice Updates occurrences of `targetTokenId_` in a user's `TargetLock[]` to `newTokenId_`.
     * @dev
     *  - If multiple entries reference `targetTokenId_`, all will be replaced.
     *  - If `newTokenId_ = 0`, references to `targetTokenId_` are cleared,
     *    effectively enabling a new veNFT to be created in future compounding for that portion.
     *  - Typically called by the Voter after a veNFT transfer or merge.
     *
     * @param target_        The user whose `TargetLock[]` will be updated.
     * @param targetTokenId_ The old token ID to search for in that user's target array.
     * @param newTokenId_    The new token ID to replace the old one. Zero if removing.
     */
    function changeEmissionTargetLockId(address target_, uint256 targetTokenId_, uint256 newTokenId_) external;

    /**
     * @notice Retrieves the fraction (in 1e18 scale) of a user's emissions allocated to veNFT locks.
     * @dev A value of 1e18 indicates 100%. If this returns 5e17, that means 50% is allocated.
     * @param target_ The user address to query.
     * @return The fraction of emissions (1e18 = 100%) allocated to locks.
     */
    function getToLocksPercentage(address target_) external view returns (uint256);

    /**
     * @notice Returns how much of a given `amountIn_` would be allocated to locks vs. bribe pools for a user.
     * @dev Does not break down per veNFT or per pool, only the high-level split.
     * @param target_   The user whose configuration to apply.
     * @param amountIn_ The total emission amount to be distributed.
     * @return toTargetLocks      The portion allocated to veNFT locks.
     * @return toTargetBribePools The portion allocated to bribe pools.
     */
    function getAmountOutToCompound(
        address target_,
        uint256 amountIn_
    ) external view returns (uint256 toTargetLocks, uint256 toTargetBribePools);
}
