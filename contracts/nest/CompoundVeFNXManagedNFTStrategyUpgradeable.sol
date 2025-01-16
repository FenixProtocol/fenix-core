// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.19;

import {BaseManagedNFTStrategyUpgradeable, IManagedNFTManager} from "./BaseManagedNFTStrategyUpgradeable.sol";
import {SafeERC20Upgradeable, IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {IERC721ReceiverUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import {IERC721EnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721EnumerableUpgradeable.sol";
import {IVotingEscrow} from "../core/interfaces/IVotingEscrow.sol";
import {ISingelTokenVirtualRewarder} from "./interfaces/ISingelTokenVirtualRewarder.sol";
import {ICompoundVeFNXManagedNFTStrategy} from "./interfaces/ICompoundVeFNXManagedNFTStrategy.sol";
import {IRouterV2PathProvider, SingelTokenBuybackUpgradeable} from "./SingelTokenBuybackUpgradeable.sol";
import {LibStrategyFlags} from "./libraries/LibStrategyFlags.sol";
import {LibStrategyFlags} from "./libraries/LibStrategyFlags.sol";

/**
 * @title Compound VeFNX Managed NFT Strategy Upgradeable
 * @dev Strategy for managing VeFNX-related actions including compounding rewards and managing stakes.
 *      Extends the functionality of a base managed NFT strategy to interact with FENIX tokens.
 * @notice This strategy handles the automated compounding of VeFNX tokens by reinvesting harvested rewards back into VeFNX.
 */
contract CompoundVeFNXManagedNFTStrategyUpgradeable is
    ICompoundVeFNXManagedNFTStrategy,
    IERC721ReceiverUpgradeable,
    BaseManagedNFTStrategyUpgradeable,
    SingelTokenBuybackUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /**
     * @dev Reverts when attempting to recover tokens that are critical for the strategy and must not be removed
     *      (e.g., main FENIX tokens or locked veNFT).
     */
    error IncorrectRecoverToken();

    /**
     * @dev Reverts if no new rewards were added during a merge operation, i.e., the `locked.amount`
     *      did not increase after merging veNFTs.
     */
    error ZeroCompoundVeNFTsReward();

    /**
     * @dev Reverts if the caller tries to merge or operate on veNFT IDs that this strategy does not own.
     */
    error InvalidVeNFTTokenIds();

    /**
     * @dev Reverts if `compoundVeNFTsAll()` is called but there are no other veNFTs to merge except the `managedTokenId`.
     */
    error NotOtherVeNFTsAvailable();

    /**
     * @dev Reverts if try merge or recover managed token id
     */
    error NotAllowedActionWithManagedTokenId();

    /// @notice The address of the FENIX ERC20 token contract. Used for depositing to Voting Escrow.
    address public override fenix;

    /// @notice The address of the virtual rewarder contract for distributing additional rewards.
    address public override virtualRewarder;

    /**
     * @notice Initializes the contract in an uninitialized state and disables further initializations.
     * @dev This constructor is called at the time of contract deployment and uses `_disableInitializers()`
     *      to ensure the upgradeable contract cannot be initialized twice.
     * @param blastGovernor_ The address of the governor, used for further setup calls.
     */
    constructor(address blastGovernor_) {
        __BlastGovernorClaimableSetup_init(blastGovernor_);
        _disableInitializers();
    }

    /**
     * @notice Initializes the strategy with the given parameters.
     * @dev Ensures addresses are non-zero and sets up references to the `managedNFTManager`,
     *      the `virtualRewarder`, and the `routerV2PathProvider`. Also fetches the FENIX token
     *      from the Voting Escrow.
     *
     * @param blastGovernor_        The governance address capable of claiming and managing the contract.
     * @param managedNFTManager_    The address of the managed NFT manager contract.
     * @param virtualRewarder_      The address of the virtual rewarder contract for extra reward distribution.
     * @param routerV2PathProvider_ The address of the router V2 path provider for buyback route management.
     * @param name_                 The name (identifier) of this strategy, stored in base contracts.
     */
    function initialize(
        address blastGovernor_,
        address managedNFTManager_,
        address virtualRewarder_,
        address routerV2PathProvider_,
        string memory name_
    ) external override initializer {
        _checkAddressZero(virtualRewarder_);
        __BaseManagedNFTStrategy__init(blastGovernor_, managedNFTManager_, name_);
        __SingelTokenBuyback__init(routerV2PathProvider_);
        fenix = IVotingEscrow(votingEscrow).token();
        virtualRewarder = virtualRewarder_;
    }

    /**
     * @notice Attaches an NFT to the strategy and initializes participation in the virtual reward system.
     * @dev This function is called when an NFT is attached to this strategy, enabling it to start accumulating rewards.
     *
     * @param tokenId_ The identifier of the NFT to attach.
     * @param userBalance_ The initial balance or stake associated with the NFT at the time of attachment.
     */
    function onAttach(uint256 tokenId_, uint256 userBalance_) external override onlyManagedNFTManager {
        ISingelTokenVirtualRewarder(virtualRewarder).deposit(tokenId_, userBalance_);
        emit OnAttach(tokenId_, userBalance_);
    }

    /**
     * @notice Detaches an NFT from the strategy, withdrawing all associated rewards and balances.
     * @dev Handles the process of detaching an NFT, ensuring all accrued benefits are properly managed and withdrawn.
     *
     * @param tokenId_ The identifier of the NFT to detach.
     * @param userBalance_ The remaining balance or stake associated with the NFT at the time of detachment.
     * @return lockedRewards The amount of rewards locked and harvested upon detachment.
     */
    function onDettach(uint256 tokenId_, uint256 userBalance_) external override onlyManagedNFTManager returns (uint256 lockedRewards) {
        ISingelTokenVirtualRewarder virtualRewarderCache = ISingelTokenVirtualRewarder(virtualRewarder);
        virtualRewarderCache.withdraw(tokenId_, userBalance_);
        lockedRewards = virtualRewarderCache.harvest(tokenId_);
        emit OnDettach(tokenId_, userBalance_, lockedRewards);
    }

    /**
     * @notice Retrieves the total amount of locked rewards available for a specific NFT based on its tokenId.
     * @param tokenId_ The identifier of the NFT to query.
     * @return The total amount of locked rewards for the specified NFT.
     */
    function getLockedRewardsBalance(uint256 tokenId_) external view returns (uint256) {
        return ISingelTokenVirtualRewarder(virtualRewarder).calculateAvailableRewardsAmount(tokenId_);
    }

    /**
     * @notice Retrieves the balance or stake associated with a specific NFT.
     * @param tokenId_ The identifier of the NFT to query.
     * @return The balance of the specified NFT.
     */
    function balanceOf(uint256 tokenId_) external view returns (uint256) {
        return ISingelTokenVirtualRewarder(virtualRewarder).balanceOf(tokenId_);
    }

    /**
     * @notice Retrieves the total supply of stakes managed by the strategy.
     * @return The total supply of stakes.
     */
    function totalSupply() external view returns (uint256) {
        return ISingelTokenVirtualRewarder(virtualRewarder).totalSupply();
    }

    /**
     * @notice Merges (compounds) all veNFTs owned by this strategy except the managed one (`managedTokenId`).
     * @dev Checks if there is more than one veNFT owned. If only the managed one is present,
     *      it reverts with `NotOtherVeNFTsAvailable()`. This method is public and restricted
     *      by strategy flags/permissions.
     */
    function compoundVeNFTsAll() external {
        _requirePermisisonIfNotSetupFlag(LibStrategyFlags.IGNORE_RESTRICTIONS_ON_PUBLIC_VE_NFT_COMPOUND);

        IVotingEscrow votingEscrowCache = IVotingEscrow(votingEscrow);
        uint256 totalBalance = votingEscrowCache.balanceOf(address(this));

        if (totalBalance <= 1) {
            revert NotOtherVeNFTsAvailable();
        }

        uint256 managedTokenIdCache = managedTokenId;
        uint256 length = totalBalance - 1;
        uint256 count;
        uint256[] memory tokenIds = new uint256[](length);

        for (uint256 i; i < totalBalance; ) {
            uint256 tokenId = IERC721EnumerableUpgradeable(address(votingEscrowCache)).tokenOfOwnerByIndex(address(this), i);

            if (tokenId != managedTokenIdCache) {
                tokenIds[count] = tokenId;
                ++count;
            }

            unchecked {
                ++i;
            }
        }
        _compoundVeNFTs(tokenIds);
    }

    /**
     * @notice Merges (compounds) the specified list of veNFT IDs into the managed veNFT.
     * @dev Ensures that each veNFT ID is actually owned by this contract. This method is public
     *      and restricted by strategy flags/permissions.
     * @param tokenIds_ The list of veNFT IDs to be merged.
     */
    function compoundVeNFTs(uint256[] calldata tokenIds_) external {
        _requirePermisisonIfNotSetupFlag(LibStrategyFlags.IGNORE_RESTRICTIONS_ON_PUBLIC_VE_NFT_COMPOUND);

        IVotingEscrow votingEscrowCache = IVotingEscrow(votingEscrow);
        uint256 length = tokenIds_.length;

        for (uint256 i; i < length; ) {
            if (votingEscrowCache.ownerOf(tokenIds_[i]) != address(this)) {
                revert InvalidVeNFTTokenIds();
            }
            unchecked {
                ++i;
            }
        }
        _compoundVeNFTs(tokenIds_);
    }

    /**
     * @notice Compounds FENIX tokens by depositing the current FENIX balance into the managed veNFT.
     * @dev This operation locks more FENIX into `managedTokenId` in the Voting Escrow,
     *      and then notifies the `virtualRewarder` about the updated reward amount.
     *      Restricted by strategy flags/permissions.
     */
    function compound() external {
        _requirePermisisonIfNotSetupFlag(LibStrategyFlags.IGNORE_RESTRICTIONS_ON_PUBLIC_ERC20_COMPOUND);

        IERC20Upgradeable fenixCache = IERC20Upgradeable(fenix);
        uint256 currentBalance = fenixCache.balanceOf(address(this));
        if (currentBalance > 0) {
            address votingEscrowCache = votingEscrow;
            fenixCache.safeApprove(votingEscrowCache, currentBalance);
            IVotingEscrow(votingEscrowCache).depositFor(managedTokenId, currentBalance, false, false);
            ISingelTokenVirtualRewarder(virtualRewarder).notifyRewardAmount(currentBalance);
            emit Compound(msg.sender, currentBalance);
        }
    }

    /**
     * @notice Claims bribes for the current strategy and recovers specified ERC20 tokens to a recipient.
     * @dev This function allows the strategy to claim bribes from specified contracts and transfer
     *      non-strategic ERC20 tokens back to the designated recipient in a single transaction.
     * @param bribes_ The list of addresses representing bribe contracts from which to claim rewards.
     * @param tokens_ A nested array where each entry corresponds to a list of token addresses to claim from the respective bribe contract.
     * @param recipient_ The address to which recovered tokens should be sent.
     * @param tokensToRecover_ The list of ERC20 token addresses to be recovered and transferred to the recipient.
     *
     * Emits:
     * - Emits `Erc20Recover` for each recovered token.
     */
    function claimBribesWithERC20Recover(
        address[] calldata bribes_,
        address[][] calldata tokens_,
        address recipient_,
        address[] calldata tokensToRecover_
    ) external {
        _checkBuybackSwapPermissions();
        if (bribes_.length > 0) {
            claimBribes(bribes_, tokens_);
        }
        for (uint256 i; i < tokensToRecover_.length; ) {
            _erc20Recover(tokensToRecover_[i], recipient_);
            unchecked {
                i++;
            }
        }
    }

    /**
     * @notice Claims bribes from multiple addresses and recovers both specified ERC20 tokens and specified veNFTs to the given recipient.
     * @dev Extends `claimBribesWithERC20Recover` by also recovering veNFTs if `veNftTokenIdsToRecover_` is non-empty.
     *      Protected by `_checkBuybackSwapPermissions()`.
     * @param bribes_                Array of addresses from which to claim bribes.
     * @param tokens_                Nested array of token addresses corresponding to each bribe address.
     * @param recipient_             The address to which recovered tokens/NFTs are sent.
     * @param tokensToRecover_       The list of ERC20 tokens to be recovered and transferred to `recipient_`.
     * @param veNftTokenIdsToRecover_ The list of veNFT IDs to be recovered and transferred to `recipient_`.
     */
    function claimBribesWithTokensRecover(
        address[] calldata bribes_,
        address[][] calldata tokens_,
        address recipient_,
        address[] calldata tokensToRecover_,
        uint256[] calldata veNftTokenIdsToRecover_
    ) external {
        _checkBuybackSwapPermissions();
        if (bribes_.length > 0) {
            claimBribes(bribes_, tokens_);
        }
        for (uint256 i; i < tokensToRecover_.length; ) {
            _erc20Recover(tokensToRecover_[i], recipient_);
            unchecked {
                i++;
            }
        }
        if (veNftTokenIdsToRecover_.length > 0) {
            _erc721Recover(votingEscrow, recipient_, veNftTokenIdsToRecover_);
        }
    }

    /**
     * @notice Sets a new address for the Router V2 Path Provider.
     * @dev Accessible only by admins, this function updates the address used for determining swap routes in token buyback strategies.
     * @param routerV2PathProvider_ The new Router V2 Path Provider address.
     */
    function setRouterV2PathProvider(address routerV2PathProvider_) external virtual onlyAdmin {
        _checkAddressZero(routerV2PathProvider_);
        emit SetRouterV2PathProvider(routerV2PathProvider, routerV2PathProvider_);
        routerV2PathProvider = routerV2PathProvider_;
    }

    /**
     * @notice Recovers ERC20 tokens accidentally sent to this contract, excluding the managed token (FENIX).
     * @dev Allows the admin to recover non-strategic ERC20 tokens sent to the contract.
     * @param token_ The address of the token to recover.
     * @param recipient_ The address where the recovered tokens should be sent.
     */
    function erc20Recover(address token_, address recipient_) external {
        _checkBuybackSwapPermissions();
        _erc20Recover(token_, recipient_);
    }

    /**
     * @notice Recovers specified NFT tokens from this contract to a given recipient.
     * @param token_     The NFT contract address (e.g. `votingEscrow` or other ERC721).
     * @param recipient_ The address receiving the recovered NFTs.
     * @param tokenIds_  The list of NFT IDs to transfer.
     */
    function erc721Recover(address token_, address recipient_, uint256[] calldata tokenIds_) external {
        _checkBuybackSwapPermissions();
        _erc721Recover(token_, recipient_, tokenIds_);
    }

    /**
     * @notice Implementation of the ERC721 Receiver interface.
     * @dev Allows this contract to safely receive ERC721 tokens.
     * @return Returns a specific selector to confirm the receipt of an NFT.
     */
    function onERC721Received(address, address, uint256, bytes memory) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    /**
     * @notice Internal logic for recovering an array of NFTs, restricted by flags for critical tokens.
     * @dev If flag `IGNORE_RESTRICTIONS_ON_RECOVER_VE_NFT_TOKENS` is not set,
     *      recovering `votingEscrow` tokens is disallowed.
     * @param token_     The NFT contract address.
     * @param recipient_ The address receiving the NFTs.
     * @param tokenIds_  The list of NFTs to transfer.
     */
    function _erc721Recover(address token_, address recipient_, uint256[] calldata tokenIds_) internal {
        if (!_hasFlag(LibStrategyFlags.IGNORE_RESTRICTIONS_ON_RECOVER_VE_NFT_TOKENS)) {
            if (token_ == address(votingEscrow)) {
                revert IncorrectRecoverToken();
            }
        }
        uint256 managedTokenIdCache;
        if (votingEscrow == token_) {
            managedTokenIdCache = managedTokenId;
        }

        for (uint256 i; i < tokenIds_.length; ) {
            uint256 tokenId = tokenIds_[i];

            if (managedTokenIdCache > 0 && tokenId == managedTokenIdCache) {
                revert NotAllowedActionWithManagedTokenId();
            }

            IERC721Upgradeable(token_).safeTransferFrom(address(this), recipient_, tokenId, "");

            unchecked {
                i++;
            }
        }
        emit Erc721Recover(msg.sender, recipient_, token_, tokenIds_);
    }

    /**
     * @dev Recovers the full balance of a specified ERC20 token held by this contract and
     *      sends it to `recipient_`. Prevents recovery of `fenix` or tokens used in buyback routes
     *      unless the relevant flags are set.
     * @param token_     The ERC20 token address to recover.
     * @param recipient_ The address receiving the tokens.
     *
     * Emits:
     *  - `Erc20Recover` event.
     */
    function _erc20Recover(address token_, address recipient_) internal {
        if (!_hasFlag(LibStrategyFlags.IGNORE_RESTRICTIONS_ON_RECOVER_TOKENS)) {
            if (token_ == address(fenix) || IRouterV2PathProvider(routerV2PathProvider).isAllowedTokenInInputRoutes(token_)) {
                revert IncorrectRecoverToken();
            }
        }

        uint256 amount = IERC20Upgradeable(token_).balanceOf(address(this));
        if (amount > 0) {
            IERC20Upgradeable(token_).safeTransfer(recipient_, amount);
            emit Erc20Recover(msg.sender, recipient_, token_, amount);
        }
    }

    /**
     * @notice Performs the merging (compounding) of veNFT tokens into the managed token.
     * @dev This internal function:
     *      1. Calculates the current locked amount in `managedTokenId`.
     *      2. Merges each veNFT from `tokenIds_` into the `managedTokenId`, ensuring none are the same ID.
     *      3. Measures the increased locked balance post-merge.
     *      4. If `compoundRewards` is zero, reverts with `ZeroCompoundVeNFTsReward()`.
     *      5. Notifies the `virtualRewarder` about the new locked amount and emits a `Compound` event.
     * @param tokenIds_ The array of veNFT IDs to merge.
     */
    function _compoundVeNFTs(uint256[] memory tokenIds_) internal {
        IVotingEscrow votingEscrowCache = IVotingEscrow(votingEscrow);
        uint256 managedTokenIdCache = managedTokenId;

        uint256 balanceBefore = uint256(int256(votingEscrowCache.getNftState(managedTokenIdCache).locked.amount));

        uint256 length = tokenIds_.length;
        for (uint256 i; i < length; ) {
            uint256 tokenId = tokenIds_[i];

            if (tokenId == managedTokenIdCache) {
                revert NotAllowedActionWithManagedTokenId();
            }

            votingEscrowCache.merge(tokenId, managedTokenIdCache);

            unchecked {
                i++;
            }
        }
        uint256 balanceAfter = uint256(int256(votingEscrowCache.getNftState(managedTokenIdCache).locked.amount));
        uint256 compoundRewards = balanceAfter - balanceBefore;

        if (compoundRewards == 0) {
            revert ZeroCompoundVeNFTsReward();
        }

        ISingelTokenVirtualRewarder(virtualRewarder).notifyRewardAmount(compoundRewards);

        emit Compound(msg.sender, compoundRewards);
    }

    /**
     * @dev Internal function to enforce permissions or rules
     */
    function _checkBuybackSwapPermissions() internal view virtual override {
        IManagedNFTManager managedNFTManagerCache = IManagedNFTManager(managedNFTManager);
        if (managedNFTManagerCache.isAdmin(msg.sender) || managedNFTManagerCache.isAuthorized(managedTokenId, msg.sender)) {
            return;
        }
        revert AccessDenied();
    }

    /**
     * @dev Internal helper to fetch the target token for buybacks.
     * @return The address of the buyback target token.
     */
    function _getBuybackTargetToken() internal view virtual override returns (address) {
        return fenix;
    }

    /**
     * @dev Checks that the provided address is not the zero address. Reverts if it is.
     *      Overridden from multiple parents to unify the zero-address check logic.
     * @param addr_ The address to check.
     */
    function _checkAddressZero(address addr_) internal pure override(BaseManagedNFTStrategyUpgradeable, SingelTokenBuybackUpgradeable) {
        if (addr_ == address(0)) {
            revert AddressZero();
        }
    }

    /**
     * @dev Ensures only authorized or flagged calls can proceed. If the provided flag is NOT set,
     *      it calls `_checkBuybackSwapPermissions()` to validate authorization.
     * @param flag_ A strategy flag from `LibStrategyFlags` to check.
     */
    function _requirePermisisonIfNotSetupFlag(uint256 flag_) internal view {
        if (!_hasFlag(flag_)) {
            _checkBuybackSwapPermissions();
        }
    }

    /**
     * @dev Checks whether a specific strategy flag is set in the manager.
     * @param flag_ The flag to check from `LibStrategyFlags`.
     * @return True if the flag is set, false otherwise.
     */
    function _hasFlag(uint256 flag_) internal view returns (bool) {
        return LibStrategyFlags.hasFlag(IManagedNFTManager(managedNFTManager).getStrategyFlags(address(this)), flag_);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
