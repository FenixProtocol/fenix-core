import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect, use } from 'chai';
import { ethers } from 'hardhat';
import { ERC20Mock, GaugeMock, VoterUpgradeableV2, VotingEscrowUpgradeableV2 } from '../../typechain-types';
import { ERRORS, getAccessControlError } from '../utils/constants';
import completeFixture, { CoreFixtureDeployed, deployERC20MockToken, deployVotingEscrow, SignersList } from '../utils/coreFixture';
import { CompoundEmissionExtensionUpgradeable, Fenix } from '../../typechain-types';
import { ContractTransactionResponse, Signature } from 'ethers';
import {
  CompoundEmissionExtensionUpgradeableMock,
  CompoundEmissionExtensionUpgradeableMockInterface,
} from '../../typechain-types/contracts/mocks/CompoundEmissionExtensionUpgradeableMock';

describe('CompoundEmissionExtensionUpgradeable', function () {
  let VotingEscrow: VotingEscrowUpgradeableV2;
  let Voter: VoterUpgradeableV2;
  let Fenix: Fenix;
  let CompoundEmissionExtension: CompoundEmissionExtensionUpgradeableMock;
  let signers: SignersList;
  let deployed: CoreFixtureDeployed;

  beforeEach(async () => {
    deployed = await loadFixture(completeFixture);
    VotingEscrow = deployed.votingEscrow;
    Voter = deployed.voter;
    CompoundEmissionExtension = deployed.compoundEmissionExtension;
    Fenix = deployed.fenix;
    signers = deployed.signers;
    await Voter.grantRole(await CompoundEmissionExtension.COMPOUND_EMISSION_EXTENSION_ADMINISTRATOR_ROLE(), signers.deployer);

    await Fenix.approve(VotingEscrow.target, ethers.MaxUint256);

    for (let index = 0; index < 9; index++) {
      await VotingEscrow.createLockFor(ethers.parseEther('1'), 0, signers.otherUser1, false, true, 0);
    }
    for (let index = 0; index < 9; index++) {
      await VotingEscrow.createLockFor(ethers.parseEther('1'), 0, signers.otherUser2, false, true, 0);
    }

    expect(await VotingEscrow.lastMintedTokenId()).to.be.eq(18);
  });

  describe('Deployment', async () => {
    describe('Should fail if', async () => {
      it('try call initialize on implementation', async () => {
        let implementation = await ethers.deployContract('CompoundEmissionExtensionUpgradeable', [signers.deployer]);
        await expect(implementation.initialize(signers.blastGovernor, Voter, Fenix, VotingEscrow)).to.be.revertedWith(
          ERRORS.Initializable.Initialized,
        );
      });

      it('try call initialize second time ', async () => {
        await expect(CompoundEmissionExtension.initialize(signers.blastGovernor, Voter, Fenix, VotingEscrow)).to.be.revertedWith(
          ERRORS.Initializable.Initialized,
        );
      });
    });

    describe('Success initialize and setup init state', async () => {
      it('token', async () => {
        expect(await CompoundEmissionExtension.token()).to.be.eq(Fenix);
      });

      it('voter', async () => {
        expect(await CompoundEmissionExtension.voter()).to.be.eq(Voter);
      });

      it('votingEscrow', async () => {
        expect(await CompoundEmissionExtension.votingEscrow()).to.be.eq(VotingEscrow);
      });

      it('has COMPOUND_KEEPER_ROLE', async () => {
        expect(await CompoundEmissionExtension.COMPOUND_KEEPER_ROLE()).to.be.eq(ethers.id('COMPOUND_KEEPER_ROLE'));
      });
      it('has COMPOUND_EMISSION_EXTENSION_ADMINISTRATOR_ROLE', async () => {
        expect(await CompoundEmissionExtension.COMPOUND_EMISSION_EXTENSION_ADMINISTRATOR_ROLE()).to.be.eq(
          ethers.id('COMPOUND_EMISSION_EXTENSION_ADMINISTRATOR_ROLE'),
        );
      });
      it('defaultCreateLockConfig', async () => {
        expect(await CompoundEmissionExtension.defaultCreateLockConfig()).to.be.deep.eq([false, false, 15724800, 0]);
      });
    });
  });

  describe('#setDefaultCreateLockConfig', async () => {
    describe('Should fail if', async () => {
      it('without COMPOUND_EMISSION_EXTENSION_ADMINISTRATOR_ROLE', async () => {
        await expect(
          CompoundEmissionExtension.connect(signers.otherUser1).setDefaultCreateLockConfig({
            lockDuration: 0,
            withPermanentLock: true,
            shouldBoosted: true,
            managedTokenIdForAttach: 1,
          }),
        ).to.be.revertedWithCustomError(CompoundEmissionExtension, 'AccessDenied');
      });
      it('setup invalid config', async () => {
        await expect(
          CompoundEmissionExtension.setDefaultCreateLockConfig({
            lockDuration: 0,
            withPermanentLock: false,
            shouldBoosted: false,
            managedTokenIdForAttach: 0,
          }),
        ).to.be.revertedWithCustomError(CompoundEmissionExtension, 'InvalidCreateLockConfig');
        await expect(
          CompoundEmissionExtension.setDefaultCreateLockConfig({
            lockDuration: 0,
            withPermanentLock: false,
            shouldBoosted: true,
            managedTokenIdForAttach: 0,
          }),
        ).to.be.revertedWithCustomError(CompoundEmissionExtension, 'InvalidCreateLockConfig');
        await expect(
          CompoundEmissionExtension.setDefaultCreateLockConfig({
            lockDuration: 0,
            withPermanentLock: false,
            shouldBoosted: false,
            managedTokenIdForAttach: 1,
          }),
        ).to.be.revertedWithCustomError(CompoundEmissionExtension, 'InvalidCreateLockConfig');
        await expect(
          CompoundEmissionExtension.setDefaultCreateLockConfig({
            lockDuration: 0,
            withPermanentLock: true,
            shouldBoosted: true,
            managedTokenIdForAttach: 1,
          }),
        ).to.be.not.reverted;
      });
    });

    describe('Success set new default create lock config and emit event', async () => {
      let tx: ContractTransactionResponse;
      let newConfig = { lockDuration: 0, withPermanentLock: true, shouldBoosted: true, managedTokenIdForAttach: 1 };

      beforeEach(async () => {
        tx = await CompoundEmissionExtension.connect(signers.deployer).setDefaultCreateLockConfig(newConfig);
      });

      it('emit event', async () => {
        await expect(tx)
          .to.be.emit(CompoundEmissionExtension, 'SetDefaultCreateLockConfig')
          .withArgs([newConfig.shouldBoosted, newConfig.withPermanentLock, newConfig.lockDuration, newConfig.managedTokenIdForAttach]);
      });

      it('change default config', async () => {
        let config = await CompoundEmissionExtension.defaultCreateLockConfig();
        expect(config.lockDuration).to.be.eq(newConfig.lockDuration);
        expect(config.shouldBoosted).to.be.eq(newConfig.shouldBoosted);
        expect(config.withPermanentLock).to.be.eq(newConfig.withPermanentLock);
        expect(config.managedTokenIdForAttach).to.be.eq(newConfig.managedTokenIdForAttach);
      });

      it('after second set', async () => {
        await expect(
          CompoundEmissionExtension.connect(signers.deployer).setDefaultCreateLockConfig({
            lockDuration: 0,
            withPermanentLock: true,
            shouldBoosted: false,
            managedTokenIdForAttach: 1234,
          }),
        )
          .to.be.emit(CompoundEmissionExtension, 'SetDefaultCreateLockConfig')
          .withArgs([false, true, 0, 1234]);
        let config = await CompoundEmissionExtension.defaultCreateLockConfig();
        expect(config.lockDuration).to.be.eq(0);
        expect(config.shouldBoosted).to.be.eq(false);
        expect(config.withPermanentLock).to.be.eq(true);
        expect(config.managedTokenIdForAttach).to.be.eq(1234);
      });
    });
  });

  describe('#setCreateLockConfig', async () => {
    beforeEach(async () => {
      let user1Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
      let user2Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser2);

      expect(user1Info.toLocksPercentage).to.be.eq(0);
      expect(user1Info.targetLocks).to.be.deep.eq([]);
      expect(user1Info.targetLocks).to.be.length(0);
      expect(user1Info.createLockConfig).to.be.deep.eq([false, false, 15724800, 0]);
      expect(user1Info.isCustomConfig).to.be.false;

      expect(user2Info.toLocksPercentage).to.be.eq(0);
      expect(user2Info.targetLocks).to.be.deep.eq([]);
      expect(user2Info.targetLocks).to.be.length(0);
      expect(user2Info.createLockConfig).to.be.deep.eq([false, false, 15724800, 0]);
      expect(user2Info.isCustomConfig).to.be.false;

      expect(await CompoundEmissionExtension.getUserCreateLockConfig(signers.otherUser1)).to.be.deep.eq([false, false, 15724800, 0]);

      expect(await CompoundEmissionExtension.getUserCreateLockConfig(signers.otherUser2)).to.be.deep.eq([false, false, 15724800, 0]);
    });

    describe('success change first user config', async () => {
      let tx: ContractTransactionResponse;
      let newConfig = { lockDuration: 86400, withPermanentLock: true, shouldBoosted: true, managedTokenIdForAttach: 1 };

      beforeEach(async () => {
        tx = await CompoundEmissionExtension.connect(signers.otherUser1).setCreateLockConfig(newConfig);
      });

      it('emit event', async () => {
        await expect(tx).to.be.emit(CompoundEmissionExtension, 'SetCreateLockConfig').withArgs(signers.otherUser1, [true, true, 86400, 1]);
      });

      it('success change config to new', async () => {
        let user1Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
        let user2Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser2);

        expect(await CompoundEmissionExtension.defaultCreateLockConfig()).to.be.deep.eq([false, false, 15724800, 0]);
        expect(user1Info.toLocksPercentage).to.be.eq(0);
        expect(user1Info.targetLocks).to.be.deep.eq([]);
        expect(user1Info.targetLocks).to.be.length(0);
        expect(user1Info.createLockConfig).to.be.deep.eq([true, true, 86400, 1]);
        expect(user1Info.isCustomConfig).to.be.true;

        expect(user2Info.toLocksPercentage).to.be.eq(0);
        expect(user2Info.targetLocks).to.be.deep.eq([]);
        expect(user2Info.targetLocks).to.be.length(0);
        expect(user2Info.createLockConfig).to.be.deep.eq([false, false, 15724800, 0]);
        expect(user2Info.isCustomConfig).to.be.false;

        expect(await CompoundEmissionExtension.getUserCreateLockConfig(signers.otherUser1)).to.be.deep.eq([true, true, 86400, 1]);

        expect(await CompoundEmissionExtension.getUserCreateLockConfig(signers.otherUser2)).to.be.deep.eq([false, false, 15724800, 0]);
      });

      describe('second user setup config', async () => {
        let tx: ContractTransactionResponse;
        let newSecondConfig = { lockDuration: 157864, withPermanentLock: false, shouldBoosted: true, managedTokenIdForAttach: 2 };

        beforeEach(async () => {
          tx = await CompoundEmissionExtension.connect(signers.otherUser2).setCreateLockConfig(newSecondConfig);
        });

        it('emit event', async () => {
          await expect(tx)
            .to.be.emit(CompoundEmissionExtension, 'SetCreateLockConfig')
            .withArgs(signers.otherUser2, [true, false, 157864, 2]);
        });

        it('success change config to new', async () => {
          let user1Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
          let user2Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser2);

          expect(await CompoundEmissionExtension.defaultCreateLockConfig()).to.be.deep.eq([false, false, 15724800, 0]);
          expect(user1Info.toLocksPercentage).to.be.eq(0);
          expect(user1Info.targetLocks).to.be.deep.eq([]);
          expect(user1Info.targetLocks).to.be.length(0);
          expect(user1Info.createLockConfig).to.be.deep.eq([true, true, 86400, 1]);
          expect(user1Info.isCustomConfig).to.be.true;

          expect(user2Info.toLocksPercentage).to.be.eq(0);
          expect(user2Info.targetLocks).to.be.deep.eq([]);
          expect(user2Info.targetLocks).to.be.length(0);
          expect(user2Info.createLockConfig).to.be.deep.eq([true, false, 157864, 2]);
          expect(user2Info.isCustomConfig).to.be.true;

          expect(await CompoundEmissionExtension.getUserCreateLockConfig(signers.otherUser1)).to.be.deep.eq([true, true, 86400, 1]);

          expect(await CompoundEmissionExtension.getUserCreateLockConfig(signers.otherUser2)).to.be.deep.eq([true, false, 157864, 2]);
        });

        describe('first user clear config', async () => {
          let tx: ContractTransactionResponse;
          let clearConfig = { lockDuration: 0, withPermanentLock: false, shouldBoosted: false, managedTokenIdForAttach: 0 };

          beforeEach(async () => {
            tx = await CompoundEmissionExtension.connect(signers.otherUser1).setCreateLockConfig(clearConfig);
          });

          it('emit event', async () => {
            await expect(tx)
              .to.be.emit(CompoundEmissionExtension, 'SetCreateLockConfig')
              .withArgs(signers.otherUser1, [false, false, 0, 0]);
          });

          it('success change config to new', async () => {
            let user1Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
            let user2Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser2);

            expect(await CompoundEmissionExtension.defaultCreateLockConfig()).to.be.deep.eq([false, false, 15724800, 0]);
            expect(user1Info.toLocksPercentage).to.be.eq(0);
            expect(user1Info.targetLocks).to.be.deep.eq([]);
            expect(user1Info.targetLocks).to.be.length(0);
            expect(user1Info.createLockConfig).to.be.deep.eq([false, false, 15724800, 0]);
            expect(user1Info.isCustomConfig).to.be.false;

            expect(user2Info.toLocksPercentage).to.be.eq(0);
            expect(user2Info.targetLocks).to.be.deep.eq([]);
            expect(user2Info.targetLocks).to.be.length(0);
            expect(user2Info.createLockConfig).to.be.deep.eq([true, false, 157864, 2]);
            expect(user2Info.isCustomConfig).to.be.true;

            expect(await CompoundEmissionExtension.getUserCreateLockConfig(signers.otherUser1)).to.be.deep.eq([false, false, 15724800, 0]);

            expect(await CompoundEmissionExtension.getUserCreateLockConfig(signers.otherUser2)).to.be.deep.eq([true, false, 157864, 2]);
          });
          describe('second user change config', async () => {
            let tx: ContractTransactionResponse;
            let newSecondUserConfig = { lockDuration: 0, withPermanentLock: true, shouldBoosted: false, managedTokenIdForAttach: 0 };

            beforeEach(async () => {
              tx = await CompoundEmissionExtension.connect(signers.otherUser2).setCreateLockConfig(newSecondUserConfig);
            });

            it('emit event', async () => {
              await expect(tx)
                .to.be.emit(CompoundEmissionExtension, 'SetCreateLockConfig')
                .withArgs(signers.otherUser2, [false, true, 0, 0]);
            });

            it('success change config to new', async () => {
              let user1Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
              let user2Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser2);

              expect(await CompoundEmissionExtension.defaultCreateLockConfig()).to.be.deep.eq([false, false, 15724800, 0]);
              expect(user1Info.toLocksPercentage).to.be.eq(0);
              expect(user1Info.targetLocks).to.be.deep.eq([]);
              expect(user1Info.targetLocks).to.be.length(0);
              expect(user1Info.createLockConfig).to.be.deep.eq([false, false, 15724800, 0]);
              expect(user1Info.isCustomConfig).to.be.false;

              expect(user2Info.toLocksPercentage).to.be.eq(0);
              expect(user2Info.targetLocks).to.be.deep.eq([]);
              expect(user2Info.targetLocks).to.be.length(0);
              expect(user2Info.createLockConfig).to.be.deep.eq([false, true, 0, 0]);
              expect(user2Info.isCustomConfig).to.be.true;

              expect(await CompoundEmissionExtension.getUserCreateLockConfig(signers.otherUser1)).to.be.deep.eq([
                false,
                false,
                15724800,
                0,
              ]);

              expect(await CompoundEmissionExtension.getUserCreateLockConfig(signers.otherUser2)).to.be.deep.eq([false, true, 0, 0]);
            });
          });
        });
      });
    });

    describe('Should fail if', async () => {
      it('user try setup invalid config', async () => {
        await expect(
          CompoundEmissionExtension.connect(signers.otherUser1).setCreateLockConfig({
            lockDuration: 0,
            withPermanentLock: false,
            managedTokenIdForAttach: 1,
            shouldBoosted: false,
          }),
        ).to.be.revertedWithCustomError(CompoundEmissionExtension, 'InvalidCreateLockConfig');
      });
    });
  });

  describe('#setCompoundEmissionConfig', async () => {
    beforeEach(async () => {
      expect(await CompoundEmissionExtension.getToLocksPercentage(signers.otherUser1)).to.be.eq(0);
      expect(await CompoundEmissionExtension.getToLocksPercentage(signers.otherUser2)).to.be.eq(0);

      let user1Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
      let user2Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser2);
      expect(user1Info.toLocksPercentage).to.be.eq(0);
      expect(user1Info.targetLocks).to.be.deep.eq([]);
      expect(user1Info.targetLocks).to.be.length(0);

      expect(user2Info.toLocksPercentage).to.be.eq(0);
      expect(user2Info.targetLocks).to.be.deep.eq([]);
      expect(user2Info.targetLocks).to.be.length(0);
    });

    describe('Should fail if', async () => {
      it('toLocksPercentage more then 100%', async () => {
        await expect(
          CompoundEmissionExtension.connect(signers.otherUser1).setCompoundEmissionConfig(ethers.parseEther('1') + 1n, []),
        ).to.be.revertedWithCustomError(CompoundEmissionExtension, 'InvalidCompoundEmissionParams');
      });
      it('toLocksPercentage > 0, but user not provided any target locks', async () => {
        await expect(
          CompoundEmissionExtension.connect(signers.otherUser1).setCompoundEmissionConfig(ethers.parseEther('1'), []),
        ).to.be.revertedWithCustomError(CompoundEmissionExtension, 'InvalidCompoundEmissionParams');
      });

      it('setup locks ids not own by user', async () => {
        await expect(
          CompoundEmissionExtension.connect(signers.otherUser1).setCompoundEmissionConfig(1, [
            { tokenId: 11, lockPercentage: ethers.parseEther('1') },
          ]),
        ).to.be.revertedWithCustomError(CompoundEmissionExtension, 'AnotherUserTargetLocks');
        await expect(
          CompoundEmissionExtension.connect(signers.otherUser2).setCompoundEmissionConfig(1, [
            { tokenId: 1, lockPercentage: ethers.parseEther('1') },
          ]),
        ).to.be.revertedWithCustomError(CompoundEmissionExtension, 'AnotherUserTargetLocks');
      });
      it('toLocksPercentage == 0, but user provided any target locks', async () => {
        await expect(
          CompoundEmissionExtension.connect(signers.otherUser1).setCompoundEmissionConfig(0, [
            { tokenId: 1, lockPercentage: ethers.parseEther('1') },
          ]),
        ).to.be.revertedWithCustomError(CompoundEmissionExtension, 'InvalidCompoundEmissionParams');
      });

      it('sum provided locks for setup not eq 100%', async () => {
        await expect(
          CompoundEmissionExtension.connect(signers.otherUser1).setCompoundEmissionConfig(ethers.parseEther('1'), [
            { tokenId: 1, lockPercentage: ethers.parseEther('0.5') },
            { tokenId: 2, lockPercentage: ethers.parseEther('0.5') + 1n },
          ]),
        ).to.be.revertedWithCustomError(CompoundEmissionExtension, 'InvalidCompoundEmissionParams');
        await expect(
          CompoundEmissionExtension.connect(signers.otherUser1).setCompoundEmissionConfig(ethers.parseEther('1'), [
            { tokenId: 1, lockPercentage: ethers.parseEther('0.5') - 1n },
            { tokenId: 2, lockPercentage: ethers.parseEther('0.5') },
          ]),
        ).to.be.revertedWithCustomError(CompoundEmissionExtension, 'InvalidCompoundEmissionParams');
      });
    });

    describe('Success update compound emission config for first user, 100%, to one lock', async () => {
      let tx: any;
      beforeEach(async () => {
        tx = await CompoundEmissionExtension.connect(signers.otherUser1).setCompoundEmissionConfig(ethers.parseEther('1'), [
          { tokenId: 2, lockPercentage: ethers.parseEther('1') },
        ]);
      });

      it('change information', async () => {
        expect(await CompoundEmissionExtension.getToLocksPercentage(signers.otherUser1)).to.be.eq(ethers.parseEther('1'));
        expect(await CompoundEmissionExtension.getToLocksPercentage(signers.otherUser2)).to.be.eq(0);

        let user1Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
        let user2Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser2);
        expect(user1Info.toLocksPercentage).to.be.eq(ethers.parseEther('1'));
        expect(user1Info.targetLocks).to.be.deep.eq([[2, ethers.parseEther('1')]]);
        expect(user1Info.targetLocks).to.be.length(1);

        expect(user2Info.toLocksPercentage).to.be.eq(0);
        expect(user2Info.targetLocks).to.be.deep.eq([]);
        expect(user2Info.targetLocks).to.be.length(0);
      });

      it('emit events', async () => {
        await expect(tx)
          .to.be.emit(CompoundEmissionExtension, 'SetCompoundEmissionConfig')
          .withArgs(signers.otherUser1, ethers.parseEther('1'), (t: any[]) => {
            expect(t).to.be.length(1);
            expect(t[0][0]).to.be.eq(2);
            expect(t[0][1]).to.be.eq(ethers.parseEther('1'));
            return true;
          });
      });

      describe('Success update compound emission config for second user, 50%, to two diff lock 25% 75%', async () => {
        let tx: any;
        beforeEach(async () => {
          tx = await CompoundEmissionExtension.connect(signers.otherUser2).setCompoundEmissionConfig(ethers.parseEther('0.5'), [
            { tokenId: 13, lockPercentage: ethers.parseEther('0.25') },
            { tokenId: 14, lockPercentage: ethers.parseEther('0.75') },
          ]);
        });

        it('change information', async () => {
          expect(await CompoundEmissionExtension.getToLocksPercentage(signers.otherUser1)).to.be.eq(ethers.parseEther('1'));
          expect(await CompoundEmissionExtension.getToLocksPercentage(signers.otherUser2)).to.be.eq(ethers.parseEther('0.5'));

          let user1Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
          let user2Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser2);
          expect(user1Info.toLocksPercentage).to.be.eq(ethers.parseEther('1'));
          expect(user1Info.targetLocks).to.be.deep.eq([[2, ethers.parseEther('1')]]);
          expect(user1Info.targetLocks).to.be.length(1);

          expect(user2Info.toLocksPercentage).to.be.eq(ethers.parseEther('0.5'));
          expect(user2Info.targetLocks).to.be.deep.eq([
            [13, ethers.parseEther('0.25')],
            [14, ethers.parseEther('0.75')],
          ]);
          expect(user2Info.targetLocks).to.be.length(2);
        });

        it('emit events', async () => {
          await expect(tx)
            .to.be.emit(CompoundEmissionExtension, 'SetCompoundEmissionConfig')
            .withArgs(
              signers.otherUser2,
              ethers.parseEther('0.5'),

              (t: any[]) => {
                expect(t).to.be.length(2);
                expect(t[0][0]).to.be.eq(13);
                expect(t[0][1]).to.be.eq(ethers.parseEther('0.25'));
                expect(t[1][0]).to.be.eq(14);
                expect(t[1][1]).to.be.eq(ethers.parseEther('0.75'));
                return true;
              },
            );
        });

        describe('Success update compound emission config for first user, 35%, to two diff lock, 60%, 40%, and second lock is zero, to create new lock in future', async () => {
          let tx: any;
          beforeEach(async () => {
            tx = await CompoundEmissionExtension.connect(signers.otherUser1).setCompoundEmissionConfig(ethers.parseEther('0.35'), [
              { tokenId: 1, lockPercentage: ethers.parseEther('0.60') },
              { tokenId: 0, lockPercentage: ethers.parseEther('0.40') },
            ]);
          });

          it('change information', async () => {
            expect(await CompoundEmissionExtension.getToLocksPercentage(signers.otherUser1)).to.be.eq(ethers.parseEther('0.35'));
            expect(await CompoundEmissionExtension.getToLocksPercentage(signers.otherUser2)).to.be.eq(ethers.parseEther('0.5'));

            let user1Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
            let user2Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser2);
            expect(user1Info.toLocksPercentage).to.be.eq(ethers.parseEther('0.35'));
            expect(user1Info.targetLocks).to.be.deep.eq([
              [1, ethers.parseEther('0.6')],
              [0, ethers.parseEther('0.4')],
            ]);
            expect(user1Info.targetLocks).to.be.length(2);

            expect(user2Info.toLocksPercentage).to.be.eq(ethers.parseEther('0.5'));
            expect(user2Info.targetLocks).to.be.deep.eq([
              [13, ethers.parseEther('0.25')],
              [14, ethers.parseEther('0.75')],
            ]);
            expect(user2Info.targetLocks).to.be.length(2);
          });

          it('emit events', async () => {
            await expect(tx)
              .to.be.emit(CompoundEmissionExtension, 'SetCompoundEmissionConfig')
              .withArgs(
                signers.otherUser1,
                ethers.parseEther('0.35'),

                (t: any[]) => {
                  expect(t).to.be.length(2);
                  expect(t[0][0]).to.be.eq(1);
                  expect(t[0][1]).to.be.eq(ethers.parseEther('0.6'));
                  expect(t[1][0]).to.be.eq(0);
                  expect(t[1][1]).to.be.eq(ethers.parseEther('0.4'));
                  return true;
                },
              );
          });

          describe('Success update compound emission config for second user, 0 to locks', async () => {
            let tx: any;
            beforeEach(async () => {
              tx = await CompoundEmissionExtension.connect(signers.otherUser2).setCompoundEmissionConfig(0, []);
            });

            it('change information', async () => {
              expect(await CompoundEmissionExtension.getToLocksPercentage(signers.otherUser1)).to.be.eq(ethers.parseEther('0.35'));
              expect(await CompoundEmissionExtension.getToLocksPercentage(signers.otherUser2)).to.be.eq(0);

              let user1Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
              let user2Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser2);
              expect(user1Info.toLocksPercentage).to.be.eq(ethers.parseEther('0.35'));
              expect(user1Info.targetLocks).to.be.deep.eq([
                [1, ethers.parseEther('0.6')],
                [0, ethers.parseEther('0.4')],
              ]);
              expect(user1Info.targetLocks).to.be.length(2);

              expect(user2Info.toLocksPercentage).to.be.eq(0);
              expect(user2Info.targetLocks).to.be.deep.eq([]);
              expect(user2Info.targetLocks).to.be.length(0);
            });

            it('emit events', async () => {
              await expect(tx)
                .to.be.emit(CompoundEmissionExtension, 'SetCompoundEmissionConfig')
                .withArgs(signers.otherUser2, ethers.parseEther('0'), []);
            });
          });
        });
      });
    });
  });

  describe('#changeEmissionTargetLockId', async () => {
    describe('Should fail if', async () => {
      it('caller is not voter contract', async () => {
        await expect(CompoundEmissionExtension.changeEmissionTargetLockId(ethers.ZeroAddress, 0, 0)).to.be.revertedWithCustomError(
          CompoundEmissionExtension,
          'AccessDenied',
        );
      });
    });

    describe('success call, change one token in list to another ', async () => {
      beforeEach(async () => {
        await CompoundEmissionExtension.mock_setupVoter(signers.deployer);

        await CompoundEmissionExtension.connect(signers.otherUser1).setCompoundEmissionConfig(ethers.parseEther('1'), [
          {
            tokenId: 1,
            lockPercentage: ethers.parseEther('0.1'),
          },
          {
            tokenId: 2,
            lockPercentage: ethers.parseEther('0.5'),
          },
          {
            tokenId: 3,
            lockPercentage: ethers.parseEther('0.4'),
          },
        ]);
      });

      it('call without effect if targetTokenId not present in targetLocks list', async () => {
        let tx = await CompoundEmissionExtension.changeEmissionTargetLockId(signers.otherUser1, 4, 0);
        await expect(tx).to.be.not.emit(CompoundEmissionExtension, 'ChangeEmissionTargetLock');
        let userInfo = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
        expect(userInfo.targetLocks).to.be.deep.eq([
          [1, ethers.parseEther('0.1')],
          [2, ethers.parseEther('0.5')],
          [3, ethers.parseEther('0.4')],
        ]);
      });

      it('targetTokenId present only in one instance ', async () => {
        let tx = await CompoundEmissionExtension.changeEmissionTargetLockId(signers.otherUser1, 2, 4);
        await expect(tx).to.be.emit(CompoundEmissionExtension, 'ChangeEmissionTargetLock').withArgs(signers.otherUser1, 2, 4);
        let userInfo = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
        expect(userInfo.targetLocks).to.be.deep.eq([
          [1, ethers.parseEther('0.1')],
          [4, ethers.parseEther('0.5')],
          [3, ethers.parseEther('0.4')],
        ]);
      });

      it('targetTokenId present only in one instance, but new token already present ', async () => {
        let tx = await CompoundEmissionExtension.changeEmissionTargetLockId(signers.otherUser1, 2, 3);
        await expect(tx).to.be.emit(CompoundEmissionExtension, 'ChangeEmissionTargetLock').withArgs(signers.otherUser1, 2, 3);
        let userInfo = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
        expect(userInfo.targetLocks).to.be.deep.eq([
          [1, ethers.parseEther('0.1')],
          [3, ethers.parseEther('0.5')],
          [3, ethers.parseEther('0.4')],
        ]);
      });

      it('targetTokenId present only in one instance, but new token is zero ', async () => {
        let tx = await CompoundEmissionExtension.changeEmissionTargetLockId(signers.otherUser1, 1, 0);
        await expect(tx).to.be.emit(CompoundEmissionExtension, 'ChangeEmissionTargetLock').withArgs(signers.otherUser1, 1, 0);
        let userInfo = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
        expect(userInfo.targetLocks).to.be.deep.eq([
          [0, ethers.parseEther('0.1')],
          [2, ethers.parseEther('0.5')],
          [3, ethers.parseEther('0.4')],
        ]);
      });
    });

    describe('during transfer to another user', async () => {
      beforeEach(async () => {
        await CompoundEmissionExtension.connect(signers.otherUser1).setCompoundEmissionConfig(ethers.parseEther('1'), [
          {
            tokenId: 1,
            lockPercentage: ethers.parseEther('0.1'),
          },
          {
            tokenId: 2,
            lockPercentage: ethers.parseEther('0.5'),
          },
          {
            tokenId: 3,
            lockPercentage: ethers.parseEther('0.4'),
          },
        ]);
        await CompoundEmissionExtension.connect(signers.otherUser2).setCompoundEmissionConfig(ethers.parseEther('0.1'), [
          {
            tokenId: 11,
            lockPercentage: ethers.parseEther('0.5'),
          },
          {
            tokenId: 12,
            lockPercentage: ethers.parseEther('0.4'),
          },
          {
            tokenId: 12,
            lockPercentage: ethers.parseEther('0.06'),
          },
          {
            tokenId: 13,
            lockPercentage: ethers.parseEther('0.04'),
          },
        ]);
      });

      it('ignore, if transfer token not present in targets lock list', async () => {
        await expect(VotingEscrow.connect(signers.otherUser2).transferFrom(signers.otherUser2, signers.otherUser3, 14)).to.be.not.emit(
          CompoundEmissionExtension,
          'ChangeEmissionTargetLock',
        );
      });

      it('success change emission target lock id to ZERO, if transfer token present in targets lock list', async () => {
        await expect(VotingEscrow.connect(signers.otherUser2).transferFrom(signers.otherUser2, signers.otherUser3, 13))
          .to.be.emit(CompoundEmissionExtension, 'ChangeEmissionTargetLock')
          .withArgs(signers.otherUser2, 13, 0);
        let userInfo = await CompoundEmissionExtension.getUserInfo(signers.otherUser2);
        expect(userInfo.targetLocks).to.be.deep.eq([
          [11, ethers.parseEther('0.5')],
          [12, ethers.parseEther('0.4')],
          [12, ethers.parseEther('0.06')],
          [0, ethers.parseEther('0.04')],
        ]);
      });

      it('success change emission target lock id to ZERO, if transfer token present in targets lock list but in two instance, (should change all)', async () => {
        await expect(VotingEscrow.connect(signers.otherUser2).transferFrom(signers.otherUser2, signers.otherUser3, 12))
          .to.be.emit(CompoundEmissionExtension, 'ChangeEmissionTargetLock')
          .withArgs(signers.otherUser2, 12, 0);

        let userInfo = await CompoundEmissionExtension.getUserInfo(signers.otherUser2);
        expect(userInfo.targetLocks).to.be.deep.eq([
          [11, ethers.parseEther('0.5')],
          [0, ethers.parseEther('0.4')],
          [0, ethers.parseEther('0.06')],
          [13, ethers.parseEther('0.04')],
        ]);
      });
    });
    describe('during merge locks', async () => {
      beforeEach(async () => {
        await CompoundEmissionExtension.connect(signers.otherUser1).setCompoundEmissionConfig(ethers.parseEther('1'), [
          {
            tokenId: 1,
            lockPercentage: ethers.parseEther('0.1'),
          },
          {
            tokenId: 2,
            lockPercentage: ethers.parseEther('0.5'),
          },
          {
            tokenId: 3,
            lockPercentage: ethers.parseEther('0.4'),
          },
        ]);
        await CompoundEmissionExtension.connect(signers.otherUser2).setCompoundEmissionConfig(ethers.parseEther('0.1'), [
          {
            tokenId: 11,
            lockPercentage: ethers.parseEther('0.5'),
          },
          {
            tokenId: 12,
            lockPercentage: ethers.parseEther('0.4'),
          },
          {
            tokenId: 12,
            lockPercentage: ethers.parseEther('0.06'),
          },
          {
            tokenId: 13,
            lockPercentage: ethers.parseEther('0.04'),
          },
        ]);
      });

      it('ignore, if tokn from merge not present in targets lock list', async () => {
        await expect(VotingEscrow.connect(signers.otherUser1).merge(4, 5)).to.be.not.emit(
          CompoundEmissionExtension,
          'ChangeEmissionTargetLock',
        );
      });

      it('success change emission target lock id to merge to, if merged token present in targets lock list', async () => {
        await expect(VotingEscrow.connect(signers.otherUser1).merge(3, 4))
          .to.be.emit(CompoundEmissionExtension, 'ChangeEmissionTargetLock')
          .withArgs(signers.otherUser1, 3, 4);
        let userInfo = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
        expect(userInfo.targetLocks).to.be.deep.eq([
          [1, ethers.parseEther('0.1')],
          [2, ethers.parseEther('0.5')],
          [4, ethers.parseEther('0.4')],
        ]);
      });

      it('success change emission target lock id to merge to, if transfer token present in targets locks list, and merge to also present', async () => {
        await expect(VotingEscrow.connect(signers.otherUser1).merge(3, 2))
          .to.be.emit(CompoundEmissionExtension, 'ChangeEmissionTargetLock')
          .withArgs(signers.otherUser1, 3, 2);
        let userInfo = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
        expect(userInfo.targetLocks).to.be.deep.eq([
          [1, ethers.parseEther('0.1')],
          [2, ethers.parseEther('0.5')],
          [2, ethers.parseEther('0.4')],
        ]);
      });

      it('ignore any changes if merge to present in list, but merge from not present', async () => {
        await expect(VotingEscrow.connect(signers.otherUser1).merge(4, 2)).to.be.not.emit(
          CompoundEmissionExtension,
          'ChangeEmissionTargetLock',
        );
      });
    });
  });

  describe('getAmountOutToLocks should success return calculated amount to locks from input', async () => {
    it('user not setup lock percentage', async () => {
      expect(await CompoundEmissionExtension.getToLocksPercentage(signers.otherUser1)).to.be.eq(0);
      expect(await CompoundEmissionExtension.getAmountOutToLocks(signers.otherUser1, 0)).to.be.eq(0);
      expect(await CompoundEmissionExtension.getAmountOutToLocks(signers.otherUser1, 1)).to.be.eq(0);
      expect(await CompoundEmissionExtension.getAmountOutToLocks(signers.otherUser1, 1e9)).to.be.eq(0);
      expect(await CompoundEmissionExtension.getAmountOutToLocks(signers.otherUser1, ethers.parseEther('1'))).to.be.eq(0);
    });

    it('user setup 100% to locks percentage', async () => {
      await CompoundEmissionExtension.connect(signers.otherUser1).setCompoundEmissionConfig(ethers.parseEther('1'), [
        { tokenId: 1, lockPercentage: ethers.parseEther('1') },
      ]);
      expect(await CompoundEmissionExtension.getToLocksPercentage(signers.otherUser1)).to.be.eq(ethers.parseEther('1'));

      expect(await CompoundEmissionExtension.getAmountOutToLocks(signers.otherUser1, 0)).to.be.eq(0);
      expect(await CompoundEmissionExtension.getAmountOutToLocks(signers.otherUser1, 1)).to.be.eq(1);
      expect(await CompoundEmissionExtension.getAmountOutToLocks(signers.otherUser1, 1e9)).to.be.eq(1e9);
      expect(await CompoundEmissionExtension.getAmountOutToLocks(signers.otherUser1, ethers.parseEther('1'))).to.be.eq(
        ethers.parseEther('1'),
      );
      expect(await CompoundEmissionExtension.getAmountOutToLocks(signers.otherUser1, ethers.parseEther('12345678.87654321'))).to.be.eq(
        ethers.parseEther('12345678.87654321'),
      );
    });
    it('user setup 10% to locks percentage', async () => {
      await CompoundEmissionExtension.connect(signers.otherUser1).setCompoundEmissionConfig(ethers.parseEther('0.1'), [
        { tokenId: 1, lockPercentage: ethers.parseEther('1') },
      ]);
      expect(await CompoundEmissionExtension.getToLocksPercentage(signers.otherUser1)).to.be.eq(ethers.parseEther('0.1'));

      expect(await CompoundEmissionExtension.getAmountOutToLocks(signers.otherUser1, 0)).to.be.eq(0);
      expect(await CompoundEmissionExtension.getAmountOutToLocks(signers.otherUser1, 1)).to.be.eq(0);
      expect(await CompoundEmissionExtension.getAmountOutToLocks(signers.otherUser1, 1e9)).to.be.eq(1e8);
      expect(await CompoundEmissionExtension.getAmountOutToLocks(signers.otherUser1, ethers.parseEther('1'))).to.be.eq(
        ethers.parseEther('0.1'),
      );
      expect(await CompoundEmissionExtension.getAmountOutToLocks(signers.otherUser1, ethers.parseEther('12345678.87654321'))).to.be.eq(
        ethers.parseEther('1234567.887654321'),
      );
    });
  });

  describe('Compound flow', async () => {
    describe('#compoundEmissionClaimBatch', async () => {
      describe('Should fail if', async () => {
        it('caller not have COMPOUND_KEEPER_ROLE', async () => {
          expect(await Voter.hasRole(await CompoundEmissionExtension.COMPOUND_KEEPER_ROLE(), signers.deployer)).to.be.false;
          await expect(CompoundEmissionExtension.compoundEmissionClaimBatch([])).to.be.revertedWithCustomError(
            CompoundEmissionExtension,
            'AccessDenied',
          );

          await Voter.grantRole(await CompoundEmissionExtension.COMPOUND_KEEPER_ROLE(), signers.deployer);
          expect(await Voter.hasRole(await CompoundEmissionExtension.COMPOUND_KEEPER_ROLE(), signers.deployer)).to.be.true;
          await expect(CompoundEmissionExtension.compoundEmissionClaimBatch([])).to.be.not.reverted;
        });
      });
    });

    describe('#compoundEmissionClaim', async () => {
      describe('Should fail if', async () => {
        it('caller setup target address not eq caller', async () => {
          await expect(
            CompoundEmissionExtension.connect(signers.otherUser1).compoundEmisisonClaim({
              target: signers.otherUser2,
              gauges: [],
              merkl: { users: [], proofs: [], tokens: [], amounts: [] },
            }),
          ).to.be.revertedWithCustomError(CompoundEmissionExtension, 'AccessDenied');

          await expect(
            CompoundEmissionExtension.connect(signers.otherUser1).compoundEmisisonClaim({
              target: signers.otherUser1,
              gauges: [],
              merkl: { users: [], proofs: [], tokens: [], amounts: [] },
            }),
          ).to.be.not.reverted;
        });
      });
    });
    describe('Should fail if', async () => {
      it('User provide not own address ,in  users arrays (Merkl params)', async () => {
        await expect(
          CompoundEmissionExtension.connect(signers.otherUser1).compoundEmisisonClaim({
            target: signers.otherUser1,
            gauges: [],
            merkl: {
              proofs: [],
              amounts: [],
              tokens: [],
              users: [signers.otherUser2],
            },
          }),
        ).to.be.revertedWithCustomError(Voter, 'InvalidMerklDataUser');
      });
      it('KEEPER provide different target and user address ,in  users arrays (Merkl params)', async () => {
        await Voter.grantRole(await CompoundEmissionExtension.COMPOUND_KEEPER_ROLE(), signers.deployer);

        await expect(
          CompoundEmissionExtension.connect(signers.deployer).compoundEmissionClaimBatch([
            {
              target: signers.otherUser1,
              gauges: [],
              merkl: {
                proofs: [],
                amounts: [],
                tokens: [],
                users: [signers.otherUser2],
              },
            },
          ]),
        ).to.be.revertedWithCustomError(Voter, 'InvalidMerklDataUser');
      });
    });

    describe('Should success claim rewards for user and distribute to locks from gauges', async () => {
      let gauge1: GaugeMock;
      let gauge2: GaugeMock;

      beforeEach(async () => {
        await Voter.grantRole(await CompoundEmissionExtension.COMPOUND_KEEPER_ROLE(), signers.deployer);

        gauge1 = await ethers.deployContract('GaugeMock', [Fenix]);
        gauge2 = await ethers.deployContract('GaugeMock', [Fenix]);
        await Fenix.transfer(gauge1, ethers.parseEther('1000'));
        await Fenix.transfer(gauge2, ethers.parseEther('1000'));

        await gauge1.mock__setupReward(signers.otherUser1, ethers.parseEther('100'));
        await gauge1.mock__setupReward(signers.otherUser2, ethers.parseEther('200'));

        await gauge2.mock__setupReward(signers.otherUser1, ethers.parseEther('100'));
        await gauge2.mock__setupReward(signers.otherUser2, ethers.parseEther('200'));

        expect(await Fenix.balanceOf(signers.otherUser1)).to.be.eq(0);
        expect(await Fenix.balanceOf(signers.otherUser2)).to.be.eq(0);
        expect(await Fenix.balanceOf(CompoundEmissionExtension)).to.be.eq(0);
        expect(await Fenix.balanceOf(Voter)).to.be.eq(0);
      });

      afterEach(async () => {
        expect(await Fenix.balanceOf(CompoundEmissionExtension)).to.be.eq(0);
        expect(await Fenix.balanceOf(Voter)).to.be.eq(0);
      });

      describe('from KEEPER', async () => {
        it('Not distribute to any locks, because user1 toLocksPercenatege is zero', async () => {
          expect(await CompoundEmissionExtension.getToLocksPercentage(signers.otherUser1)).to.be.eq(0);

          let tx = await CompoundEmissionExtension.compoundEmissionClaimBatch([
            {
              target: signers.otherUser1,
              gauges: [gauge1, gauge2],
              merkl: {
                proofs: [],
                users: [],
                amounts: [],
                tokens: [],
              },
            },
            {
              target: signers.otherUser2,
              gauges: [gauge1],
              merkl: {
                proofs: [],
                users: [],
                amounts: [],
                tokens: [],
              },
            },
          ]);
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(gauge1, signers.otherUser1, ethers.parseEther('100'));
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(gauge2, signers.otherUser1, ethers.parseEther('100'));
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(gauge1, signers.otherUser2, ethers.parseEther('200'));
          expect(await Fenix.balanceOf(signers.otherUser1)).to.be.eq(ethers.parseEther('200'));
          expect(await Fenix.balanceOf(signers.otherUser2)).to.be.eq(ethers.parseEther('200'));
        });

        it('user 1 setup distribute 50% to one lock', async () => {
          await Fenix.connect(signers.otherUser1).approve(Voter, ethers.MaxUint256);

          await CompoundEmissionExtension.connect(signers.otherUser1).setCompoundEmissionConfig(ethers.parseEther('0.5'), [
            {
              tokenId: 1,
              lockPercentage: ethers.parseEther('1'),
            },
          ]);

          expect(await CompoundEmissionExtension.getToLocksPercentage(signers.otherUser1)).to.be.eq(ethers.parseEther('0.5'));

          expect((await VotingEscrow.getNftState(1)).locked.amount).to.be.eq(ethers.parseEther('1'));

          let tx = await CompoundEmissionExtension.compoundEmissionClaimBatch([
            {
              target: signers.otherUser1,
              gauges: [gauge1, gauge2],
              merkl: {
                proofs: [],
                users: [],
                amounts: [],
                tokens: [],
              },
            },
            {
              target: signers.otherUser2,
              gauges: [gauge1],
              merkl: {
                proofs: [],
                users: [],
                amounts: [],
                tokens: [],
              },
            },
          ]);
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(gauge1, signers.otherUser1, ethers.parseEther('100'));
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(gauge2, signers.otherUser1, ethers.parseEther('100'));
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(gauge1, signers.otherUser2, ethers.parseEther('200'));

          expect(await Fenix.balanceOf(signers.otherUser1)).to.be.eq(ethers.parseEther('100'));
          expect(await Fenix.balanceOf(signers.otherUser2)).to.be.eq(ethers.parseEther('200'));

          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(signers.otherUser1, Voter, ethers.parseEther('100'));
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(Voter, CompoundEmissionExtension, ethers.parseEther('100'));
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(CompoundEmissionExtension, VotingEscrow, ethers.parseEther('100'));

          expect((await VotingEscrow.getNftState(1)).locked.amount).to.be.eq(ethers.parseEther('101'));
        });

        it('user 1 setup distribute 50% to two lock, user 2 setup distribute all to ZERO (create new lock in first time), custom create lock config', async () => {
          await CompoundEmissionExtension.connect(signers.otherUser2).setCreateLockConfig({
            lockDuration: 0,
            withPermanentLock: true,
            shouldBoosted: true,
            managedTokenIdForAttach: 0,
          });

          await Fenix.connect(signers.otherUser1).approve(Voter, ethers.MaxUint256);
          await Fenix.connect(signers.otherUser2).approve(Voter, ethers.MaxUint256);

          await CompoundEmissionExtension.connect(signers.otherUser1).setCompoundEmissionConfig(ethers.parseEther('0.5'), [
            {
              tokenId: 1,
              lockPercentage: ethers.parseEther('0.6'),
            },
            {
              tokenId: 2,
              lockPercentage: ethers.parseEther('0.4'),
            },
          ]);

          await CompoundEmissionExtension.connect(signers.otherUser2).setCompoundEmissionConfig(ethers.parseEther('1'), [
            {
              tokenId: 0,
              lockPercentage: ethers.parseEther('0.5'),
            },
            {
              tokenId: 11,
              lockPercentage: ethers.parseEther('0.5'),
            },
          ]);

          expect(await CompoundEmissionExtension.getToLocksPercentage(signers.otherUser1)).to.be.eq(ethers.parseEther('0.5'));
          expect(await CompoundEmissionExtension.getToLocksPercentage(signers.otherUser2)).to.be.eq(ethers.parseEther('1'));

          expect((await VotingEscrow.getNftState(1)).locked.amount).to.be.eq(ethers.parseEther('1'));
          expect((await VotingEscrow.getNftState(2)).locked.amount).to.be.eq(ethers.parseEther('1'));

          let user1Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
          let user2Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser2);

          expect(user1Info.toLocksPercentage).to.be.eq(ethers.parseEther('0.5'));
          expect(user1Info.targetLocks).to.be.deep.eq([
            [1, ethers.parseEther('0.6')],
            [2, ethers.parseEther('0.4')],
          ]);

          expect(user1Info.targetLocks).to.be.length(2);
          expect(user1Info.createLockConfig).to.be.deep.eq([false, false, 15724800, 0]);
          expect(user1Info.isCustomConfig).to.be.false;

          expect(user2Info.toLocksPercentage).to.be.eq(ethers.parseEther('1'));
          expect(user2Info.targetLocks).to.be.deep.eq([
            [0, ethers.parseEther('0.5')],
            [11, ethers.parseEther('0.5')],
          ]);
          expect(user2Info.targetLocks).to.be.length(2);
          expect(user2Info.createLockConfig).to.be.deep.eq([true, true, 0, 0]);
          expect(user2Info.isCustomConfig).to.be.true;

          let lastMintedTokenId = await VotingEscrow.lastMintedTokenId();

          let tx = await CompoundEmissionExtension.compoundEmissionClaimBatch([
            {
              target: signers.otherUser1,
              gauges: [gauge1, gauge2],
              merkl: {
                proofs: [],
                users: [],
                amounts: [],
                tokens: [],
              },
            },
            {
              target: signers.otherUser2,
              gauges: [gauge1],
              merkl: {
                proofs: [],
                users: [],
                amounts: [],
                tokens: [],
              },
            },
          ]);
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(gauge1, signers.otherUser1, ethers.parseEther('100'));
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(gauge2, signers.otherUser1, ethers.parseEther('100'));
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(gauge1, signers.otherUser2, ethers.parseEther('200'));

          expect(await Fenix.balanceOf(signers.otherUser1)).to.be.eq(ethers.parseEther('100'));
          expect(await Fenix.balanceOf(signers.otherUser2)).to.be.eq(0);

          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(signers.otherUser1, Voter, ethers.parseEther('100'));
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(Voter, CompoundEmissionExtension, ethers.parseEther('100'));

          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(signers.otherUser2, Voter, ethers.parseEther('200'));
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(Voter, CompoundEmissionExtension, ethers.parseEther('200'));

          expect((await VotingEscrow.getNftState(1)).locked.amount).to.be.eq(ethers.parseEther('61'));
          expect((await VotingEscrow.getNftState(2)).locked.amount).to.be.eq(ethers.parseEther('41'));

          expect((await VotingEscrow.getNftState(11)).locked.amount).to.be.eq(ethers.parseEther('101'));

          expect((await VotingEscrow.getNftState(lastMintedTokenId + 1n)).locked.amount).to.be.eq(ethers.parseEther('100'));

          expect(await VotingEscrow.ownerOf(lastMintedTokenId + 1n)).to.be.eq(signers.otherUser2);

          await expect(tx)
            .to.be.emit(CompoundEmissionExtension, 'CreateLockFromCompoundEmission')
            .withArgs(signers.otherUser2, lastMintedTokenId + 1n, ethers.parseEther('100'));

          await expect(tx)
            .to.be.emit(VotingEscrow, 'Transfer')
            .withArgs(ethers.ZeroAddress, signers.otherUser2, lastMintedTokenId + 1n);

          let blockTimestamp = (await tx.getBlock())?.timestamp;

          await expect(tx)
            .to.be.emit(VotingEscrow, 'Deposit')
            .withArgs(CompoundEmissionExtension, 1, ethers.parseEther('60'), 0, 0, blockTimestamp);
          await expect(tx)
            .to.be.emit(VotingEscrow, 'Deposit')
            .withArgs(CompoundEmissionExtension, 2, ethers.parseEther('40'), 0, 0, blockTimestamp);
          await expect(tx)
            .to.be.emit(VotingEscrow, 'Deposit')
            .withArgs(CompoundEmissionExtension, 11, ethers.parseEther('100'), 0, 0, blockTimestamp);

          await expect(tx)
            .to.be.emit(VotingEscrow, 'Deposit')
            .withArgs(CompoundEmissionExtension, lastMintedTokenId + 1n, ethers.parseEther('100'), () => true, 1, blockTimestamp);

          await expect(tx)
            .to.be.emit(CompoundEmissionExtension, 'CompoundEmissionToTargetLock')
            .withArgs(signers.otherUser1, 1, ethers.parseEther('60'));
          await expect(tx)
            .to.be.emit(CompoundEmissionExtension, 'CompoundEmissionToTargetLock')
            .withArgs(signers.otherUser1, 2, ethers.parseEther('40'));
          await expect(tx)
            .to.be.emit(CompoundEmissionExtension, 'CompoundEmissionToTargetLock')
            .withArgs(signers.otherUser2, 11, ethers.parseEther('100'));

          //the same second claim

          user1Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
          user2Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser2);

          expect(user1Info.toLocksPercentage).to.be.eq(ethers.parseEther('0.5'));
          expect(user1Info.targetLocks).to.be.deep.eq([
            [1, ethers.parseEther('0.6')],
            [2, ethers.parseEther('0.4')],
          ]);

          expect(user1Info.targetLocks).to.be.length(2);
          expect(user1Info.createLockConfig).to.be.deep.eq([false, false, 15724800, 0]);
          expect(user1Info.isCustomConfig).to.be.false;

          expect(user2Info.toLocksPercentage).to.be.eq(ethers.parseEther('1'));
          expect(user2Info.targetLocks).to.be.deep.eq([
            [19, ethers.parseEther('0.5')],
            [11, ethers.parseEther('0.5')],
          ]);
          expect(user2Info.targetLocks).to.be.length(2);
          expect(user2Info.createLockConfig).to.be.deep.eq([true, true, 0, 0]);
          expect(user2Info.isCustomConfig).to.be.true;

          lastMintedTokenId = await VotingEscrow.lastMintedTokenId();

          tx = await CompoundEmissionExtension.compoundEmissionClaimBatch([
            {
              target: signers.otherUser1,
              gauges: [gauge1],
              merkl: {
                proofs: [],
                users: [],
                amounts: [],
                tokens: [],
              },
            },
            {
              target: signers.otherUser2,
              gauges: [gauge1, gauge2],
              merkl: {
                proofs: [],
                users: [],
                amounts: [],
                tokens: [],
              },
            },
          ]);
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(gauge1, signers.otherUser1, ethers.parseEther('100'));
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(gauge1, signers.otherUser2, ethers.parseEther('200'));
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(gauge2, signers.otherUser2, ethers.parseEther('200'));

          expect(await Fenix.balanceOf(signers.otherUser1)).to.be.eq(ethers.parseEther('150'));
          expect(await Fenix.balanceOf(signers.otherUser2)).to.be.eq(0);

          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(signers.otherUser1, Voter, ethers.parseEther('50'));
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(Voter, CompoundEmissionExtension, ethers.parseEther('50'));

          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(signers.otherUser2, Voter, ethers.parseEther('400'));
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(Voter, CompoundEmissionExtension, ethers.parseEther('400'));

          expect((await VotingEscrow.getNftState(1)).locked.amount).to.be.eq(ethers.parseEther('91'));
          expect((await VotingEscrow.getNftState(2)).locked.amount).to.be.eq(ethers.parseEther('61'));

          expect((await VotingEscrow.getNftState(11)).locked.amount).to.be.eq(ethers.parseEther('301'));
          expect((await VotingEscrow.getNftState(19)).locked.amount).to.be.eq(ethers.parseEther('300'));
          expect((await VotingEscrow.getNftState(19)).locked.end).to.be.eq(0);
          expect((await VotingEscrow.getNftState(19)).locked.isPermanentLocked).to.be.true;

          await expect(tx).to.be.not.emit(CompoundEmissionExtension, 'CreateLockFromCompoundEmission');

          await expect(tx).to.be.not.emit(VotingEscrow, 'Transfer');

          blockTimestamp = (await tx.getBlock())?.timestamp;

          await expect(tx)
            .to.be.emit(VotingEscrow, 'Deposit')
            .withArgs(CompoundEmissionExtension, 1, ethers.parseEther('30'), 0, 0, blockTimestamp);
          await expect(tx)
            .to.be.emit(VotingEscrow, 'Deposit')
            .withArgs(CompoundEmissionExtension, 2, ethers.parseEther('20'), 0, 0, blockTimestamp);
          await expect(tx)
            .to.be.emit(VotingEscrow, 'Deposit')
            .withArgs(CompoundEmissionExtension, 11, ethers.parseEther('200'), 0, 0, blockTimestamp);
          await expect(tx)
            .to.be.emit(VotingEscrow, 'Deposit')
            .withArgs(CompoundEmissionExtension, 19, ethers.parseEther('200'), 0, 0, blockTimestamp);
          expect(await VotingEscrow.lastMintedTokenId()).to.be.eq(lastMintedTokenId);

          await expect(tx)
            .to.be.emit(CompoundEmissionExtension, 'CompoundEmissionToTargetLock')
            .withArgs(signers.otherUser1, 1, ethers.parseEther('30'));
          await expect(tx)
            .to.be.emit(CompoundEmissionExtension, 'CompoundEmissionToTargetLock')
            .withArgs(signers.otherUser1, 2, ethers.parseEther('20'));
          await expect(tx)
            .to.be.emit(CompoundEmissionExtension, 'CompoundEmissionToTargetLock')
            .withArgs(signers.otherUser2, 11, ethers.parseEther('200'));
          await expect(tx)
            .to.be.emit(CompoundEmissionExtension, 'CompoundEmissionToTargetLock')
            .withArgs(signers.otherUser2, 19, ethers.parseEther('200'));
        });

        it('duplicates', async () => {
          await CompoundEmissionExtension.connect(signers.otherUser1).setCreateLockConfig({
            lockDuration: 0,
            withPermanentLock: true,
            shouldBoosted: true,
            managedTokenIdForAttach: 0,
          });

          await Fenix.connect(signers.otherUser1).approve(Voter, ethers.MaxUint256);

          await CompoundEmissionExtension.connect(signers.otherUser1).setCompoundEmissionConfig(ethers.parseEther('0.5'), [
            {
              tokenId: 0,
              lockPercentage: ethers.parseEther('0.6'),
            },
            {
              tokenId: 1,
              lockPercentage: ethers.parseEther('0.2'),
            },
            {
              tokenId: 1,
              lockPercentage: ethers.parseEther('0.2'),
            },
          ]);

          expect(await CompoundEmissionExtension.getToLocksPercentage(signers.otherUser1)).to.be.eq(ethers.parseEther('0.5'));

          expect((await VotingEscrow.getNftState(1)).locked.amount).to.be.eq(ethers.parseEther('1'));
          let newMintedId = (await VotingEscrow.lastMintedTokenId()) + 1n;

          let user1Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
          expect(user1Info.toLocksPercentage).to.be.eq(ethers.parseEther('0.5'));
          expect(user1Info.targetLocks).to.be.deep.eq([
            [0, ethers.parseEther('0.6')],
            [1, ethers.parseEther('0.2')],
            [1, ethers.parseEther('0.2')],
          ]);

          expect(user1Info.targetLocks).to.be.length(3);
          expect(user1Info.createLockConfig).to.be.deep.eq([true, true, 0, 0]);
          expect(user1Info.isCustomConfig).to.be.true;

          let tx = await CompoundEmissionExtension.compoundEmissionClaimBatch([
            {
              target: signers.otherUser1,
              gauges: [gauge1, gauge2],
              merkl: {
                proofs: [],
                users: [],
                amounts: [],
                tokens: [],
              },
            },
          ]);
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(gauge1, signers.otherUser1, ethers.parseEther('100'));
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(gauge2, signers.otherUser1, ethers.parseEther('100'));

          expect(await Fenix.balanceOf(signers.otherUser1)).to.be.eq(ethers.parseEther('100'));

          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(signers.otherUser1, Voter, ethers.parseEther('100'));
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(Voter, CompoundEmissionExtension, ethers.parseEther('100'));

          expect((await VotingEscrow.getNftState(1)).locked.amount).to.be.eq(ethers.parseEther('41'));

          expect((await VotingEscrow.getNftState(newMintedId)).locked.amount).to.be.eq(ethers.parseEther('60'));

          expect(await VotingEscrow.ownerOf(newMintedId)).to.be.eq(signers.otherUser1);

          await expect(tx)
            .to.be.emit(CompoundEmissionExtension, 'CreateLockFromCompoundEmission')
            .withArgs(signers.otherUser1, newMintedId, ethers.parseEther('60'));

          await expect(tx).to.be.emit(VotingEscrow, 'Transfer').withArgs(ethers.ZeroAddress, signers.otherUser1, newMintedId);

          let blockTimestamp = (await tx.getBlock())?.timestamp;

          await expect(tx)
            .to.be.emit(VotingEscrow, 'Deposit')
            .withArgs(CompoundEmissionExtension, 1, ethers.parseEther('20'), 0, 0, blockTimestamp);
          await expect(tx)
            .to.be.emit(VotingEscrow, 'Deposit')
            .withArgs(CompoundEmissionExtension, 1, ethers.parseEther('20'), 0, 0, blockTimestamp);

          await expect(tx)
            .to.be.emit(VotingEscrow, 'Deposit')
            .withArgs(CompoundEmissionExtension, newMintedId, ethers.parseEther('60'), () => true, 1, blockTimestamp);

          await expect(tx)
            .to.be.emit(CompoundEmissionExtension, 'CompoundEmissionToTargetLock')
            .withArgs(signers.otherUser1, 1, ethers.parseEther('20'));
          await expect(tx)
            .to.be.emit(CompoundEmissionExtension, 'CompoundEmissionToTargetLock')
            .withArgs(signers.otherUser1, 1, ethers.parseEther('20'));

          user1Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
          expect(user1Info.toLocksPercentage).to.be.eq(ethers.parseEther('0.5'));
          expect(user1Info.targetLocks).to.be.deep.eq([
            [newMintedId, ethers.parseEther('0.6')],
            [1, ethers.parseEther('0.2')],
            [1, ethers.parseEther('0.2')],
          ]);
        });

        it('merge', async () => {
          await CompoundEmissionExtension.connect(signers.otherUser1).setCreateLockConfig({
            lockDuration: 0,
            withPermanentLock: true,
            shouldBoosted: true,
            managedTokenIdForAttach: 0,
          });

          await Fenix.connect(signers.otherUser1).approve(Voter, ethers.MaxUint256);

          await CompoundEmissionExtension.connect(signers.otherUser1).setCompoundEmissionConfig(ethers.parseEther('0.5'), [
            {
              tokenId: 0,
              lockPercentage: ethers.parseEther('0.6'),
            },
            {
              tokenId: 1,
              lockPercentage: ethers.parseEther('0.2'),
            },
            {
              tokenId: 2,
              lockPercentage: ethers.parseEther('0.2'),
            },
          ]);

          expect(await CompoundEmissionExtension.getToLocksPercentage(signers.otherUser1)).to.be.eq(ethers.parseEther('0.5'));

          expect((await VotingEscrow.getNftState(1)).locked.amount).to.be.eq(ethers.parseEther('1'));
          let newMintedId = (await VotingEscrow.lastMintedTokenId()) + 1n;

          let user1Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
          expect(user1Info.toLocksPercentage).to.be.eq(ethers.parseEther('0.5'));
          expect(user1Info.targetLocks).to.be.deep.eq([
            [0, ethers.parseEther('0.6')],
            [1, ethers.parseEther('0.2')],
            [2, ethers.parseEther('0.2')],
          ]);

          expect(user1Info.targetLocks).to.be.length(3);
          expect(user1Info.createLockConfig).to.be.deep.eq([true, true, 0, 0]);
          expect(user1Info.isCustomConfig).to.be.true;

          await VotingEscrow.connect(signers.otherUser1).merge(2, 1);
          user1Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
          expect(user1Info.toLocksPercentage).to.be.eq(ethers.parseEther('0.5'));
          expect(user1Info.targetLocks).to.be.deep.eq([
            [0, ethers.parseEther('0.6')],
            [1, ethers.parseEther('0.2')],
            [1, ethers.parseEther('0.2')],
          ]);
          await VotingEscrow.connect(signers.otherUser1).merge(1, 3);
          user1Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
          expect(user1Info.toLocksPercentage).to.be.eq(ethers.parseEther('0.5'));
          expect(user1Info.targetLocks).to.be.deep.eq([
            [0, ethers.parseEther('0.6')],
            [3, ethers.parseEther('0.2')],
            [3, ethers.parseEther('0.2')],
          ]);
          let tx = await CompoundEmissionExtension.compoundEmissionClaimBatch([
            {
              target: signers.otherUser1,
              gauges: [gauge1, gauge2],
              merkl: {
                proofs: [],
                users: [],
                amounts: [],
                tokens: [],
              },
            },
          ]);
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(gauge1, signers.otherUser1, ethers.parseEther('100'));
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(gauge2, signers.otherUser1, ethers.parseEther('100'));

          expect(await Fenix.balanceOf(signers.otherUser1)).to.be.eq(ethers.parseEther('100'));

          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(signers.otherUser1, Voter, ethers.parseEther('100'));
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(Voter, CompoundEmissionExtension, ethers.parseEther('100'));

          expect((await VotingEscrow.getNftState(3)).locked.amount).to.be.eq(ethers.parseEther('43'));

          expect((await VotingEscrow.getNftState(newMintedId)).locked.amount).to.be.eq(ethers.parseEther('60'));

          expect(await VotingEscrow.ownerOf(newMintedId)).to.be.eq(signers.otherUser1);

          await expect(tx)
            .to.be.emit(CompoundEmissionExtension, 'CreateLockFromCompoundEmission')
            .withArgs(signers.otherUser1, newMintedId, ethers.parseEther('60'));

          await expect(tx).to.be.emit(VotingEscrow, 'Transfer').withArgs(ethers.ZeroAddress, signers.otherUser1, newMintedId);

          let blockTimestamp = (await tx.getBlock())?.timestamp;

          await expect(tx)
            .to.be.emit(VotingEscrow, 'Deposit')
            .withArgs(CompoundEmissionExtension, 3, ethers.parseEther('20'), 0, 0, blockTimestamp);
          await expect(tx)
            .to.be.emit(VotingEscrow, 'Deposit')
            .withArgs(CompoundEmissionExtension, 3, ethers.parseEther('20'), 0, 0, blockTimestamp);

          await expect(tx)
            .to.be.emit(VotingEscrow, 'Deposit')
            .withArgs(CompoundEmissionExtension, newMintedId, ethers.parseEther('60'), () => true, 1, blockTimestamp);

          await expect(tx)
            .to.be.emit(CompoundEmissionExtension, 'CompoundEmissionToTargetLock')
            .withArgs(signers.otherUser1, 3, ethers.parseEther('20'));
          await expect(tx)
            .to.be.emit(CompoundEmissionExtension, 'CompoundEmissionToTargetLock')
            .withArgs(signers.otherUser1, 3, ethers.parseEther('20'));
        });
        it('transfer', async () => {
          await CompoundEmissionExtension.connect(signers.otherUser1).setCreateLockConfig({
            lockDuration: 0,
            withPermanentLock: true,
            shouldBoosted: true,
            managedTokenIdForAttach: 0,
          });

          await Fenix.connect(signers.otherUser1).approve(Voter, ethers.MaxUint256);

          await CompoundEmissionExtension.connect(signers.otherUser1).setCompoundEmissionConfig(ethers.parseEther('0.5'), [
            {
              tokenId: 0,
              lockPercentage: ethers.parseEther('0.6'),
            },
            {
              tokenId: 1,
              lockPercentage: ethers.parseEther('0.2'),
            },
            {
              tokenId: 2,
              lockPercentage: ethers.parseEther('0.2'),
            },
          ]);

          expect(await CompoundEmissionExtension.getToLocksPercentage(signers.otherUser1)).to.be.eq(ethers.parseEther('0.5'));

          expect((await VotingEscrow.getNftState(1)).locked.amount).to.be.eq(ethers.parseEther('1'));
          let newMintedId = (await VotingEscrow.lastMintedTokenId()) + 1n;

          let user1Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
          expect(user1Info.toLocksPercentage).to.be.eq(ethers.parseEther('0.5'));
          expect(user1Info.targetLocks).to.be.deep.eq([
            [0, ethers.parseEther('0.6')],
            [1, ethers.parseEther('0.2')],
            [2, ethers.parseEther('0.2')],
          ]);

          expect(user1Info.targetLocks).to.be.length(3);
          expect(user1Info.createLockConfig).to.be.deep.eq([true, true, 0, 0]);
          expect(user1Info.isCustomConfig).to.be.true;

          await VotingEscrow.connect(signers.otherUser1).transferFrom(signers.otherUser1, signers.otherUser2, 2);
          user1Info = await CompoundEmissionExtension.getUserInfo(signers.otherUser1);
          expect(user1Info.toLocksPercentage).to.be.eq(ethers.parseEther('0.5'));
          expect(user1Info.targetLocks).to.be.deep.eq([
            [0, ethers.parseEther('0.6')],
            [1, ethers.parseEther('0.2')],
            [0, ethers.parseEther('0.2')],
          ]);
          let tx = await CompoundEmissionExtension.compoundEmissionClaimBatch([
            {
              target: signers.otherUser1,
              gauges: [gauge1, gauge2],
              merkl: {
                proofs: [],
                users: [],
                amounts: [],
                tokens: [],
              },
            },
          ]);
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(gauge1, signers.otherUser1, ethers.parseEther('100'));
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(gauge2, signers.otherUser1, ethers.parseEther('100'));

          expect(await Fenix.balanceOf(signers.otherUser1)).to.be.eq(ethers.parseEther('100'));

          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(signers.otherUser1, Voter, ethers.parseEther('100'));
          await expect(tx).to.be.emit(Fenix, 'Transfer').withArgs(Voter, CompoundEmissionExtension, ethers.parseEther('100'));

          expect((await VotingEscrow.getNftState(1)).locked.amount).to.be.eq(ethers.parseEther('21'));

          expect((await VotingEscrow.getNftState(newMintedId)).locked.amount).to.be.eq(ethers.parseEther('60'));
          expect((await VotingEscrow.getNftState(newMintedId + 1n)).locked.amount).to.be.eq(ethers.parseEther('20'));

          expect(await VotingEscrow.ownerOf(newMintedId)).to.be.eq(signers.otherUser1);
          expect(await VotingEscrow.ownerOf(newMintedId + 1n)).to.be.eq(signers.otherUser1);

          await expect(tx)
            .to.be.emit(CompoundEmissionExtension, 'CreateLockFromCompoundEmission')
            .withArgs(signers.otherUser1, newMintedId, ethers.parseEther('60'));

          await expect(tx)
            .to.be.emit(CompoundEmissionExtension, 'CreateLockFromCompoundEmission')
            .withArgs(signers.otherUser1, newMintedId + 1n, ethers.parseEther('20'));

          await expect(tx).to.be.emit(VotingEscrow, 'Transfer').withArgs(ethers.ZeroAddress, signers.otherUser1, newMintedId);
          await expect(tx)
            .to.be.emit(VotingEscrow, 'Transfer')
            .withArgs(ethers.ZeroAddress, signers.otherUser1, newMintedId + 1n);

          let blockTimestamp = (await tx.getBlock())?.timestamp;

          await expect(tx)
            .to.be.emit(VotingEscrow, 'Deposit')
            .withArgs(CompoundEmissionExtension, 1, ethers.parseEther('20'), 0, 0, blockTimestamp);
          await expect(tx)
            .to.be.emit(VotingEscrow, 'Deposit')
            .withArgs(CompoundEmissionExtension, newMintedId + 1n, ethers.parseEther('20'), () => true, 1, blockTimestamp);

          await expect(tx)
            .to.be.emit(VotingEscrow, 'Deposit')
            .withArgs(CompoundEmissionExtension, newMintedId, ethers.parseEther('60'), () => true, 1, blockTimestamp);

          await expect(tx)
            .to.be.emit(CompoundEmissionExtension, 'CompoundEmissionToTargetLock')
            .withArgs(signers.otherUser1, 1, ethers.parseEther('20'));
        });
      });
    });
  });
});
