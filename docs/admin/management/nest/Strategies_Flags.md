# **Strategies_Flags.md**

## Overview

The **`LibStrategyFlags`** library defines a set of flags used to control various restrictions and permissions in a strategy. Each flag corresponds to a particular behavior—such as ignoring restrictions on recovering tokens or allowing public compounding calls—that can be **enabled or disabled**.

The **`ManagedNFTManagerUpgradeable`** contract manages these flags on a **per-strategy** basis. By setting the `getStrategyFlags[strategy]` value, you enable or disable these restrictions for a specific strategy.

---

## Flag Definitions

Each flag is defined as a **bitwise shift** of 1 in the `LibStrategyFlags` library:

1. **`IGNORE_RESTRICTIONS_ON_RECOVER_TOKENS`**  
   - Value: `1 << 0` (**decimal 1**)  
   - Purpose: When set, the strategy will **ignore any restrictions** that normally prevent recovering certain tokens (for instance, tokens critical to the strategy).

2. **`IGNORE_RESTRICTIONS_ON_RECOVER_VE_NFT_TOKENS`**  
   - Value: `1 << 1` (**decimal 2**)  
   - Purpose: When set, the strategy will **ignore restrictions** on recovering specific veNFT tokens that would otherwise be locked or essential to strategy functionality.

3. **`IGNORE_RESTRICTIONS_ON_PUBLIC_ERC20_COMPOUND`**  
   - Value: `1 << 2` (**decimal 4**)  
   - Purpose: When set, the strategy will **ignore restrictions** on calling public compounding methods (e.g., `compound()`) for ERC20-based operations. Normally, only certain roles might trigger compounding.

4. **`IGNORE_RESTRICTIONS_ON_PUBLIC_VE_NFT_COMPOUND`**  
   - Value: `1 << 3` (**decimal 8**)  
   - Purpose: When set, the strategy will **ignore restrictions** on calling public compounding methods (e.g., `compoundVeNFTs()`, `compoundVeNFTsAll()`) for merging veNFT. This might be limited to admins only unless the flag is enabled.

---

## Where Flags Are Stored and Managed

Inside the **`ManagedNFTManagerUpgradeable`** contract, there's a mapping:

```solidity
mapping(address => uint8) public override getStrategyFlags;
```

- Each **strategy address** (e.g., your custom strategy contract) maps to a **`uint8 flags`** value.
- You can update these flags by calling the manager’s function:
  ```solidity
  function setStrategyFlags(address strategy_, uint8 flags_)
      external
      onlyRole(MANAGED_NFT_ADMIN)
  {
      getStrategyFlags[strategy_] = flags_;
      emit SetStrategyFlags(strategy_, flags_);
  }
  ```

**Important Notes**:
- Only an account with the `MANAGED_NFT_ADMIN` role may invoke `setStrategyFlags`.
- Flags are stored as a `uint8` value. Because each flag is `1 << N` for `N` in `[0..3]`, they fit within 8 bits.

---

## How to Set Individual or Multiple Flags

### 1. No Flags

To **disable** all flags (i.e., have no special permissions), set the flags value to **0**.  

Example:
```solidity
// Remove any previously set flags for a strategy
manager.setStrategyFlags(myStrategyAddress, 0);
```

---

### 2. One Flag

If you want to enable **only one** of the flags, use its numerical value directly.  

For instance, to **only** enable `IGNORE_RESTRICTIONS_ON_RECOVER_TOKENS`:
```solidity
// This sets the flags to binary 0001 => decimal 1
manager.setStrategyFlags(myStrategyAddress, 1);
```

Similarly, for **only** `IGNORE_RESTRICTIONS_ON_PUBLIC_VE_NFT_COMPOUND` (value `8`):
```solidity
manager.setStrategyFlags(myStrategyAddress, 8);
```

---

### 3. Multiple Flags

To enable multiple flags at once, **bitwise OR** their respective values. Below are the decimal values:

- `IGNORE_RESTRICTIONS_ON_RECOVER_TOKENS`: 1
- `IGNORE_RESTRICTIONS_ON_RECOVER_VE_NFT_TOKENS`: 2
- `IGNORE_RESTRICTIONS_ON_PUBLIC_ERC20_COMPOUND`: 4
- `IGNORE_RESTRICTIONS_ON_PUBLIC_VE_NFT_COMPOUND`: 8

**Example**: Enable **two** flags—recover tokens (1) and public ERC20 compound (4).  
```solidity
// Combine 1 (0b0001) and 4 (0b0100) => 5 (0b0101)
uint8 twoFlags = 1 | 4; // = 5
manager.setStrategyFlags(myStrategyAddress, twoFlags);
```
This results in binary `0101` (decimal `5`), enabling the first and third defined flags.

---

### 4. All Flags

If you want to **enable all** of the flags, combine them all:
```
1 | 2 | 4 | 8 = 15
```
Binary:
```
(0b0001) OR
(0b0010) = 0b0011  (3)
(0b0011) OR
(0b0100) = 0b0111  (7)
(0b0111) OR
(0b1000) = 0b1111 (15)
```
**Decimal 15** is `0b1111`, which sets every flag.

Usage:
```solidity
manager.setStrategyFlags(myStrategyAddress, 15);
```
Now the strategy bypasses **all** restrictions described by these flags.

---

## Checking a Flag Internally

When a strategy or manager checks a flag, it typically calls the library function:
```solidity
function hasFlag(uint8 strategyFlags_, uint256 flag_) internal pure returns (bool res) {
    assembly {
        res := gt(and(strategyFlags_, flag_), 0)
    }
}
```
- If `strategyFlags_ & flag_` is **nonzero**, the flag is considered **enabled**.

---

## Practical Example

1. **Setup**:
   - Assume you deployed your own strategy contract: `MyCompoundStrategy`.
   - You have an instance of `ManagedNFTManagerUpgradeable` at address `manager`.
   - You have the admin role `MANAGED_NFT_ADMIN`.

2. **Grant Admin** (done once, if not already):
   ```solidity
   manager.grantRole(manager.MANAGED_NFT_ADMIN(), adminAddress);
   ```

3. **Enable Two Flags** (recover tokens + recover veNFT tokens):
   ```solidity
   // 1 (recover tokens) | 2 (recover veNFT) = 3
   manager.setStrategyFlags(address(MyCompoundStrategy), 3);
   ```
   This means your strategy can:
   - Recover certain ERC20 tokens normally restricted.
   - Recover veNFT tokens normally restricted.
   But the public compounding flags (4 and 8) are **not** enabled.

4. **Disable Flags**:
   ```solidity
   // Remove all flags for MyCompoundStrategy
   manager.setStrategyFlags(address(MyCompoundStrategy), 0);
   ```
   Now MyCompoundStrategy is back to default restrictions (no special allowances).

---

## Summary

- The `LibStrategyFlags` library defines **4 flags**, each controlling a specific bypass of restrictions.  
- The **`ManagedNFTManagerUpgradeable`** contract holds these flags in a **mapping**: `getStrategyFlags[strategy]`.  
- **Use `setStrategyFlags(...)`** (requires `MANAGED_NFT_ADMIN`) to update which flags are active for a specific strategy.  
- Combine flags with **bitwise OR** (`|`) to enable multiple.  
- **0** = no flags set, **15** = all flags enabled (1, 2, 4, and 8).  

These flags allow **flexible, fine-grained** control over recovering tokens, recovering veNFT, and publicly accessible compounding.

