# View Functions in CompoundEmissionExtensionUpgradeable

This document outlines the view functions available in the **CompoundEmissionExtensionUpgradeable** contract. These functions allow users to retrieve configuration and state information without modifying the contract's state.

---

## 1. `getUserCreateLockConfig`

### **Signature**
```solidity
function getUserCreateLockConfig(address target_) external view returns (CreateLockConfig memory);
```

### **Description**
Retrieves the effective lock configuration for a specified user. If the user has a custom configuration, it is returned; otherwise, the default configuration is returned.

### **Parameters**
- `target_`: The address of the user whose configuration is being queried.

### **Returns**
- `CreateLockConfig`: The structure containing lock configuration details:
  - `bool shouldBoosted`: Whether the lock supports boosts.
  - `bool withPermanentLock`: Whether the lock is permanent.
  - `uint256 lockDuration`: Duration of the lock in seconds.
  - `uint256 managedTokenIdForAttach`: Managed token ID for attaching deposits.


---

## 2. `getToLocksPercentage`

### **Signature**
```solidity
function getToLocksPercentage(address target_) external view returns (uint256);
```

### **Description**
Returns the percentage of emissions that a user has configured to be locked.

### **Parameters**
- `target_`: The address of the user whose locking percentage is being queried.

### **Returns**
- `uint256`: The fraction (in `1e18` format) of emissions to be locked. For example:
  - `1e18` represents 100%.
  - `5e17` represents 50%.

---

## 3. `getUserInfo`

### **Signature**
```solidity
function getUserInfo(address target_) external view returns (
    uint256 toLocksPercentage,
    bool isCustomConfig,
    CreateLockConfig memory createLockConfig,
    TargetLock[] memory targetLocks
);
```

### **Description**
Provides a comprehensive overview of a user's compounding and locking configuration.

### **Parameters**
- `target_`: The address of the user whose information is being queried.

### **Returns**
- `uint256 toLocksPercentage`: The fraction of emissions to be locked (in `1e18` scale).
- `bool isCustomConfig`: Whether the user has a custom configuration.
- `CreateLockConfig createLockConfig`: The effective lock configuration (default or custom).
- `TargetLock[] targetLocks`: The user’s current emission distribution configuration.
---

## 4. `getAmountOutToLocks`

### **Signature**
```solidity
function getAmountOutToLocks(address target_, uint256 amountIn_) external view returns (uint256);
```

### **Description**
Calculates the amount of tokens that will be sent to locks for a specific user based on their `toLocksPercentage`.

### **Parameters**
- `target_`: The user address.
- `amountIn_`: The total emission amount to be distributed.

### **Returns**
- `uint256`: The portion of `amountIn_` that will be locked based on the user’s `toLocksPercentage`.

