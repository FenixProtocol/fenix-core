# CompoundEmissionExtensionUpgradeable: Configure Default Create Lock Config

This document describes the functionality for configuring the **default create-lock configuration** in the `CompoundEmissionExtensionUpgradeable` contract. The default configuration applies to any user who has not set their custom configuration for creating veNFT locks.

---

## Relevant Methods

### 1. `setDefaultCreateLockConfig(CreateLockConfig config_)`

**Signature:**
```solidity
function setDefaultCreateLockConfig(CreateLockConfig calldata config_) external;
```

**Description:**
Allows an administrator to update the default configuration for creating veNFT locks. This configuration serves as a fallback for users who have not defined their own custom `CreateLockConfig`.

**Parameters:**
- **config_**: A struct containing the new configuration values:
  - **shouldBoosted**: `bool` - Indicates whether the lock should include boosted functionality (e.g., for liquidity gauge boosts).
  - **withPermanentLock**: `bool` - Indicates whether the lock should be permanent.
  - **lockDuration**: `uint256` - Duration of the lock in seconds (ignored if `withPermanentLock` is true).
  - **managedTokenIdForAttach**: `uint256` - The ID of an existing managed veNFT to attach the deposit to (optional).

**Requirements:**
- The caller must have the `COMPOUND_EMISSION_EXTENSION_ADMINISTRATOR_ROLE`.
- If `withPermanentLock` is `false`, `lockDuration` must be non-zero.
- At least one of the following must be set to a valid value:
  - `withPermanentLock`
  - `lockDuration`
  - `managedTokenIdForAttach`
  - `shouldBoosted`

**Events:**
- `SetDefaultCreateLockConfig(CreateLockConfig config)`  
  Emitted whenever the default configuration is updated.

**Example:**
```solidity
CreateLockConfig memory config = CreateLockConfig({
    shouldBoosted: true,
    withPermanentLock: false,
    lockDuration: 15724800, // ~6 months
    managedTokenIdForAttach: 0
});
compoundEmissionExtension.setDefaultCreateLockConfig(config);
```

---

## Relevant Event

### `SetDefaultCreateLockConfig(CreateLockConfig config)`

**Signature:**
```solidity
event SetDefaultCreateLockConfig(CreateLockConfig config);
```

**Description:**
Emitted when the global default configuration for creating veNFT locks is updated.

**Parameters:**
- **config**: The new `CreateLockConfig` struct.

---
