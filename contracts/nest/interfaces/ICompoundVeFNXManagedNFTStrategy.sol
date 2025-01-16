// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {IManagedNFTStrategy} from "./IManagedNFTStrategy.sol";
import {ISingelTokenBuyback} from "./ISingelTokenBuyback.sol";

/**
 * @title ICompoundVeFNXManagedNFTStrategy
 * @dev Interface for a compound strategy specific to VeFNX tokens, extending the basic managed NFT strategy functionality.
 * @notice This interface provides functionalities to handle compounding of VeFNX token rewards and interactions with a virtual rewarder contract.
 */
interface ICompoundVeFNXManagedNFTStrategy is IManagedNFTStrategy, ISingelTokenBuyback {
    /**
     * @dev Emitted when rewards are compounded by the caller.
     *
     * @param caller The address of the account that called the compound function.
     * @param amount The amount of VeFNX tokens that were compounded.
     */
    event Compound(address indexed caller, uint256 indexed amount);

    /**
     * @dev Emitted when an NFT is attached to the strategy, initializing reward mechanisms for it.
     *
     * @param tokenId The ID of the NFT that is being attached.
     * @param userBalance The balance associated with the NFT at the time of attachment.
     */
    event OnAttach(uint256 indexed tokenId, uint256 indexed userBalance);

    /**
     * @dev Emitted when an NFT is detached from the strategy, concluding reward mechanisms for it.
     *
     * @param tokenId The ID of the NFT that is being detached.
     * @param userBalance The balance associated with the NFT at the time of detachment.
     * @param lockedRewards The rewards that were locked and harvested upon detachment.
     */
    event OnDettach(uint256 indexed tokenId, uint256 indexed userBalance, uint256 indexed lockedRewards);

    /**
     * @dev Emitted when ERC20 tokens are recovered from the contract by an admin.
     *
     * @param caller The address of the caller who initiated the recovery.
     * @param recipient The recipient address where the recovered tokens were sent.
     * @param token The address of the token that was recovered.
     * @param amount The amount of the token that was recovered.
     */
    event Erc20Recover(address indexed caller, address indexed recipient, address indexed token, uint256 amount);

    /**
     * @dev Emitted when ERC721 tokens are recovered from the contract by an admin.
     *
     * @param caller The address of the caller who initiated the recovery.
     * @param recipient The recipient address where the recovered tokens were sent.
     * @param token The address of the token that was recovered.
     * @param tokenIds The array of token identifiers that are wtihdrawed
     */
    event Erc721Recover(address indexed caller, address indexed recipient, address indexed token, uint256[] tokenIds);

    /**
     * @dev Emitted when the address of the Router V2 Path Provider is updated.
     *
     * @param oldRouterV2PathProvider The address of the previous Router V2 Path Provider.
     * @param newRouterV2PathProvider The address of the new Router V2 Path Provider that has been set.
     */
    event SetRouterV2PathProvider(address indexed oldRouterV2PathProvider, address indexed newRouterV2PathProvider);

    /**
     * @notice Compounds accumulated rewards into additional stakes or holdings.
     * @dev Function to reinvest earned rewards back into the underlying asset to increase the principal amount.
     * This is specific to strategies dealing with compounding mechanisms in DeFi protocols.
     */
    function compound() external;

    /**
     * @notice Merges (compounds) all veNFTs owned by this strategy except the managed one (`managedTokenId`).
     * @dev Checks if there is more than one veNFT owned. If only the managed one is present,
     *      it reverts with `NotOtherVeNFTsAvailable()`.
     */
    function compoundVeNFTsAll() external;

    /**
     * @notice Merges (compounds) the specified list of veNFT IDs into the managed veNFT.
     * @dev Ensures that each veNFT ID is actually owned by this contract
     * @param tokenIds_ The list of veNFT IDs to be merged.
     */
    function compoundVeNFTs(uint256[] calldata tokenIds_) external;

    /**
     * @notice Returns the address of the virtual rewarder associated with this strategy.
     * @return address The contract address of the virtual rewarder that manages reward distributions for this strategy.
     */
    function virtualRewarder() external view returns (address);

    /**
     * @notice Returns the address of the FENIX token used in this strategy.
     * @return address The contract address of the FENIX token.
     */
    function fenix() external view returns (address);

    /**
     * @notice Retrieves the total amount of locked rewards available for a specific NFT based on its tokenId.
     * @param tokenId_ The identifier of the NFT to query.
     * @return The total amount of locked rewards for the specified NFT.
     */
    function getLockedRewardsBalance(uint256 tokenId_) external view returns (uint256);

    /**
     * @notice Retrieves the balance or stake associated with a specific NFT.
     * @param tokenId_ The identifier of the NFT to query.
     * @return The balance of the specified NFT.
     */
    function balanceOf(uint256 tokenId_) external view returns (uint256);

    /**
     * @notice Retrieves the total supply of stakes managed by the strategy.
     * @return The total supply of stakes.
     */
    function totalSupply() external view returns (uint256);

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
    ) external;

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
    ) external;

    /**
     * @notice Recovers specified NFT tokens from this contract to a given recipient.
     * @param recipient_ The address receiving the recovered NFTs.
     * @param token_     The NFT contract address (e.g. `votingEscrow` or other ERC721).
     * @param tokenIds_  The list of NFT IDs to transfer.
     */
    function erc721Recover(address recipient_, address token_, uint256[] calldata tokenIds_) external;

    /**
     * @notice Initializes the contract with necessary blast governance and operational addresses, and sets specific strategy parameters.
     *
     * @param blastGovernor_ Address of the blast governor contract.
     * @param managedNFTManager_ Address of the managed NFT manager contract.
     * @param virtualRewarder_ Address of the virtual rewarder contract.
     * @param name_ Name of the strategy.
     */
    function initialize(
        address blastGovernor_,
        address managedNFTManager_,
        address virtualRewarder_,
        address routerV2PathProvider_,
        string memory name_
    ) external;
}
