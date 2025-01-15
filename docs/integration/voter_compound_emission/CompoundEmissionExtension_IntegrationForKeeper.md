# CompoundEmissionExtensionUpgradeable: Integration for Keeper

This document describes how to integrate the `compoundEmissionClaimBatch` function within the `CompoundEmissionExtensionUpgradeable` contract for Keepers. The function allows batch compounding of emissions for multiple users by claiming rewards and locking them into veNFTs according to each user's configuration.

---

## Relevant Method

### `compoundEmissionClaimBatch(ClaimParams[] calldata claimsParams_)`

**Signature:**
```solidity
function compoundEmissionClaimBatch(ClaimParams[] calldata claimsParams_) external;
```

**Description:**
Triggers the compounding of emissions for multiple users in a single batch operation. This includes:
1. Claiming rewards from gauges for each user.
2. Optionally claiming additional rewards via a Merkl proof.
3. Locking the portion of emissions allocated for veNFT locks according to each user's configuration.

**Parameters:**
- **claimsParams_**: An array of `ClaimParams` structs, where each struct contains the following fields:
  - **target**: `address` - The user for whom the emissions are being compounded.
  - **gauges**: `address[]` - The list of gauge contracts to claim rewards from.
  - **merkl**: `IVoter.AggregateClaimMerklDataParams` - Merkl proof data for claiming additional rewards.

**Requirements:**
- The caller must have the `COMPOUND_KEEPER_ROLE`.
- Ensure that the `target` address and related parameters are configured correctly for each user.

---

## Steps for Keeper Integration

1. **Check Permissions:**
   Ensure the Keeper address has been assigned the `COMPOUND_KEEPER_ROLE` in the `CompoundEmissionExtensionUpgradeable` contract.

2. **Prepare Input Data:**
   Gather the necessary information for each user in the form of `ClaimParams`. This includes:
   - User addresses (`target`).
   - Gauges from which to claim emissions (`gauges`).
   - Merkl proof data for additional rewards (`merkl`).

   **Example:**
   ```solidity
   ClaimParams[] memory claims = new ClaimParams[](2);

   claims[0] = ClaimParams({
       target: 0x1234567890abcdef1234567890abcdef12345678,
       gauges: [0xabcdefabcdefabcdefabcdefabcdefabcdef],
       merkl: IVoter.AggregateClaimMerklDataParams({
           users: [0x1234567890abcdef1234567890abcdef12345678],
           tokens: [0x9876543210abcdef9876543210abcdef98765432],
           amounts: [1000],
           proofs: [["0xabc...", "0xdef..."]]
       })
   });

   claims[1] = ClaimParams({
       target: 0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef,
       gauges: [0x1234567890abcdef1234567890abcdef12345678],
       merkl: IVoter.AggregateClaimMerklDataParams({
           users: [0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef],
           tokens: [0x9876543210abcdef9876543210abcdef98765432],
           amounts: [500],
           proofs: [["0xghi...", "0xjkl..."]]
       })
   });
   ```

3. **Execute the Batch Claim:**
   Call the `compoundEmissionClaimBatch` method with the prepared `ClaimParams` array.

   **Example:**
   ```solidity
   compoundEmissionExtension.compoundEmissionClaimBatch(claims);
   ```

4. **Monitor Events:**
   Listen for the following events to verify the success of the operation:
   - `CreateLockFromCompoundEmission`: Indicates a new veNFT lock was created.
   - `CompoundEmissionToTargetLock`: Indicates tokens were deposited into an existing veNFT lock.

---

## Example Use Case

**Scenario:**
The Keeper needs to compound emissions for two users, claiming rewards from specific gauges
**Solution:**
1. Prepare the `ClaimParams` for each user.
2. Call the `compoundEmissionClaimBatch` method with the array of claims.
3. Verify the emitted events for successful execution.

**Code Example:**
```solidity
ClaimParams[] memory claims = new ClaimParams[](2);

claims[0] = ClaimParams({
    target: 0x1234567890abcdef1234567890abcdef12345678,
    gauges: [0xabcdefabcdefabcdefabcdefabcdefabcdef],
    merkl: {}
});

claims[1] = ClaimParams({
    target: 0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef,
    gauges: [0x1234567890abcdef1234567890abcdef12345678],
    merkl: {}
});

// Execute the batch claim
compoundEmissionExtension.compoundEmissionClaimBatch(claims);
```

---

## Additional Notes

- Keepers must ensure that all parameters in `ClaimParams` are correct and aligned with the users' configurations.
- Proper gas estimation should be performed before calling the batch function to avoid out-of-gas errors.
- Each user’s configuration and target locks will dictate how the claimed emissions are processed and distributed into veNFTs.
