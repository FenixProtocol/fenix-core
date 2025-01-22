# CompoundEmissionExtensionUpgradeable — User Guide

## 1. Key Idea
This contract automatically “compounds” (locks) your emission rewards (claimed from a “Voter” contract) into:

- **veNFT (VotingEscrow NFTs)** — allowing you to boost your voting power or earn additional benefits.
- **Bribe pools** — external reward contracts associated with certain pools.

You can configure what percentage of your claimed emissions goes to veNFT locks and what percentage goes to bribe pools.

### For veNFT:
- You can deposit into an existing veNFT, or
- Create a new veNFT lock (which can be permanent or time-based, as defined by your configuration).

### For bribe pools:
- You define how to split your bribe portion among several pools.
- If any bribe target points to a killed gauge, the contract falls back to creating a new veNFT instead.

---

## 2. Global (Default) Lock Creation Config (Admin Only)

Only a user with `COMPOUND_EMISSION_EXTENSION_ADMINISTRATOR_ROLE` can set or update the global default lock configuration:

```solidity
function setDefaultCreateLockConfig(CreateLockConfig calldata config_) external;
```

`CreateLockConfig` includes:

```solidity
struct CreateLockConfig {
    bool shouldBoosted;
    bool withPermanentLock;
    uint256 lockDuration;
    uint256 managedTokenIdForAttach;
}
```

If a user has not set their own (custom) config, any new veNFT created for them will follow this default config.

### Example
As an admin, you want all new veNFT locks by default to have a 6-month duration:

```solidity
setDefaultCreateLockConfig(
  CreateLockConfig({
    shouldBoosted: false,
    withPermanentLock: false,
    lockDuration: 15724800,  // ~6 months in seconds
    managedTokenIdForAttach: 0
  })
);
```

---

## 3. Personal (Custom) Lock Creation Config (Per-User)

As a regular user, you can override (or remove) the default config by calling:

```solidity
function setCreateLockConfig(CreateLockConfig calldata config_) external;
```

- If all fields are `0/false`, your personal config is removed, and you revert to the global default.
- If `withPermanentLock = true`, then `lockDuration` is ignored.
- If `withPermanentLock = false`, you must set a `lockDuration > 0`.

### Example
You want your new veNFT locks to always be permanent:

```solidity
setCreateLockConfig(
  CreateLockConfig({
    shouldBoosted: true,
    withPermanentLock: true,
    lockDuration: 0,             // ignored because `withPermanentLock` is true
    managedTokenIdForAttach: 0
  })
);
```

Now, whenever your configuration specifies creating a new lock (`tokenId = 0` in your target locks), it will create a permanent veNFT.

---

## 4. Configuring Distribution Between veNFT and Bribe Pools

You will define:

- `toLocksPercentage` — fraction of emissions that go into veNFT locks.
- `toBribePoolsPercentage` — fraction of emissions that go into bribe pools.

They must sum to ≤ `1e18` (i.e., ≤ 100%).

### A) Main Update Function

```solidity
function setCompoundEmissionConfig(UpdateCompoundEmissionConfigParams calldata p_) external;
```

Where `UpdateCompoundEmissionConfigParams` includes:

```solidity
struct UpdateCompoundEmissionConfigParams {
    bool shouldUpdateGeneralPercentages;
    bool shouldUpdateTargetLocks;
    bool shouldUpdateTargetBribePools;

    uint256 toLocksPercentage;     // % of total emissions to veNFT locks (1e18 = 100%)
    uint256 toBribePoolsPercentage;// % of total emissions to bribe pools

    TargetLock[] targetLocks;      // array describing how the locks portion is split
    TargetPool[] targetsBribePools;// array describing how the bribe portion is split
}
```

#### Key validations:

1. `toLocksPercentage + toBribePoolsPercentage <= 1e18`.
2. If `toLocksPercentage > 0`, the `targetLocks` array must not be empty, and the sum of their `percentage` fields = `1e18`.
3. If `toBribePoolsPercentage > 0`, the `targetsBribePools` array must not be empty, and the sum of their `percentage` fields = `1e18`.

Each `TargetLock` has:

```solidity
struct TargetLock {
    uint256 tokenId;    // existing veNFT ID, or 0 to create new
    uint256 percentage; // how much of "locks fraction" goes here
}
```

- If `tokenId != 0`, you must own that veNFT.
- If `tokenId == 0`, it creates a new veNFT.

Each `TargetPool` has:

```solidity
struct TargetPool {
    address pool;       // the pool address (with an external bribe contract)
    uint256 percentage; // how much of "bribe fraction" goes to that pool
}
```

- The gauge for `pool` must be “alive”. If it’s killed, the portion falls back to creating a new veNFT.

### Example: 50% to a permanent veNFT, 50% to a bribe pool

We assume you already called `setCreateLockConfig` with `permanentLock = true`.
Now you want half your emissions to go into a new permanent lock, and the other half into a specific bribe pool.

