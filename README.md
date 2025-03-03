# Fenix Core

Welcome to **Fenix Core**, the new official home for the [Fenix](https://github.com/Satsyxbt/Fenix) repository!

---

## :sparkles: Repository Relocation

#### Moved From:
- **[Satsyxbt/Fenix](https://github.com/Satsyxbt/Fenix)**  
  This repository is now archived/outdated.
- **[Satsyxbt/Fenix-Dex-V3](https://github.com/Satsyxbt/fenix-dex-v3)**  
  This repository is now archived/outdated.
#### Moved To:
- **[FenixProtocol/fenix-core](https://github.com/FenixProtocol/fenix-core)**  
- **[FenixProtocol/fenix-algebra](https://github.com/FenixProtocol/fenix-algebra)**  

---

### :warning: Important Note on Fenix Dex V3
- The **old** Fenix Dex V3 repository at [Satsyxbt/Fenix-dex-v3](https://github.com/Satsyxbt/Fenix-dex-v3) has also been migrated.
- Please use **[FenixProtocol/fenix-algebra](https://github.com/FenixProtocol/fenix-algebra)** for the latest iteration of Dex V3 and related algebraic components.

---

## Project overiew

The `Fenix` protocol is a modified version of `Chronos & Thena`, introducing innovations and changes

At its core, the protocol is based on the `ve(3,3)` concept, with a new set of integrations and a variable set of rules.


### Links
- [Fenix ve(3,3) Core](https://github.com/Satsyxbt/Fenix)
- [Docs](https://docs.fenixfinance.io/)



## VotingEscrow (veFNX) Overview

### Available actions in certain states

The table below outlines the main features of the `VotingEscrowUpgradeableV2` contract, along with availability for different veNFT states.

| **Feature**                           | **Description**                                                                                  | **Permanent Locked veNFT** | **Common/Temporarily Locked veNFT** | **Attached veNFT**            | **Voted** | **EXPIRED** | **BURNED** |
|---------------------------------------|--------------------------------------------------------------------------------------------------|----------------------------|------------------------------------|-------------------------------|-----------|-------------|-------------|
| **Deposit for Lock**                  | Add more tokens to an existing lock to increase voting power.                                     | ✅                          | ✅                                  | ✅                             | ✅         | ❌           | ❌           |
| **Transfer Lock**                  | Transfer lock to new recipient.                                     | ✅                          | ✅                                  | ✅                             | ✅         | ✅           | ❌           |
| **Merge Locks (FROM)**                | Merge two veNFTs into one, combining their locked tokens and voting power.                        | ✅                          | ✅                                  | ✅                             | ✅         | ❌           | ❌           |
| **Merge Locks (TO)**                  | Merge two veNFTs into one, combining their locked tokens and voting power.                        | ✅                          | ✅                                  | ✅                             | ✅         | ❌           | ❌           |
| **Attach to Managed NFT**             | Attach a veNFT to a managed NFT, allowing delegation or staking of voting power.                  | ✅                          | ✅                                  | ✅                             | ✅         | ❌           | ❌           |
| **Burn to bribes**                    | Burning 'lock' to convert to bribe.                                                              | ✅                          | ✅                                  | ✅                             | ✅         | ❌           | ❌           |
| **Token Metadata (URI)**              | Generates metadata for veNFTs, including locked tokens and voting power information.              | ✅                          | ✅                                  | ✅                             | ✅         | ✅           | ❌           |
| **Voting Power Calculation**          | Calculates the current voting power based on lock duration and boost factors.                     | ✅                          | ✅                                  | 0                              | ✅         | 0           | ❌           |
| **Permanent Lock**                    | Convert a temporary lock to a permanent one, providing constant voting power.                     | ❌                          | ✅                                  | ❌                             | ✅         | ❌           | ❌           |
| **Increase Lock Duration**            | Extend the duration of an existing temporary lock.                                                | ❌                          | ✅                                  | ❌                             | ✅         | ❌           | ❌           |
| **Unlock Permanent Lock**             | Revert a permanent lock back to a temporary lock.                                                 | ✅                          | ❌                                  | ❌                             | ✅         | ❌           | ❌           |
| **Deposit for Attached Lock**         | Add more tokens to an existing attached lock.                                                    | ❌                          | ❌                                  | ✅                             | -          | ❌           | ❌           |
| **Detach from Managed NFT**           | Detach a veNFT from a managed NFT, reclaiming the voting power.                                   | ❌                          | ❌                                  | ✅                             | -          | ❌           | ❌           |
| **Withdraw Tokens**                   | Withdraw tokens after the lock expires.                                                           | ❌                          | ❌                                  | ❌                             | ✅         | ✅           | ❌           |
| **Create Lock**                       | Lock tokens for a specified period in exchange for a veNFT.                                       | -                          | -                                  | -                             | -          | -           |  -           |



## Setup
### Getting the code
Clone this repository
```sh
git clone --recursive -j8  https://github.com/Satsyxbt/Fenix
```
or
```sh
git clone https://github.com/Satsyxbt/Fenix
cd fenix
git submodule update --init --recursive
```

Enter into the directory
```sh
cd fenix
```

Install dependency
```sh
npm install
```

### Running basic tests
To run the existing tests, also need to compile the artifacts of the fenix-algebra library
```
sh
1.
    cd lib/fenix-algebra
    npm install

2. 
    cd src/core
    npm install
    npx hardhat compile
3.
    cd src/periphery
    npm install
    npx hardhat compile
```
run tests command
```sh
npm run test
```
or
```sh
npx hardhat test
```



