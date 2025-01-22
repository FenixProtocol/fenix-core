// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.19;

import "./interfaces/ICompoundEmissionExtension.sol";
import "./interfaces/IVoter.sol";
import "./interfaces/IVotingEscrow.sol";
import "../bribes/interfaces/IBribe.sol";

import {BlastGovernorClaimableSetup} from "../integration/BlastGovernorClaimableSetup.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {SafeERC20Upgradeable, IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

/**
 * @title CompoundEmissionExtensionUpgradeable
 * @notice
 *  This contract serves as an extension on top of a Voter contract to automatically
 *  compound user emissions into veNFT locks and/or Bribe pools. Users may configure
 *  how their claimed emissions are allocated among:
 *    1) Multiple veNFT locks (via TargetLock[]).
 *    2) Multiple bribe pools (via TargetPool[]).
 *
 *  The user can define what fraction (percentage) of their emissions goes to locks
 *  and what fraction goes to bribe pools. Each fraction’s distribution can further be
 *  split across multiple targets (locks and/or bribe pools).
 *
 *  The contract also supports creating or depositing into veNFT locks with configurable
 *  lock parameters, either via a user-specific config or a global default config.
 *
 * @dev
 *  - Inherits from {BlastGovernorClaimableSetup} for governance claimable functionality.
 *  - Inherits from {ReentrancyGuardUpgradeable} to protect state-mutating functions
 *    from reentrancy attacks.
 *  - Relies on the Voter’s roles to manage who can call certain functions.
 *    Specifically, only addresses with the COMPOUND_KEEPER_ROLE can perform batch
 *    compounding on behalf of users.
 */
