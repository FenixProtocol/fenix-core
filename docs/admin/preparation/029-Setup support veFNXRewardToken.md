### Step 1: Setup `CustomBribeRewardRouter` in the `VotingEscrow` Contract

To enable `CustomBribeRewardRouter` to burn `veFNX`, need to set its address in the `VotingEscrow` contract. Call `VotingEscrow.updateAddress(string memory key_, address value_)` on the contract at `0xC900C984a3581EfA4Fb56cAF6eF19721aAFbB4f9` ([View on BlastScan](https://blastscan.io/address/0xC900C984a3581EfA4Fb56cAF6eF19721aAFbB4f9)) with the following parameters:
- **`key_`**: `customBribeRewardRouter`
- **`value_`**: `0xd6bd9EDF022406c7b5cc0fB6cb23d851034A6Dcd`

#### Example:
```solidity
VotingEscrow(0xC900C984a3581EfA4Fb56cAF6eF19721aAFbB4f9).updateAddress(
    "customBribeRewardRouter",
    0xd6bd9EDF022406c7b5cc0fB6cb23d851034A6Dcd
);
```

---

### Step 2: Disable Unnecessary Custom Bribes Reward Types

Currently, `CustomBribeRewardRouter` supports two types of rewards:
1. `notifyRewardFNXInVeFNX` (Function Selector: `0x0eddae61`)
2. `notifyRewardVeFNXInVeFNX` (Function Selector: `0x5bbec3a8`)

These reward types are **enabled by default**. If you wish to disable any of them, perform the following steps:

Call `CustomBribeRewardRouter.setupFuncEnable(bytes4 funcSign_, bool isEnable_)` on the contract at `0xd6bd9EDF022406c7b5cc0fB6cb23d851034A6Dcd` ([View on BlastScan](https://blastscan.io/address/0xd6bd9EDF022406c7b5cc0fB6cb23d851034A6Dcd)) with the respective function selector and set `isEnable_` to `false`.

#### Examples:
1. To disable the ability to reward `veFNX` bribes via FNX tokens:
   ```solidity
   CustomBribeRewardRouter(0xd6bd9EDF022406c7b5cc0fB6cb23d851034A6Dcd).setupFuncEnable(
       0x0eddae61,
       false
   );
   ```

2. To disable the ability to reward `veFNX` bribes by burning user `veFNX`:
   ```solidity
   CustomBribeRewardRouter(0xd6bd9EDF022406c7b5cc0fB6cb23d851034A6Dcd).setupFuncEnable(
       0x5bbec3a8,
       false
   );
   ```

---

### Step 3: Add `Bribe VeFNX Reward Token` to Desired Bribe Contracts or Set it as the Default Token for All Bribe Contracts

If you want to set `Bribe VeFNX Reward Token` as the **default reward token** for all bribe contracts, call `BribeFactory.pushDefaultRewardToken(address _token)` on the contract at `0xFD91dC9a8C3268fc556838baEd5871BE3Af6f32e` ([View on BlastScan](https://blastscan.io/address/0xFD91dC9a8C3268fc556838baEd5871BE3Af6f32e)) with the following parameter:
- **`_token`**: `0xf50F9D5F903A3aE58Db1D39b38233f2170bEF748`

#### Example:
```solidity
BribeFactory(0xFD91dC9a8C3268fc556838baEd5871BE3Af6f32e).pushDefaultRewardToken(
    0xf50F9D5F903A3aE58Db1D39b38233f2170bEF748
);
```



### [Optional] Step 4: Configure Bribe VeFNX Reward Token Lock Parameters
By default, the reward token will be converted into a `veFNX` lock with a duration of 182 days, without any additional customizations. If you want to change these settings (e.g., to make the reward lock permanent), call: all:

`BribeVeFNXRewardToken.updateCreateLockParams(CreateLockParams memory createLockParams_)` on 0xf50F9D5F903A3aE58Db1D39b38233f2170bEF748 ([View on BlastScan](https://blastscan.io/address/0xf50F9D5F903A3aE58Db1D39b38233f2170bEF748))  contract

- CreateLockParams Structure:
```solidity
/**
 * @notice Parameters for creating a veFNX lock in the VotingEscrow contract.
 * @param lockDuration The duration (in seconds) for which the FNX will be locked.
 * @param shouldBoosted Whether the newly created veFNX position should be boosted.
 * @param withPermanentLock If true, the created lock becomes permanent and cannot be unlocked.
 * @param managedTokenIdForAttach If non-zero, attaches the newly created veFNX position to a managed token ID.
 */
struct CreateLockParams {
    uint256 lockDuration;
    bool shouldBoosted;
    bool withPermanentLock;
    uint256 managedTokenIdForAttach;
}
```

## Example
To create a permanent `veFNX` lock (**It will also be applied to all veFNX bribes tokens that have not yet been claimed**):
```solidity
BribeVeFNXRewardToken.updateCreateLockParams(0, false, true, 0)
```