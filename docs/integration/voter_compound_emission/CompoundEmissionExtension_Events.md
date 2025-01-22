# CompoundEmissionExtension_Events.md

Below is an overview of all the **events** defined in the latest implementation of **`CompoundEmissionExtensionUpgradeable`** (and its interface **`ICompoundEmissionExtension`**).

---

## 1. `SetDefaultCreateLockConfig(CreateLockConfig config)`

**Signature:**
```solidity
event SetDefaultCreateLockConfig(CreateLockConfig config);
```

**Description:**
Emitted when the **global default** configuration for creating veNFT locks is updated. This configuration applies to any user who does *not* have a custom `CreateLockConfig`.

**Parameters:**
- **config**  
  The new global default `CreateLockConfig`. This struct can specify lock duration, permanent lock, boost settings, and so forth.

---

## 2. `SetCreateLockConfig(address indexed user, CreateLockConfig config)`

**Signature:**
```solidity
event SetCreateLockConfig(address indexed user, CreateLockConfig config);
```

**Description:**
Emitted when a specific user **sets or removes** their custom lock-creation configuration.  
If the configuration passed is "empty" (e.g., zero duration, no permanent lock, etc.), the user reverts to using the **global default**.

**Parameters:**
- **user**  
  The user who is setting or removing a custom lock configuration.
- **config**  
  The new custom config. If removed, this event will show default or zeroed values.

---

## 3. `SetCompoundEmissionGeneralPercentages(address indexed user, uint256 toLocksPercentage, uint256 toBribePoolsPercentage)`

**Signature:**
```solidity
event SetCompoundEmissionGeneralPercentages(
    address indexed user,
    uint256 toLocksPercentage,
    uint256 toBribePoolsPercentage
);
```

**Description:**
Emitted when a user updates their **overall** emission split between:
- veNFT **locks**  
- **bribe pools**

For example, the user might set 50% of emissions to go into locks, and 50% to go into bribe pools.

**Parameters:**
- **user**  
  The address of the user updating their split.
- **toLocksPercentage**  
  The fraction of the user’s total emissions to be compounded into veNFT locks. (1e18 = 100%)
- **toBribePoolsPercentage**  
  The fraction of the user’s total emissions to be distributed to bribe pools. (1e18 = 100%)

---

## 4. `SetCompoundEmissionTargetLocks(address indexed user, TargetLock[] targetLocks)`

**Signature:**
```solidity
event SetCompoundEmissionTargetLocks(address indexed user, TargetLock[] targetLocks);
```

**Description:**
Emitted when a user replaces or updates their **entire array** of lock targets. Each target in the array indicates:
1. A **veNFT tokenId** (existing or zero if a new lock is to be created)
2. A **percentage** (1e18-based) of the user’s emission portion allocated to locks.

**Parameters:**
- **user**  
  The address of the user updating their lock targets.
- **targetLocks**  
  The **new** array of `TargetLock` structs. Each struct contains a `tokenId` and a `percentage`.

---

## 5. `SetCompoundEmissionTargetBribePools(address indexed user, TargetPool[] targetBribePools)`

**Signature:**
```solidity
event SetCompoundEmissionTargetBribePools(address indexed user, TargetPool[] targetBribePools);
```

**Description:**
Emitted when a user replaces or updates their **entire array** of bribe pool targets. Each target indicates:
1. A **pool** address
2. A **percentage** (1e18-based) of the user’s emission portion allocated to that pool’s bribe contract

**Parameters:**
- **user**  
  The address of the user updating their bribe pool targets.
- **targetBribePools**  
  The **new** array of `TargetPool` structs. Each struct contains a `pool` address and a `percentage`.

---

## 6. `ChangeEmissionTargetLock(address indexed user, uint256 targetLockFromId, uint256 targetTokenToId)`

**Signature:**
```solidity
event ChangeEmissionTargetLock(
    address indexed user,
    uint256 targetLockFromId,
    uint256 targetTokenToId
);
```

**Description:**
Emitted when a user **changes** the veNFT `tokenId` in an existing lock target.  
For example, this is useful if the user merges or transfers veNFTs and needs to **redirect** the lock portion of emissions from an old `tokenId` to a new one.

**Parameters:**
- **user**  
  The user performing the update.
- **targetLockFromId**  
  The old veNFT `tokenId` to be replaced.
