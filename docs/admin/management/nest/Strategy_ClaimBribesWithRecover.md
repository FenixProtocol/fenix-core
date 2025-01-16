# Claim Bribes With ERC20 and Tokens Recover

This document provides an overview of the `claimBribesWithERC20Recover` and `claimBribesWithTokensRecover` functions in the `CompoundVeFNXManagedNFTStrategyUpgradeable` contract, explaining their parameters, functionality, and providing examples for usage.

---

## Overview

### `claimBribesWithERC20Recover`
The `claimBribesWithERC20Recover` function is designed to:
1. Claim rewards (bribes) from specified contracts for the strategy.
2. Recover selected ERC20 tokens (not fnx) and transfer them to a specified recipient.

This is particularly useful for automating both the claiming of bribes and the withdrawal of tokens in a single transaction.

### `claimBribesWithTokensRecover`
The `claimBribesWithTokensRecover` function extends `claimBribesWithERC20Recover` by:
1. Claiming rewards (bribes) from specified contracts for the strategy.
2. Recovering selected ERC20 tokens and transferring them to a specified recipient.
3. Recovering specified veNFTs and transferring them to the same recipient.

This allows both token and veNFT recoveries in a single transaction.

---

## Function Signatures

### `claimBribesWithERC20Recover`
```solidity
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
```

### `claimBribesWithTokensRecover`
```solidity
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
```

---

## Parameters

### Common Parameters for Both Functions

#### `bribes_`
- **Description:** A list of bribe contract addresses from which to claim rewards.
- **Example:** 
  ```json
  ["0xBribeContract1", "0xBribeContract2"]
  ```

#### `tokens_`
- **Description:** A nested array, where each entry contains a list of ERC20 token addresses to claim from the corresponding bribe contract in `bribes_`.
- **Example:** 
  ```json
  [["0xTokenA", "0xTokenB"], ["0xTokenC"]]
  ```
  In this example:
  - From `0xBribeContract1`, claim rewards for `0xTokenA` and `0xTokenB`.
  - From `0xBribeContract2`, claim rewards for `0xTokenC`.

#### `recipient_`
- **Description:** The address to which the recovered tokens/NFTs will be sent.
- **Example:** 
  ```json
  "0xRecipientAddress"
  ```

### Specific to Each Function

#### `tokensToRecover_` (Both Functions)
- **Description:** A list of ERC20 token addresses to withdraw from the strategy and transfer to the `recipient_`.
- **Example:** 
  ```json
  ["0xTokenA", "0xTokenB", "0xTokenC"]
  ```

#### `veNftTokenIdsToRecover_` (Only `claimBribesWithTokensRecover`)
- **Description:** A list of veNFT token IDs to withdraw from the strategy and transfer to the `recipient_`.
- **Example:** 
  ```json
  [123, 456, 789]
  ```

---

## Requirements

### Common Requirements

1. Caller must have appropriate permissions as determined by `_checkBuybackSwapPermissions`.
2. The tokens listed in `tokensToRecover_` must not include:
   - The managed token (`fenix`).

### Additional Requirements for `claimBribesWithTokensRecover`
1. The `veNftTokenIdsToRecover_` list must contain valid veNFTs owned by the strategy.

---

## Emits

### Common Emits
- **`Erc20Recover`**: Emitted for each ERC20 token recovered.

### Additional Emits for `claimBribesWithTokensRecover`
- **`Erc721Recover`**: Emitted for each veNFT token recovered.

---

## Examples

### Example 1: Claim Bribes and Recover Tokens

#### Input:
```json
{
  "bribes_": ["0xBribeContract1", "0xBribeContract2"],
  "tokens_": [["0xTokenA", "0xTokenB"], ["0xTokenC"]],
  "recipient_": "0xRecipientAddress",
  "tokensToRecover_": ["0xTokenA", "0xTokenB", "0xTokenC"],
  "veNftTokenIdsToRecover_": []
}
```

#### Description:
- Claims rewards from `0xBribeContract1` for `0xTokenA` and `0xTokenB`.
- Claims rewards from `0xBribeContract2` for `0xTokenC`.
- Withdraws `0xTokenA`, `0xTokenB`, and `0xTokenC` from the strategy and sends them to `0xRecipientAddress`.

---

### Example 2: Claim Bribes and Recover Tokens + veNFTs

#### Input:
```json
{
  "bribes_": ["0xBribeContract1"],
  "tokens_": [["0xTokenA"]],
  "recipient_": "0xRecipientAddress",
  "tokensToRecover_": ["0xTokenA"],
  "veNftTokenIdsToRecover_": [123, 456]
}
```

#### Description:
- Claims rewards from `0xBribeContract1` for `0xTokenA`.
- Withdraws `0xTokenA` and veNFTs with IDs `123` and `456` from the strategy and sends them to `0xRecipientAddress`.

---

### Example 3: Only Recover Tokens and veNFTs

#### Input:
```json
{
  "bribes_": [],
  "tokens_": [],
  "recipient_": "0xRecipientAddress",
  "tokensToRecover_": ["0xTokenB"],
  "veNftTokenIdsToRecover_": [789]
}
```

#### Usage:
```solidity
strategy.claimBribesWithTokensRecover(
    [],
    [],
    "0xRecipientAddress",
    ["0xTokenB"],
    [789]
);
```

#### Description:
- No bribes are claimed (`bribes_` is empty).
- Withdraws `0xTokenB` and veNFT ID `789` from the strategy and sends them to `0xRecipientAddress`.

