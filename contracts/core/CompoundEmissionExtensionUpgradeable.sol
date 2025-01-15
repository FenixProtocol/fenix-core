// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

import "./interfaces/ICompoundEmissionExtension.sol";
import "./interfaces/IVoter.sol";
import "./interfaces/IVotingEscrow.sol";

import {BlastGovernorClaimableSetup} from "../integration/BlastGovernorClaimableSetup.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {SafeERC20Upgradeable, IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

/**
 * @title CompoundEmissionExtensionUpgradeable
 * @notice Provides an additional layer of logic on top of a Voter contract to handle compounding emissions.
 *         Users can configure how their emissions are locked in VotingEscrow, automatically creating or depositing
 *         to veNFT (voting escrow NFTs) based on their preferences.
 * @dev Inherits from BlastGovernorClaimableSetup for claimable governance functionality and
 *      ReentrancyGuardUpgradeable for protecting critical operations from reentrancy attacks.
 */
contract CompoundEmissionExtensionUpgradeable is ICompoundEmissionExtension, BlastGovernorClaimableSetup, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /**
     * @notice Role for the keeper responsible for triggering emission compounding.
     */
    bytes32 public constant COMPOUND_KEEPER_ROLE = keccak256("COMPOUND_KEEPER_ROLE");

    /**
     * @notice Role for the administrator with permissions to set default compound emission configurations.
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
     */
    CreateLockConfig public defaultCreateLockConfig;

    /**
     * @notice Maps each user address to the fraction of emissions that should be deposited into locks.
     *         Denominated in 1e18 (100% = 1e18).
     */
    mapping(address => uint256) public getToLocksPercentage;

    /**
     * @notice Records whether a particular user has a custom `CreateLockConfig`.
     */
    mapping(address => bool) internal _usersCreateLockConfigIsEnable;

    /**
     * @notice Maps a user to their custom `CreateLockConfig`.
     */
    mapping(address => CreateLockConfig) internal _usersCreateLockConfigs;

    /**
     * @notice Maps a user to the array of `TargetLock` structures they have configured.
     *         These define how the user's emissions are split across multiple veNFT token IDs.
     */
    mapping(address => TargetLock[]) internal _usersCompoundEmissionTargetLocks;

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
     * @dev Restricts execution to accounts holding the specified role within the Voter contract.
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
     *         Disables further initializers to ensure the contract can't be re-initialized.
     * @param blastGovernor_ The address of the BlastGovernor contract for governance-related functionality.
     */
    constructor(address blastGovernor_) {
        __BlastGovernorClaimableSetup_init(blastGovernor_);
        _disableInitializers();
    }

    /**
     * @notice Initializes the compound emission extension.
     * @dev This function must be called after the contract is deployed (once).
     *      Sets default lock duration to approximately 6 months (15724800 seconds).
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
     * @notice Allows users to set or remove a custom lock configuration.
     * @dev If all parameters are zero/false, the user's custom config is removed and they'll fallback to the default config.
     * @param config_ The `CreateLockConfig` to set for the user.
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
     * @notice Sets how much of a user's claimed emissions should be locked, and how to distribute them across different veNFT locks.
     * @dev If `toLocksPercentage_ = 0`, no tokens are locked, and `targetLocks_` must be empty (and vice versa).
     * @param toLocksPercentage_ The fraction (1e18-based) of emissions to lock (100% = 1e18).
     * @param targetLocks_ An array of `TargetLock` structures defining how emissions are split among multiple veNFT IDs.
     *
     * Requirements:
     * - Sum of all `lockPercentage` in `targetLocks_` must be exactly 1e18 if `toLocksPercentage_ > 0`.
     * - The user must own each `tokenId` specified in `targetLocks_`, or set zero to create new locks
     */
    function setCompoundEmissionConfig(uint256 toLocksPercentage_, TargetLock[] calldata targetLocks_) external {
        if (toLocksPercentage_ > 1e18) {
            revert InvalidCompoundEmissionParams();
        }

        if ((toLocksPercentage_ == 0 && targetLocks_.length > 0) || (toLocksPercentage_ > 0 && targetLocks_.length == 0)) {
            revert InvalidCompoundEmissionParams();
        }

        if (toLocksPercentage_ == 0) {
            delete _usersCompoundEmissionTargetLocks[msg.sender];
        } else {
            IVotingEscrow votingEscrowCache = IVotingEscrow(votingEscrow);
            uint256 targetLocksSumPercentage;
            for (uint256 i; i < targetLocks_.length; ) {
                if (targetLocks_[i].tokenId != 0) {
                    if (votingEscrowCache.ownerOf(targetLocks_[i].tokenId) != msg.sender) {
                        revert AnotherUserTargetLocks();
                    }
                }
                targetLocksSumPercentage += targetLocks_[i].lockPercentage;
                unchecked {
                    i++;
                }
            }
            if (targetLocksSumPercentage != 1e18) {
                revert InvalidCompoundEmissionParams();
            }
            _usersCompoundEmissionTargetLocks[msg.sender] = targetLocks_;
        }

        getToLocksPercentage[msg.sender] = toLocksPercentage_;

        emit SetCompoundEmissionConfig(msg.sender, toLocksPercentage_, targetLocks_);
    }

    /**
     * @notice Retrieves the create-lock config for a specific user, falling back to the default config if the user has none.
     * @param target_ The user address to lookup.
     * @return createLockConfig The effective `CreateLockConfig` for the user.
     */
    function getUserCreateLockConfig(address target_) public view returns (CreateLockConfig memory createLockConfig) {
        return _usersCreateLockConfigIsEnable[target_] ? _usersCreateLockConfigs[target_] : defaultCreateLockConfig;
    }

    /**
     * @notice Returns information about a user's compounding configuration.
     * @param target_ The user address to lookup.
     * @return toLocksPercentage The fraction (1e18-based) of emissions that are locked.
     * @return isCustomConfig Whether the user has a custom config.
     * @return createLockConfig The effective `CreateLockConfig` for the user.
     * @return targetLocks An array of the user's current `TargetLock` structures.
     */
    function getUserInfo(
        address target_
    )
        external
        view
        returns (uint256 toLocksPercentage, bool isCustomConfig, CreateLockConfig memory createLockConfig, TargetLock[] memory targetLocks)
    {
        isCustomConfig = _usersCreateLockConfigIsEnable[target_];
        toLocksPercentage = getToLocksPercentage[target_];
        createLockConfig = getUserCreateLockConfig(target_);
        targetLocks = _usersCompoundEmissionTargetLocks[target_];
    }

    /**
     * @notice Batch operation for compounding emissions for multiple users.
     * @dev Only callable by the COMPOUND_KEEPER_ROLE.
     * @param claimsParams_ An array of `ClaimParams` describing each user's claim details.
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
     * @dev This can only be called by the user themselves (`claimParams_.target`).
     * @param claimParams_ The `ClaimParams` struct with details of the user's claim and configuration.
     */
    function compoundEmisisonClaim(ClaimParams calldata claimParams_) external nonReentrant {
        _checkSender(claimParams_.target);
        _compoundEmissionClaim(claimParams_);
    }

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
     * @notice Determines how many tokens will be sent to locks from a given emission amount.
     * @dev Simple utility that multiplies `amountIn_` by the user’s `toLocksPercentage` ratio.
     * @param target_ The user address.
     * @param amountIn_ The emission amount to be distributed.
     * @return The portion of `amountIn_` that should be locked.
     */
    function getAmountOutToLocks(address target_, uint256 amountIn_) external view returns (uint256) {
        return (getToLocksPercentage[target_] * amountIn_) / 1e18;
    }

    /**
     * @notice Compounds emissions for a single user by claiming rewards from gauges and Merkl distributions, then depositing
     *         the locked portion into one or more veNFT positions.
     * @dev
     *  - If a user sets `tokenId = 0` in any of their `TargetLock` entries, this function will create a new veNFT for them
     *    (using the current configuration in `CreateLockConfig`).
     *  - All tokens are transferred from the Voter to this extension, then approved and deposited in the VotingEscrow contract.
     * @param claimParams_ The parameters describing the user address, the gauges to claim from, and Merkl claim data.
     */
    function _compoundEmissionClaim(ClaimParams calldata claimParams_) internal {
        IVoter voterCache = IVoter(voter);
        uint256 toLocksAmount = voterCache.onCompoundEmissionClaim(claimParams_.target, claimParams_.gauges, claimParams_.merkl);
        if (toLocksAmount > 0) {
            IERC20Upgradeable tokenCache = IERC20Upgradeable(token);
            IVotingEscrow votingEscrowCache = IVotingEscrow(votingEscrow);

            tokenCache.safeTransferFrom(address(voterCache), address(this), toLocksAmount);
            tokenCache.safeApprove(address(votingEscrowCache), toLocksAmount);

            CreateLockConfig memory config = getUserCreateLockConfig(claimParams_.target);
            TargetLock[] memory targetLocks = _usersCompoundEmissionTargetLocks[claimParams_.target];

            for (uint256 i; i < targetLocks.length; ) {
                uint256 tokenId = targetLocks[i].tokenId;
                uint256 amount = (targetLocks[i].lockPercentage * toLocksAmount) / 1e18;
                if (tokenId == 0) {
                    tokenId = votingEscrowCache.createLockFor(
                        amount,
                        config.lockDuration,
                        claimParams_.target,
                        config.shouldBoosted,
                        config.withPermanentLock,
                        config.managedTokenIdForAttach
                    );
                    _usersCompoundEmissionTargetLocks[claimParams_.target][i].tokenId = tokenId;

                    emit CreateLockFromCompoundEmission(claimParams_.target, tokenId, amount);
                } else {
                    votingEscrowCache.depositFor(targetLocks[i].tokenId, amount, false, false);
                    emit CompoundEmissionToTargetLock(claimParams_.target, tokenId, amount);
                }

                unchecked {
                    i++;
                }
            }
        }
    }

    /**
     * @dev Checks that `msg.sender` matches the expected address, otherwise reverts.
     * @param expected_ The address required for this operation.
     */
    function _checkSender(address expected_) internal view {
        if (msg.sender != expected_) {
            revert AccessDenied();
        }
    }
}
