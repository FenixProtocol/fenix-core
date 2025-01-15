# CompoundEmissionExtension_Events.md

Below is an overview of all the events defined within the **CompoundEmissionExtensionUpgradeable** contract (and its interface **ICompoundEmissionExtension**)

---

## 1. `SetDefaultCreateLockConfig(CreateLockConfig config)`

**Signature:**
```solidity
event SetDefaultCreateLockConfig(CreateLockConfig config);
```

**Description:**
Emitted when the global default configuration for creating veNFT locks is updated. This new default applies to users who do not have their own custom configuration.

**Parameters:**
- **config**  
  The new default `CreateLockConfig`. This struct includes data such as lock duration, whether the lock is permanent, and other lock parameters.

---

## 2. `SetCreateLockConfig(address indexed user, CreateLockConfig config)`

**Signature:**
```solidity
event SetCreateLockConfig(address indexed user, CreateLockConfig config);
```

**Description:**
Emitted when an individual user sets or removes their custom configuration for creating veNFT locks.  
If a user provides parameters all set to zero or false, their custom configuration is removed, and they revert to the global default configuration.

**Parameters:**
- **user**  
  The address of the user whose configuration has changed.
- **config**  
  The new configuration. If the user removed their config, this will show default or zeroed values.

---

## 3. `SetCompoundEmissionConfig(address indexed user, uint256 toLocksPercentage, TargetLock[] targetLocks)`

**Signature:**
```solidity
event SetCompoundEmissionConfig(
    address indexed user,
    uint256 toLocksPercentage,
    TargetLock[] targetLocks
);
```

**Description:**
Emitted when a user updates how their emission rewards are split across multiple veNFT locks. The user can specify what percentage of their rewards is allocated to locking (versus being kept liquid) and how that locked portion is distributed among one or more veNFT token IDs.

**Parameters:**
- **user**  
  The user whose emission distribution has changed.
- **toLocksPercentage**  
  The fraction (1e18-based) of the user’s emissions that will be locked. For example, `1e18` is 100%.
- **targetLocks**  
  An array of `TargetLock` structs, each containing a `tokenId` and the `lockPercentage`. These detail how the locked portion of emissions is split across different veNFTs.

---

## 4. `ChangeEmissionTargetLock(address indexed user, uint256 targetLockFromId, uint256 targetTokenToId)`

**Signature:**
```solidity
event ChangeEmissionTargetLock(
    address indexed user,
    uint256 targetLockFromId,
    uint256 targetTokenToId
);
```

**Description:**
Emitted when changes the veNFT token ID in an existing emission distribution target. For example, during token transfers or merges, references to an old `tokenId` can be replaced with a new one.

**Parameters:**
- **user**  
  The user whose emission target lock reference is updated.
- **targetLockFromId**  
  The old token ID that was previously used in `TargetLock`.
- **targetTokenToId**  
  The new token ID that replaces `targetLockFromId`. If set to zero, it effectively removes the old lock reference and allows a new veNFT to be created in a subsequent compounding operation.

---

## 5. `CreateLockFromCompoundEmission(address indexed user, uint256 indexed tokenId, uint256 amount)`

**Signature:**
```solidity
event CreateLockFromCompoundEmission(
    address indexed user,
    uint256 indexed tokenId,
    uint256 amount
);
```

**Description:**
Emitted when a **new** veNFT lock is created because of compounding emissions. This can occur if the user’s `TargetLock` configuration specifies a `tokenId = 0`, indicating that a fresh lock should be created.

**Parameters:**
- **user**  
  The user who created the new veNFT lock.
- **tokenId**  
  The newly created veNFT token ID.
- **amount**  
  The amount of tokens locked into this new veNFT.

---

## 6. `CompoundEmissionToTargetLock(address indexed user, uint256 indexed tokenId, uint256 amount)`

**Signature:**
```solidity
event CompoundEmissionToTargetLock(
    address indexed user,
    uint256 indexed tokenId,
    uint256 amount
);
```

**Description:**
Emitted when a user compounds emissions into an **existing** veNFT lock (i.e., where `tokenId` is non-zero). This occurs whenever the user’s compounding process updates a lock with additional tokens, rather than creating a new lock.

**Parameters:**
- **user**  
  The address of the user compounding emissions.
- **tokenId**  
  The identifier of the veNFT that receives the newly locked tokens.
- **amount**  
  The total amount of tokens deposited into this existing veNFT lock.

---

### Additional Information

- **`CreateLockConfig` struct**: Defines the parameters needed when creating a new veNFT lock (e.g., lock duration, permanent lock indicator, etc.).  
- **`TargetLock` struct**: Describes how a fraction of a user’s emission rewards should be allocated to a specific veNFT (`tokenId`) and what percentage (in 1e18 scale) goes to that lock.  

By listening to these events, external services or dApps can monitor:
- Changes in default or per-user lock configurations (`SetDefaultCreateLockConfig`, `SetCreateLockConfig`).
- The user’s chosen emission distribution (`SetCompoundEmissionConfig`).
- Adjustments made to veNFT references due to ownership transfers or merging (`ChangeEmissionTargetLock`).
- The creation of new locks (`CreateLockFromCompoundEmission`).
- Ongoing deposits into existing veNFT locks (`CompoundEmissionToTargetLock`).