```solidity
UpdateCompoundEmissionConfigParams memory params;
params.shouldUpdateGeneralPercentages = true;
params.shouldUpdateTargetLocks = true;
params.shouldUpdateTargetBribePools = true;

params.toLocksPercentage = 5e17;       // 50%
params.toBribePoolsPercentage = 5e17;  // 50%

// For locks: only 1 target. tokenId=0 means "create new veNFT".
TargetLock[] memory locks = new TargetLock[](1);
locks[0] = TargetLock({ tokenId: 0, percentage: 1e18 });
params.targetLocks = locks;

// For bribes: only 1 pool. Must find the gauge’s pool address, e.g. "poolA".
TargetPool[] memory bribes = new TargetPool[](1);
bribes[0] = TargetPool({ pool: poolA, percentage: 1e18 });
params.targetsBribePools = bribes;

compoundEmissionExtension.setCompoundEmissionConfig(params);
```

Now, every time emissions are claimed on your behalf:

- 50% goes into a new veNFT (created if none exists yet),
- 50% goes to the bribe pool for `poolA`.

---
### Example: 30% to a two permanent veNFT, 50% to a bribe pool, 20% to user

We assume you already called `setCreateLockConfig` with `permanentLock = true`.
Now you want half your emissions to go into a new permanent lock, and the other half into a specific bribe pool.

```solidity
UpdateCompoundEmissionConfigParams memory params;
params.shouldUpdateGeneralPercentages = true;
params.shouldUpdateTargetLocks = true;
params.shouldUpdateTargetBribePools = true;

params.toLocksPercentage = 3e17;       // 30%
params.toBribePoolsPercentage = 5e17;  // 50%

TargetLock[] memory locks = new TargetLock[](2);
locks[0] = TargetLock({ tokenId: 0, percentage: 0.4e18 }); // 40% from 30% to locks, will allocate for create new lock
locks[1] = TargetLock({ tokenId: 1, percentage: 0.6e18 }); // 60% from 30% to locks, will deposit to token id 1

params.targetLocks = locks;

// For bribes: only 1 pool. Must find the gauge’s pool address, e.g. "poolA".
TargetPool[] memory bribes = new TargetPool[](1);
bribes[0] = TargetPool({ pool: poolA, percentage: 1e18 }); // 50% from emission will distribute like bribe reward for poolA
params.targetsBribePools = bribes;

compoundEmissionExtension.setCompoundEmissionConfig(params);
```
---

## 5. How to Compound (Claim) Emissions

After setting up your distribution, you can trigger the actual compounding in two ways:

### A) Batch Compounding (Keeper)

A “keeper” with the role `COMPOUND_KEEPER_ROLE` can call:

```solidity
compoundEmissionClaimBatch(ClaimParams[] calldata claimsParams_);
```

`claimsParams_` is an array of:

```solidity
struct ClaimParams {
    address target;          // user whose emissions to claim
    address[] gauges;        // which gauges to claim from
    IVoter.AggregateClaimMerklDataParams merkl; // optional merkle-based data
}
```

The keeper typically calls this for multiple users in one transaction, automating distribution.

### B) Direct Compounding (User)

You can claim for yourself by calling:

```solidity
compoundEmisisonClaim(ClaimParams calldata claimParams_);
```

- Must be called by the user themself (`claimParams_.target == msg.sender`).

When compounding happens:

1. The contract claims from the Voter,
2. Pulls your tokens from the Voter,
3. Splits them according to your config (`toLocksPercentage`, `toBribePoolsPercentage`, and the respective targets).

---

## 6. Special Cases & Functions

### A) Updating veNFT IDs

If you merge veNFTs or transfer them, you might need to change references in your `TargetLock[]`.
The Voter can call:

```solidity
changeEmissionTargetLockId(user, oldTokenId, newTokenId);
```

- It replaces all occurrences of `oldTokenId` with `newTokenId` in user’s lock targets.
- If `newTokenId == 0`, those entries become “blank” so future compounding for that part can create a new veNFT again.

### B) If a Gauge is Killed

If your bribe target references a gauge that is no longer active (“killed”), the contract will fallback to creating a new veNFT with the user’s `CreateLockConfig` for that portion.

---

## 7. Summary of a Typical User Setup

1. *(Optional)* Set or remove your custom lock configuration via `setCreateLockConfig(...)`. If you skip this, you’ll use the admin’s default config for any new veNFT.
2. Decide how much of your emissions go to veNFT locks vs. bribe pools. For each category, specify how to split among multiple targets:

```solidity
setCompoundEmissionConfig(UpdateCompoundEmissionConfigParams {...});
```

3. To actually compound (i.e., claim and distribute tokens):
   - The keeper might batch claim for you using `compoundEmissionClaimBatch(...)`, or
   - You manually claim via `compoundEmisisonClaim(...)`.

4. *(Optional)* If you merged/transferred veNFTs, you or the Voter can call `changeEmissionTargetLockId(...)` to update references.

That’s it! This contract will automatically handle creating new veNFTs (if `tokenId=0`), distributing to existing veNFTs (if you already own them), and paying out to bribe pools. It even has a fallback if a pool’s gauge is killed, so your tokens never get stuck.

By following these steps, you can easily manage how your protocol’s emissions are locked or bribed, ensuring you maximize your voting power or rewards while simplifying the claiming process.