- **targetTokenToId**  
  The new veNFT `tokenId` replacing `targetLockFromId`

---

## 7. `CreateLockFromCompoundEmission(address indexed user, uint256 indexed tokenId, uint256 amount)`

**Signature:**
```solidity
event CreateLockFromCompoundEmission(
    address indexed user,
    uint256 indexed tokenId,
    uint256 amount
);
```

**Description:**
Emitted when a **new** veNFT lock is created using compounded emissions. This occurs if a user’s `TargetLock` has `tokenId = 0`, indicating a fresh lock should be created.

**Parameters:**
- **user**  
  The user for whom the new veNFT lock is created.
- **tokenId**  
  The identifier of the **newly created** veNFT.
- **amount**  
  The amount of tokens locked into this new veNFT.

---

## 8. `CreateLockFromCompoundEmissionForBribePools(address indexed user, address pool, uint256 indexed tokenId, uint256 amount)`

**Signature:**
```solidity
event CreateLockFromCompoundEmissionForBribePools(
    address indexed user,
    address pool,
    uint256 indexed tokenId,
    uint256 amount
);
```

**Description:**
Emitted when a **new** veNFT lock is created **in place of** a bribe pool distribution (fallback logic).  
For example, if a pool’s gauge is **killed**, the user’s emission portion destined for that bribe pool is instead locked into a new veNFT.

**Parameters:**
- **user**  
  The user for whom the fallback lock is created.
- **pool**  
  The bribe pool that could **not** receive emissions (e.g., gauge is killed).
- **tokenId**  
  The identifier of the **newly created** veNFT.
- **amount**  
  The amount of tokens locked in this fallback scenario.

---

## 9. `CompoundEmissionToBribePool(address indexed user, address pool, uint256 amount)`

**Signature:**
```solidity
event CompoundEmissionToBribePool(
    address indexed user,
    address pool,
    uint256 amount
);
```

**Description:**
Emitted when a user’s **compounded emissions** are successfully directed into a **bribe pool**.  
This happens when the user’s config allocates a portion of emissions to a pool with an active gauge.

**Parameters:**
- **user**  
  The address of the user whose emissions are being compounded.
- **pool**  
  The **bribe pool** receiving the tokens.
- **amount**  
  The amount of tokens sent to the bribe pool.

---

## 10. `CompoundEmissionToTargetLock(address indexed user, uint256 indexed tokenId, uint256 amount)`

**Signature:**
```solidity
event CompoundEmissionToTargetLock(
    address indexed user,
    uint256 indexed tokenId,
    uint256 amount
);
```

**Description:**
Emitted when **existing** veNFT locks receive additional tokens from compounding.  
If a user’s `TargetLock` references a non-zero `tokenId`, those tokens top up that existing lock instead of creating a new one.

**Parameters:**
- **user**  
  The user compounding their emissions.
- **tokenId**  
  The identifier of the **existing** veNFT lock receiving tokens.
- **amount**  
  The amount of tokens deposited into the veNFT lock.

---

## Additional Information

- **`CreateLockConfig` struct**  
  Defines parameters for creating (or depositing into) veNFT locks, such as lock duration, permanent lock, optional managed veNFT attachments, and boost flags.

- **`TargetLock` struct**  
  Specifies **which veNFT** (`tokenId`) emissions should go into and **what fraction** (`percentage`, 1e18=100%).

- **`TargetPool` struct**  
  Specifies **which pool** should receive bribes and **what fraction** (`percentage`, 1e18=100%) of the user’s emissions is allocated.

By listening to these events, off-chain services or dApps can track:
- Changes in default or per-user lock configurations (`SetDefaultCreateLockConfig`, `SetCreateLockConfig`).
- Users’ overall emission splits between locks and bribe pools (`SetCompoundEmissionGeneralPercentages`).
- Updates or replacements of veNFT lock targets (`SetCompoundEmissionTargetLocks`) or bribe pool targets (`SetCompoundEmissionTargetBribePools`).
- Adjustments to which veNFT a user’s target references (`ChangeEmissionTargetLock`).
- Creation of **new** veNFT locks during compounding (`CreateLockFromCompoundEmission`, `CreateLockFromCompoundEmissionForBribePools`).
- **Ongoing deposits** into existing veNFT locks (`CompoundEmissionToTargetLock`).
- Emissions flowing directly into bribe pools (`CompoundEmissionToBribePool`).

