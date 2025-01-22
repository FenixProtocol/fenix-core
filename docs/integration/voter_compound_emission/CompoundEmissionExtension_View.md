
# View Functions in CompoundEmissionExtensionUpgradeable

This document outlines the **view** functions available in the **CompoundEmissionExtensionUpgradeable** contract.  
These functions allow users to retrieve configuration and state information without modifying the contract’s state.

---

## 1. `getUserCreateLockConfig`

### **Signature**
```solidity
function getUserCreateLockConfig(address target_) external view returns (CreateLockConfig memory);
```

### **Description**
Retrieves the effective **create-lock configuration** (`CreateLockConfig`) for the given user.  
If the user has set a **custom configuration**, it returns that; otherwise, it falls back to the **default** configuration.

### **Parameters**
- `target_`: The address of the user whose lock configuration is being queried.

### **Returns**
- **`CreateLockConfig`**: A struct containing parameters for creating or depositing into veNFT:
  - `bool shouldBoosted`: Indicates whether locks can be boosted (if supported by the underlying system).
  - `bool withPermanentLock`: Whether the lock is permanent.
  - `uint256 lockDuration`: The duration (in seconds) for the lock, if it is not permanent.
  - `uint256 managedTokenIdForAttach`: An optional existing managed veNFT ID for attaching the deposit.

---

## 2. `getToLocksPercentage`

### **Signature**
```solidity
function getToLocksPercentage(address target_) external view returns (uint256);
```

### **Description**
Returns the fraction (in 1e18 format) of **claimed emissions** that a user allocates to veNFT locks.

### **Parameters**
- `target_`: The user address for which the lock percentage is retrieved.

### **Returns**
- **`uint256`**: The fraction (1e18 = 100%) of emissions that the user directs to veNFT locks.  
  - For example, `5e17` (which is 0.5 * 1e18) represents **50%.**

---

## 3. `getToBribePoolsPercentage`

### **Signature**
```solidity
function getToBribePoolsPercentage(address target_) external view returns (uint256);
```

### **Description**
Returns the fraction (in 1e18 format) of **claimed emissions** that a user allocates to **bribe pools**.

### **Parameters**
- `target_`: The user address for which the bribe-pool percentage is retrieved.

### **Returns**
- **`uint256`**: The fraction (1e18 = 100%) of emissions that the user directs to bribe pools.  
  - For example, `2e17` (which is 0.2 * 1e18) represents **20%.**

---

## 4. `getUserInfo`

### **Signature**
```solidity
function getUserInfo(address target_)
    external
    view
    returns (
        uint256 toLocksPercentage,
        uint256 toBribePoolsPercentage,
        bool isCreateLockCustomConfig,
        CreateLockConfig memory createLockConfig,
        TargetLock[] memory targetLocks,
        TargetPool[] memory targetBribePools
    );
```

### **Description**
Provides a comprehensive overview of a user’s **emission compounding configuration**, including:
- The percentage of emissions allocated to veNFT locks.
- The percentage of emissions allocated to bribe pools.
- Whether the user has a custom create-lock configuration or is using the default.
- The create-lock parameters (if any).
- How emissions are further split among multiple veNFTs (`TargetLock[]`) and multiple bribe pools (`TargetPool[]`).

### **Parameters**
- `target_`: The address of the user whose information is being queried.

### **Returns**
1. `uint256 toLocksPercentage`: The fraction of emissions going to **veNFT locks** (1e18 = 100%).  
2. `uint256 toBribePoolsPercentage`: The fraction of emissions going to **bribe pools** (1e18 = 100%).  
3. `bool isCreateLockCustomConfig`: Whether the user has a **custom** lock-creation configuration.  
4. `CreateLockConfig createLockConfig`: The effective lock-creation config (default or custom).  
5. `TargetLock[] targetLocks`: The user’s **per-veNFT** distribution targets.  
   - Each entry indicates a `tokenId` and the relative `percentage` (in 1e18 format).  
6. `TargetPool[] targetBribePools`: The user’s **per-pool** bribe distribution targets.  
   - Each entry indicates a `pool` address and the relative `percentage` (in 1e18 format).

---

## 5. `getAmountOutToCompound`

### **Signature**
```solidity
function getAmountOutToCompound(
    address target_,
    uint256 amountIn_
) external view returns (uint256 toTargetLocks, uint256 toTargetBribePools);
```

### **Description**
Calculates how **`amountIn_`** (e.g., newly claimed tokens) would be split between the **veNFT locks** and the **bribe pools** for a given user. This function only returns the **high-level** allocation (not per-veNFT or per-pool).

### **Parameters**
- `target_`: The user whose emission distribution settings are applied.
- `amountIn_`: The total amount of tokens that the user is about to distribute.

### **Returns**
1. `uint256 toTargetLocks`: The portion of `amountIn_` allocated to **veNFT locks**.  
2. `uint256 toTargetBribePools`: The portion of `amountIn_` allocated to **bribe pools**.
