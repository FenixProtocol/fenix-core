# CompoundEmissionExtensionUpgradeable User Guide

This document explains how to configure and use the **CompoundEmissionExtensionUpgradeable** contract for managing emissions and creating locks (veNFT).

---

## 1. Configuring Future Lock Creation

### **A) Using the Default Configuration**
By default, the contract has a global configuration (`defaultCreateLockConfig`) that applies to all users who **do not** have a custom configuration set. It defines how new locks (veNFT) will be created if emissions are configured to be locked.

**Administrator** can update the default configuration via:
```solidity
defaultCreateLockConfig(CreateLockConfig calldata config_) external;
```
- Only callable by the address with the `COMPOUND_EMISSION_EXTENSION_ADMINISTRATOR_ROLE` role.
- The `CreateLockConfig` structure includes:
  - `bool shouldBoosted;` - Whether boosted locks (like Liquidity Gauge boosts) should apply.
  - `bool withPermanentLock;` - Whether the lock is permanent.
  - `uint256 lockDuration;` - Duration of the lock in seconds (ignored if `withPermanentLock` is true).
  - `uint256 managedTokenIdForAttach;` - Existing managed veNFT ID for attaching the deposit.

### **B) Setting a Custom Lock Configuration**
Users can override the default configuration by calling:
```solidity
setCreateLockConfig(CreateLockConfig calldata config_) external;
```
- If all fields in `config_` are set to zero or `false`, the user's custom configuration is removed, and they will revert to using the default configuration.
- Otherwise, the custom configuration will be stored and used whenever the user creates new veNFT locks.

Custom configurations are applied only when:
- A `TargetLock` specifies `tokenId = 0` (indicating a new veNFT needs to be created).
- The user has specified `toLocksPercentage > 0`.

---

## 2. Specifying the Percentage and Distribution Among Locks

Users can configure how much of their claimed emissions are locked and how they are distributed among locks by calling:
```solidity
setCompoundEmissionConfig(uint256 toLocksPercentage_, TargetLock[] calldata targetLocks_) external;
```
### Parameters
- `toLocksPercentage_`: The fraction of emissions to lock, in `1e18` scale (e.g., `1e18 = 100%`, `5e17 = 50%`).
- `targetLocks_`: An array of `TargetLock` structures, each including:
  - `uint256 tokenId;` - The ID of an existing veNFT to deposit into, or `0` to create a new veNFT.
  - `uint256 lockPercentage;` - Fraction (in `1e18` scale) of `toLocksPercentage_` to allocate to this lock.

### Key Rules & Validations
1. **If `toLocksPercentage_ == 0`**:
   - The `targetLocks_` array **must be empty** (no emissions will be locked).

2. **If `toLocksPercentage_ > 0`**:
   - The `targetLocks_` array **must not be empty**.
   - The **sum** of all `lockPercentage` values in `targetLocks_` **must equal `1e18`** (i.e., 100% of the locked emissions).

3. **Ownership Requirement**:
   - For non-zero `tokenId` values in `TargetLock`, the user **must own** the specified veNFT.
   - If `tokenId = 0`, a new veNFT will be created using the user’s custom or default lock configuration.

---

## 3. Emission Compounding and Lock Creation

Once the configuration is set, users can compound their emissions into locks using:

### **A) Batch Compounding by Keeper**
```solidity
compoundEmissionClaimBatch(ClaimParams[] calldata claimsParams_) external;
```
- Callable by the keeper with the `COMPOUND_KEEPER_ROLE`.

### **B) Direct Compounding by User**
```solidity
compoundEmisisonClaim(ClaimParams calldata claimParams_) external;
```
- Callable only by the user themselves.

During compounding:
- If a `TargetLock` has `tokenId = 0`, a new veNFT is created using the configuration (custom or default).
- Tokens are distributed according to the user’s `toLocksPercentage` and `targetLocks_` configuration.

---

## 4. Summary of Steps

1. **(Optional)** Administrator sets the global default lock creation configuration via `setDefaultCreateLockConfig`.
2. **(Optional)** User sets or removes a custom lock creation configuration using `setCreateLockConfig`.
3. User configures the emission locking percentage and distribution across locks using `setCompoundEmissionConfig`.
4. Emissions are compounded:
   - Automatically via batch calls by the keeper.
   - Manually by the user calling `compoundEmisisonClaim`.

---

With these steps, users and administrators can efficiently manage the locking of emissions and ensure optimal distribution across veNFTs.

