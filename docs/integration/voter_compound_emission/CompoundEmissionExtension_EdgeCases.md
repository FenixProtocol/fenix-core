# Edge Cases in CompoundEmissionExtensionUpgradeable

This document outlines important edge cases and their handling in the **CompoundEmissionExtensionUpgradeable** contract.

---

## 1. Token Approval Requirement

### **Scenario**
Before emissions can be compounded and locked by the contract, the user must approve their FNX tokens for the **Voter** contract. This is necessary for the contract to access and manage the user's FNX balance.

### **Steps**
1. The user calls the `approve` function on the FNX token contract, setting the **Voter** contract as the spender:
   ```solidity
   function approve(address spender, uint256 amount) external;
   ```
   - `spender`: The address of the Voter contract.
   - `amount`: The amount of FNX tokens to approve.

2. Without this approval, the contract will fail to transfer tokens for compounding.

### **Impact**
If approval is not provided, any attempt to compound emissions will revert due to insufficient allowance.

---

## 2. Handling Duplicate Entries in Target Locks

### **Scenario**
When a user specifies duplicate entries in the `TargetLock[]` array, all entries must be processed without errors.

### **Implementation**
- Duplicate `tokenId` values in `TargetLock[]` are allowed, but each entry is processed separately.
- The contract does not aggregate the `percentage` of duplicates.

### **Result**
Each duplicate entry will be processed independently, creating new locks or depositing into existing ones as specified.

### **Recommendation**
To avoid inefficiencies, users should ensure no duplicates are present in the `TargetLock[]` array.

---

## 3. Multiple `tokenId = 0` in Target Locks

### **Scenario**
When a user specifies multiple entries with `tokenId = 0` in the `TargetLock[]` array, the contract will create a new lock for each entry.

### **Implementation**
- For each `tokenId = 0` entry:
  - A new veNFT lock is created using the user’s custom or default `CreateLockConfig`.
  - The newly created `tokenId` is assigned back to the respective entry in the `TargetLock[]` array.

### **Impact**
If there are multiple `tokenId = 0` entries:
- Multiple new veNFT locks will be created.
- The `CreateLockConfig` is applied independently for each new lock.

### **Recommendation**
Users should minimize the use of multiple `tokenId = 0` entries unless they intend to create multiple new locks.

---

## 4. Transfer of Locks by User

### **Scenario**
If a user transfers one of their veNFT locks to another address, the associated `TargetLock` entries for the lock need to be updated.

### **Implementation**
- When a veNFT is transferred, the Voter contract calls:
  ```solidity
  changeEmissionTargetLockId(address target_, uint256 targetTokenId_, uint256 newTokenId_);
  ```
  - `target_`: The address of the original owner.
  - `targetTokenId_`: The `tokenId` of the transferred lock.
  - `newTokenId_`: Set to `0` to reset the reference.

### **Result**
- The `TargetLock` entry is updated to reflect the transfer.
- Future emissions will no longer be deposited into the transferred lock.

---

## 5. Merging Locks

### **Scenario**
When a user merges one veNFT lock with another, the `TargetLock` entries for the involved locks need to be updated.

### **Implementation**
- Upon merging locks, the Voter contract calls:
  ```solidity
  changeEmissionTargetLockId(address target_, uint256 targetTokenId_, uint256 newTokenId_);
  ```
  - `target_`: The address of the owner.
  - `targetTokenId_`: The `tokenId` of the lock being merged.
  - `newTokenId_`: The `tokenId` of the resulting merged lock.

### **Result**
- All occurrences of `targetTokenId_` in the user’s `TargetLock[]` array are replaced with `newTokenId_`.
- Future emissions are redirected to the merged lock.

### **Impact**
- The merge operation ensures that compounding continues seamlessly without manual intervention.

---

## 6. Invalid Lock Configurations

### **Scenario**
A user attempts to set an invalid lock configuration for compounding emissions.

### **Implementation**
- The contract validates lock configurations:
  - If `withPermanentLock` is `false`, `lockDuration` must be non-zero.
  - If all configuration parameters are zero/false, the user's custom configuration is removed.
- Invalid configurations revert with the `InvalidCreateLockConfig()` error.

### **Impact**
- Ensures only valid configurations are applied, preventing unintended behaviors.

---

## 7. Zero Allocation to Locks or Bribe Pools

### **Scenario**
A user sets their entire emission allocation to either locks or bribe pools, leaving the other at 0%.

### **Implementation**
- If `toLocksPercentage` is `0`, all associated `TargetLock[]` entries are cleared.
- If `toBribePoolsPercentage` is `0`, all associated `TargetPool[]` entries are cleared.

### **Impact**
- Prevents unnecessary storage usage and ensures accurate allocation.

---

## 8. Dead Bribe Pool Handling

### **Scenario**
If a bribe pool associated with a `TargetPool` becomes inactive or is killed after being set, emissions allocated to that pool must be redirected to new veNFT locks.

### **Implementation**
- During compounding, the contract verifies the status of each bribe pool:
  - If the bribe pool is killed, the allocated emissions are redirected to create a new veNFT lock for the user.
  - A new veNFT lock is created using the user’s custom or default `CreateLockConfig`.

### **Result**
- Emissions allocated to dead bribe pools are repurposed to create new locks.
- The `CreateLockConfig` is applied for the new lock, and the corresponding amount is locked.

### **Impact**
- Prevents the loss of emissions due to inactive bribe pools.
- Ensures efficient utilization of allocated emissions.

---

These edge cases highlight the importance of correctly configuring and managing user-specific settings to ensure the **CompoundEmissionExtensionUpgradeable** contract operates efficiently and reliably.