contract CompoundEmissionExtensionUpgradeable is ICompoundEmissionExtension, BlastGovernorClaimableSetup, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /**
     * @notice Precision factor for percentage calculations (1e18 = 100%).
     */
    uint256 internal constant _PRECISION = 1e18;

    /**
     * @notice Role for the keeper responsible for triggering emission compounding
     *         (e.g., on a regular schedule).
     */
    bytes32 public constant COMPOUND_KEEPER_ROLE = keccak256("COMPOUND_KEEPER_ROLE");

    /**
     * @notice Role for the administrator with permissions to set default create-lock configurations.
     */
    bytes32 public constant COMPOUND_EMISSION_EXTENSION_ADMINISTRATOR_ROLE = keccak256("COMPOUND_EMISSION_EXTENSION_ADMINISTRATOR_ROLE");

    /**
     * @notice The address of the Voter contract from which emissions will be claimed.
     */
    address public voter;

    /**
     * @notice The token being locked (and compounded) in the VotingEscrow contract.
     */
    address public token;

    /**
     * @notice The VotingEscrow contract address where emissions are locked.
     */
    address public votingEscrow;

    /**
     * @notice The default configuration for creating new locks if a user has not set a custom config.
     *
     * @dev
     *  - `shouldBoosted` Whether to treat the lock as boosted.
     *  - `withPermanentLock` Whether this lock is permanently locked.
     *  - `lockDuration` The duration (in seconds) for the lock (ignored if `withPermanentLock = true`).
     *  - `managedTokenIdForAttach` An optional existing managed veNFT ID to which this deposit is attached.
     */
    CreateLockConfig public defaultCreateLockConfig;

    /**
     * @notice For each user, the fraction of emissions that should be deposited into veNFT locks (in 1e18 = 100%).
     */
    mapping(address => uint256) public getToLocksPercentage;

    /**
     * @notice For each user, the fraction of emissions that should be deposited into bribe pools (in 1e18 = 100%).
     */
    mapping(address => uint256) public getToBribePoolsPercentage;

    /**
     * @notice Indicates whether a user has a custom `CreateLockConfig` set.
     */
    mapping(address => bool) internal _usersCreateLockConfigIsEnable;

    /**
     * @notice The user’s custom `CreateLockConfig`, if `_usersCreateLockConfigIsEnable[user]` is true.
     */
    mapping(address => CreateLockConfig) internal _usersCreateLockConfigs;

    /**
     * @notice Defines how a user’s allocated portion for veNFT locks is further split among multiple locks.
     *
     * @dev Each entry includes a `tokenId` of an existing veNFT lock and a `percentage` (1e18 = 100%)
     *      indicating how that portion is distributed. All `TargetLock[]` for a user must sum to 1e18
     *      if the user has a nonzero `getToLocksPercentage[user]`.
     */
    mapping(address => TargetLock[]) internal _usersCompoundEmissionTargetLocks;

    /**
     * @notice Defines how a user’s allocated portion for bribe pools is further split among multiple pools.
     *
     * @dev Each entry includes an address of the pool, and a `percentage` (1e18 = 100%)
     *      indicating how that portion is distributed. All `TargetPool[]` for a user must sum to 1e18
     *      if the user has a nonzero `getToBribePoolsPercentage[user]`.
     */
    mapping(address => TargetPool[]) internal _usersCompoundEmissionTargetBribesPools;

    /**
     * @notice Thrown when an invalid lock configuration is provided.
     */
    error InvalidCreateLockConfig();

    /**
     * @notice Thrown when the user sets an invalid emission compounding parameter combination.
     */
    error InvalidCompoundEmissionParams();

    /**
     * @notice Thrown when attempting to set token locks for a veNFT that does not belong to the user.
     */
    error AnotherUserTargetLocks();

    /**
     * @notice Thrown when access is denied for the operation.
     */
    error AccessDenied();

    /**
     * @notice Thrown when attempting to set a target bribe pool that is associated with a killed gauge.
     */
    error TargetPoolGaugeIsKilled();

    /**
     * @dev Restricts execution to addresses holding the specified role in the Voter contract.
     * @param role_ The role required for the function call.
     */
    modifier onlyRole(bytes32 role_) {
        if (!IVoter(voter).hasRole(role_, msg.sender)) {
            revert AccessDenied();
        }
        _;
    }

    /**
     * @notice Contract constructor that also initializes the BlastGovernorClaimableSetup with `blastGovernor_`.
     *         Disables further initializers to ensure the contract cannot be re-initialized.
     * @param blastGovernor_ The address of the BlastGovernor contract for governance-related functionality.
     */
    constructor(address blastGovernor_) {
        __BlastGovernorClaimableSetup_init(blastGovernor_);
        _disableInitializers();
    }

    /**
     * @notice Initializes the compound emission extension (called once).
     * @dev
     *  - Sets default lock duration to approximately 6 months (15724800 seconds).
     *  - Should be invoked right after deployment.
     *
     * @param blastGovernor_ The address of the BlastGovernor contract.
     * @param voter_ The address of the Voter contract.
     * @param token_ The address of the token being locked in VotingEscrow.
     * @param votingEscrow_ The address of the VotingEscrow contract.
     */
    function initialize(address blastGovernor_, address voter_, address token_, address votingEscrow_) external initializer {
        __BlastGovernorClaimableSetup_init(blastGovernor_);
        __ReentrancyGuard_init();
        voter = voter_;
        token = token_;
        votingEscrow = votingEscrow_;
        defaultCreateLockConfig = CreateLockConfig(false, false, 15724800, 0);
    }

    /**
     * @notice Sets the global default create-lock configuration. This applies to any user that does not have a custom config.
     * @dev Only callable by addresses with the COMPOUND_EMISSION_EXTENSION_ADMINISTRATOR_ROLE role.
     * @param config_ The new default `CreateLockConfig`.
     *
     * Requirements:
     * - `config_.lockDuration` must be nonzero if `withPermanentLock` is false.
     * - At least one of `withPermanentLock`, `lockDuration`, or `managedTokenIdForAttach` must be set if `shouldBoosted` is false.
     *
     * Emits a {SetDefaultCreateLockConfig} event.
     */
    function setDefaultCreateLockConfig(
        CreateLockConfig calldata config_
    ) external onlyRole(COMPOUND_EMISSION_EXTENSION_ADMINISTRATOR_ROLE) {
        if (!config_.withPermanentLock && config_.lockDuration == 0 && config_.managedTokenIdForAttach == 0 && !config_.shouldBoosted) {
            revert InvalidCreateLockConfig();
        }
        if (config_.lockDuration == 0 && !config_.withPermanentLock) {
            revert InvalidCreateLockConfig();
        }
        defaultCreateLockConfig = config_;
        emit SetDefaultCreateLockConfig(config_);
    }

    /**
     * @notice Sets or removes a user-specific `CreateLockConfig`.
     * @dev
     *  - If all parameters in `config_` are zero/false, the user's config is removed,
     *    reverting them to using the default config.
     *  - Otherwise, the config must be valid (nonzero lock duration if `withPermanentLock` = false).
     *
     * @param config_ The `CreateLockConfig` for the caller (`msg.sender`).
     *
     * Emits a {SetCreateLockConfig} event.
     */
    function setCreateLockConfig(CreateLockConfig calldata config_) external {
        if (!config_.withPermanentLock && config_.lockDuration == 0 && config_.managedTokenIdForAttach == 0 && !config_.shouldBoosted) {
            delete _usersCreateLockConfigIsEnable[msg.sender];
            delete _usersCreateLockConfigs[msg.sender];
        } else {
            if (config_.lockDuration == 0 && !config_.withPermanentLock) {
                revert InvalidCreateLockConfig();
            }
            _usersCreateLockConfigIsEnable[msg.sender] = true;
            _usersCreateLockConfigs[msg.sender] = config_;
        }
        emit SetCreateLockConfig(msg.sender, config_);
    }

    /**
     * @notice Updates the user’s emission compounding configuration, including:
     *  - Percentages allocated to locks vs. bribe pools.
     *  - The specific lock targets (`TargetLock[]`).
     *  - The specific bribe pool targets (`TargetPool[]`).
     *
     * @dev
     *  - The total of `toLocksPercentage + toBribePoolsPercentage` cannot exceed 1e18 (100%).
     *  - If `toLocksPercentage > 0`, then there must be a nonempty `targetLocks` array (and vice versa).
     *  - If `toBribePoolsPercentage > 0`, then there must be a nonempty `targetsBribePools` array (and vice versa).
     *  - The sum of all `percentage` fields in `targetLocks` must be exactly 1e18 if updating them.
     *  - The sum of all `percentage` fields in `targetsBribePools` must be exactly 1e18 if updating them.
     *  - Each `targetLocks[i].tokenId` must belong to the caller if nonzero.
     *  - Each `targetsBribePools[i].pool` must correspond to a gauge that is alive.
     *
     * @param p_ A struct with the following fields:
     *  - `shouldUpdateGeneralPercentages` Whether to update the overall splits to locks/bribe pools.
     *  - `shouldUpdateTargetLocks`       Whether to replace the entire array of user’s `TargetLock[]`.
     *  - `shouldUpdateTargetBribePools`  Whether to replace the entire array of user’s `TargetPool[]`.
     *  - `toLocksPercentage`             The fraction of user’s emissions allocated to locks (1e18 = 100%).
     *  - `toBribePoolsPercentage`        The fraction of user’s emissions allocated to bribe pools (1e18 = 100%).
     *  - `targetLocks`                   The new `TargetLock[]`, each with a `tokenId` and `percentage`.
     *  - `targetsBribePools`             The new `TargetPool[]`, each with a `pool` and `percentage`.
     *
     * Emits {SetCompoundEmissionGeneralPercentages} if `shouldUpdateGeneralPercentages` is true.
     * Emits {SetCompoundEmissionTargetLocks} if `shouldUpdateTargetLocks` is true.
     * Emits {SetCompoundEmissionTargetBribePools} if `shouldUpdateTargetBribePools` is true.
     *
     * Reverts with {InvalidCompoundEmissionParams} if the inputs fail the above constraints.
     */
    function setCompoundEmissionConfig(UpdateCompoundEmissionConfigParams calldata p_) external {
        uint256 newTargetLocksLength = p_.shouldUpdateTargetLocks
            ? p_.targetLocks.length
            : _usersCompoundEmissionTargetLocks[msg.sender].length;

        uint256 newTargetBribePoolsLength = p_.shouldUpdateTargetBribePools
            ? p_.targetsBribePools.length
            : _usersCompoundEmissionTargetBribesPools[msg.sender].length;

        uint256 newToTargetLocksPercentage = p_.shouldUpdateGeneralPercentages ? p_.toLocksPercentage : getToLocksPercentage[msg.sender];

        uint256 newToTargetBribePoolsPercentage = p_.shouldUpdateGeneralPercentages
            ? p_.toBribePoolsPercentage
            : getToBribePoolsPercentage[msg.sender];

        if (newToTargetLocksPercentage + newToTargetBribePoolsPercentage > _PRECISION) {
            revert InvalidCompoundEmissionParams();
        }

        if (
            (newToTargetLocksPercentage > 0 && newTargetLocksLength == 0) || (newToTargetLocksPercentage == 0 && newTargetLocksLength > 0)
        ) {
            revert InvalidCompoundEmissionParams();
        }

        if (
            (newToTargetBribePoolsPercentage > 0 && newTargetBribePoolsLength == 0) ||
            (newToTargetBribePoolsPercentage == 0 && newTargetBribePoolsLength > 0)
        ) {
            revert InvalidCompoundEmissionParams();
        }

        if (p_.shouldUpdateTargetLocks && newToTargetLocksPercentage > 0) {
            IVotingEscrow votingEscrowCache = IVotingEscrow(votingEscrow);
            uint256 targetLocksSumPercentage;
            for (uint256 i; i < p_.targetLocks.length; ) {
                uint256 percentage = p_.targetLocks[i].percentage;
                if (p_.targetLocks[i].tokenId != 0) {
                    if (votingEscrowCache.ownerOf(p_.targetLocks[i].tokenId) != msg.sender) {
                        revert AnotherUserTargetLocks();
                    }
                }

                if (percentage == 0) {
                    revert InvalidCompoundEmissionParams();
                }

                targetLocksSumPercentage += p_.targetLocks[i].percentage;
                unchecked {
                    i++;
                }
            }
            if (targetLocksSumPercentage != _PRECISION) {
                revert InvalidCompoundEmissionParams();
            }

            _usersCompoundEmissionTargetLocks[msg.sender] = p_.targetLocks;
            emit SetCompoundEmissionTargetLocks(msg.sender, p_.targetLocks);
        }

        if (p_.shouldUpdateTargetBribePools && newToTargetBribePoolsPercentage > 0) {
            IVoter voterCache = IVoter(voter);

            uint256 targetBribePoolsSumPercentage;

            for (uint256 i; i < p_.targetsBribePools.length; ) {
                address targetPool = p_.targetsBribePools[i].pool;
                uint256 percentage = p_.targetsBribePools[i].percentage;

                if (targetPool == address(0) || percentage == 0) {
                    revert InvalidCompoundEmissionParams();
                }

                address gauge = voterCache.poolToGauge(targetPool);
                if (!voterCache.isAlive(gauge)) {
                    revert TargetPoolGaugeIsKilled();
                }

                targetBribePoolsSumPercentage += percentage;

                unchecked {
                    i++;
                }
            }

            if (targetBribePoolsSumPercentage != _PRECISION) {
                revert InvalidCompoundEmissionParams();
            }

            _usersCompoundEmissionTargetBribesPools[msg.sender] = p_.targetsBribePools;
            emit SetCompoundEmissionTargetBribePools(msg.sender, p_.targetsBribePools);
        }

        if (p_.shouldUpdateGeneralPercentages) {
            if (newToTargetLocksPercentage == 0) {
                delete _usersCompoundEmissionTargetLocks[msg.sender];
                emit SetCompoundEmissionTargetLocks(msg.sender, p_.targetLocks);
            }
            if (newToTargetBribePoolsPercentage == 0) {
                delete _usersCompoundEmissionTargetBribesPools[msg.sender];
                emit SetCompoundEmissionTargetBribePools(msg.sender, p_.targetsBribePools);
            }

            getToLocksPercentage[msg.sender] = newToTargetLocksPercentage;
            getToBribePoolsPercentage[msg.sender] = newToTargetBribePoolsPercentage;
            emit SetCompoundEmissionGeneralPercentages(msg.sender, p_.toLocksPercentage, p_.toBribePoolsPercentage);
        }
    }

    /**
     * @notice Retrieves the effective `CreateLockConfig` for a user, falling back to `defaultCreateLockConfig` if none is set.
     * @param target_ The address of the user.
     * @return createLockConfig The effective config for the user (custom if set, otherwise default).
     */
    function getUserCreateLockConfig(address target_) public view returns (CreateLockConfig memory createLockConfig) {
        return _usersCreateLockConfigIsEnable[target_] ? _usersCreateLockConfigs[target_] : defaultCreateLockConfig;
    }

    /**
     * @notice Retrieves a user’s overall emission-compounding configuration.
     * @param target_ The address of the user.
     * @return toLocksPercentage              Fraction allocated to veNFT locks (1e18=100%).
     * @return toBribePoolsPercentage         Fraction allocated to bribe pools (1e18=100%).
     * @return isCreateLockCustomConfig       Whether the user has a custom `CreateLockConfig`.
     * @return createLockConfig               The effective `CreateLockConfig` (custom or default).
     * @return targetLocks                    The user’s `TargetLock[]` array.
     * @return targetBribePools               The user’s `TargetPool[]` array.
     */
    function getUserInfo(
        address target_
    )
        external
        view
        returns (
            uint256 toLocksPercentage,
            uint256 toBribePoolsPercentage,
            bool isCreateLockCustomConfig,
            CreateLockConfig memory createLockConfig,
            TargetLock[] memory targetLocks,
            TargetPool[] memory targetBribePools
        )
    {
        toLocksPercentage = getToLocksPercentage[target_];
        toBribePoolsPercentage = getToBribePoolsPercentage[target_];
        createLockConfig = getUserCreateLockConfig(target_);
        targetLocks = _usersCompoundEmissionTargetLocks[target_];
        isCreateLockCustomConfig = _usersCreateLockConfigIsEnable[target_];
        targetBribePools = _usersCompoundEmissionTargetBribesPools[target_];
    }

    /**
     * @notice Batch operation for compounding emissions for multiple users.
     * @dev
     *  - Only callable by addresses with the COMPOUND_KEEPER_ROLE.
     *  - Processes each user’s claim in a single transaction.
     *
     * @param claimsParams_ An array of `ClaimParams` describing each user's claim details:
     *   - `target`: The user whose emissions are being claimed.
     *   - `gauges`: The array of gauge addresses to claim from.
     *   - `merkl`:  Optional data for merkle-based claims (if applicable).
     */
    function compoundEmissionClaimBatch(ClaimParams[] calldata claimsParams_) external onlyRole(COMPOUND_KEEPER_ROLE) nonReentrant {
        for (uint256 i; i < claimsParams_.length; ) {
            _compoundEmissionClaim(claimsParams_[i]);
            unchecked {
                i++;
            }
        }
    }

    /**
     * @notice Allows a user to directly compound their emissions for the specified gauges.
     * @dev
     *  - Only callable by the user themselves (`claimParams_.target`).
     *
     * @param claimParams_ The `ClaimParams` struct:
     *   - `target`: The user who is claiming.
     *   - `gauges`: The array of gauge addresses to claim from.
     *   - `merkl`:  Optional data for merkle-based claims.
     */
    function compoundEmisisonClaim(ClaimParams calldata claimParams_) external nonReentrant {
        _checkSender(claimParams_.target);
        _compoundEmissionClaim(claimParams_);
    }

    /**
     * @notice Disambiguates changes to a user’s `TargetLock[]` token IDs in case of merges or transfers.
     * @dev
     *  - If multiple entries reference `targetTokenId_`, all will be updated to `newTokenId_`.
     *  - If `newTokenId_ = 0`, these entries are cleared, meaning a new veNFT can be created
     *    next time if that portion is used for compounding.
     *  - Typically called by the Voter after a veNFT merge or transfer event.
     *
     * @param target_        The user whose `TargetLock[]` to update.
     * @param targetTokenId_ The old token ID in the user’s array.
     * @param newTokenId_    The new token ID to replace the old one (0 if removing).
     *
     * Emits a {ChangeEmissionTargetLock} event whenever a replacement occurs.
     */
    function changeEmissionTargetLockId(address target_, uint256 targetTokenId_, uint256 newTokenId_) external nonReentrant {
        _checkSender(voter);
        if (getToLocksPercentage[target_] > 0) {
            TargetLock[] memory targetLocks = _usersCompoundEmissionTargetLocks[target_];
            for (uint256 i; i < targetLocks.length; ) {
                if (targetLocks[i].tokenId == targetTokenId_) {
                    _usersCompoundEmissionTargetLocks[target_][i].tokenId = newTokenId_;
                    emit ChangeEmissionTargetLock(target_, targetTokenId_, newTokenId_);
                }
                unchecked {
                    i++;
                }
            }
        }
    }

    /**
     * @notice Calculates how much of `amountIn_` would be allocated to locks vs. bribe pools for a given user.
     * @dev Does not factor in how that portion is further split among multiple `TargetLock[]` or `TargetPool[]`.
     * @param target_  The user in question.
     * @param amountIn_ The total amount of tokens to be distributed for the user.
     * @return toTargetLocks      The portion allocated to veNFT locks.
     * @return toTargetBribePools The portion allocated to bribe pools.
     */
    function getAmountOutToCompound(
        address target_,
        uint256 amountIn_
    ) external view returns (uint256 toTargetLocks, uint256 toTargetBribePools) {
        toTargetLocks = (getToLocksPercentage[target_] * amountIn_) / _PRECISION;
        toTargetBribePools = (getToBribePoolsPercentage[target_] * amountIn_) / _PRECISION;
    }

    /**
     * @dev Core logic to compound the user’s claimed emissions into veNFT locks
     *      and/or bribe pools, as dictated by their configuration.
     *
     * Steps:
     *   1) Call Voter to claim the user’s emissions from specified gauges.
     *   2) Transfer those claimed tokens from Voter to this contract.
     *   3) Based on user’s config, deposit the appropriate amounts into:
     *       (a) veNFT locks (creating new or depositing into existing).
     *       (b) Bribe pools.
     *
     * @param claimParams_ The user’s claim info from {ClaimParams}.
     */
    function _compoundEmissionClaim(ClaimParams calldata claimParams_) internal {
        IVoter voterCache = IVoter(voter);
        (uint256 toTargetLocks, uint256 toTargetBribePools) = voterCache.onCompoundEmissionClaim(
            claimParams_.target,
            claimParams_.gauges,
            claimParams_.merkl
        );

        if (toTargetLocks + toTargetBribePools == 0) {
            return;
        }

        IERC20Upgradeable tokenCache = IERC20Upgradeable(token);
        IVotingEscrow votingEscrowCache = IVotingEscrow(votingEscrow);
        CreateLockConfig memory userCreateLockConfig = getUserCreateLockConfig(claimParams_.target);

        tokenCache.safeTransferFrom(address(voterCache), address(this), toTargetLocks + toTargetBribePools);

        if (toTargetLocks > 0) {
            tokenCache.safeApprove(address(votingEscrowCache), toTargetLocks);

            TargetLock[] memory targetLocks = _usersCompoundEmissionTargetLocks[claimParams_.target];
            uint256 length = targetLocks.length;

            for (uint256 i; i < length; ) {
                TargetLock memory targetLock = targetLocks[i];
                uint256 amount = (targetLock.percentage * toTargetLocks) / _PRECISION;
                if (targetLock.tokenId == 0) {
                    targetLock.tokenId = votingEscrowCache.createLockFor(
                        amount,
                        userCreateLockConfig.lockDuration,
                        claimParams_.target,
                        userCreateLockConfig.shouldBoosted,
                        userCreateLockConfig.withPermanentLock,
                        userCreateLockConfig.managedTokenIdForAttach
                    );

                    _usersCompoundEmissionTargetLocks[claimParams_.target][i].tokenId = targetLock.tokenId;
                    emit CreateLockFromCompoundEmission(claimParams_.target, targetLock.tokenId, amount);
                } else {
                    votingEscrowCache.depositFor(targetLock.tokenId, amount, false, false);
                    emit CompoundEmissionToTargetLock(claimParams_.target, targetLock.tokenId, amount);
                }
                unchecked {
                    i++;
                }
            }
        }

        if (toTargetBribePools > 0) {
            TargetPool[] memory targetBribePools = _usersCompoundEmissionTargetBribesPools[claimParams_.target];
            uint256 length = targetBribePools.length;

            for (uint256 i; i < length; ) {
                TargetPool memory targetPool = targetBribePools[i];
                address gauge = voterCache.poolToGauge(targetPool.pool);
                uint256 amount = (targetPool.percentage * toTargetBribePools) / _PRECISION;

                if (voterCache.isAlive(gauge)) {
                    address externalBribe = voterCache.getGaugeState(gauge).externalBribe;
                    tokenCache.safeApprove(externalBribe, amount);
                    IBribe(externalBribe).notifyRewardAmount(address(tokenCache), amount);
                    emit CompoundEmissionToBribePool(claimParams_.target, targetPool.pool, amount);
                } else {
                    tokenCache.safeApprove(address(votingEscrowCache), amount);
                    uint256 tokenId = votingEscrowCache.createLockFor(
                        amount,
                        userCreateLockConfig.lockDuration,
                        claimParams_.target,
                        userCreateLockConfig.shouldBoosted,
                        userCreateLockConfig.withPermanentLock,
                        userCreateLockConfig.managedTokenIdForAttach
                    );
                    emit CreateLockFromCompoundEmissionForBribePools(claimParams_.target, targetPool.pool, tokenId, amount);
                }

                unchecked {
                    i++;
                }
            }
        }
    }

    /**
     * @dev Checks that `msg.sender` matches `expected_`; otherwise reverts with {AccessDenied}.
     * @param expected_ The address required for the operation.
     */
    function _checkSender(address expected_) internal view {
        if (msg.sender != expected_) {
            revert AccessDenied();
        }
    }
}
