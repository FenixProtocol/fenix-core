import {
  AliasDeployedContracts,
  deploy,
  deployProxy,
  getBlastGovernorAddress,
  getDeployedContractsAddressList,
  getProxyAdminAddress,
  logTx,
} from '../../utils/Deploy';
import { ethers } from 'hardhat';
import { InstanceName } from '../../utils/Names';

async function main() {
  const [deployer] = await ethers.getSigners();
  const BlastGovernor = await getBlastGovernorAddress();
  const DeployedContracts = await getDeployedContractsAddressList();
  const TARGET_OWNER_ADDRESS = '0x0907fb24626a06e383bd289a0e9c8560b8ccc4b5';

  let BribeVeFNXRewardToken_Implementation = await deploy({
    deployer: deployer,
    name: InstanceName.BribeVeFNXRewardToken,
    constructorArguments: [BlastGovernor],
    saveAlias: AliasDeployedContracts.BribeVeFNXRewardToken_Implementation,
    verify: true,
  });

  let BribeVeFNXRewardToken_Proxy = await deployProxy({
    saveAlias: AliasDeployedContracts.BribeVeFNXRewardToken_Proxy,
    admin: await getProxyAdminAddress(),
    logic: BribeVeFNXRewardToken_Implementation.target.toString(),
    deployer: deployer,
    verify: true,
  });

  let BribeVeFNXRewardToken = await ethers.getContractAt(InstanceName.BribeVeFNXRewardToken, BribeVeFNXRewardToken_Proxy.target);
  await logTx(
    BribeVeFNXRewardToken,
    BribeVeFNXRewardToken.initialize(BlastGovernor, DeployedContracts[AliasDeployedContracts.VotingEscrowUpgradeable_Proxy]),
  );

  let CustomBribeRewardRouter_Implementation = await deploy({
    deployer: deployer,
    name: InstanceName.CustomBribeRewardRouter,
    constructorArguments: [BlastGovernor],
    saveAlias: AliasDeployedContracts.CustomBribeRewardRouter_Implementation,
    verify: true,
  });

  let CustomBribeRewardRouter_Proxy = await deployProxy({
    saveAlias: AliasDeployedContracts.CustomBribeRewardRouter_Proxy,
    admin: await getProxyAdminAddress(),
    logic: CustomBribeRewardRouter_Implementation.target.toString(),
    deployer: deployer,
    verify: true,
  });

  let CustomBribeRewardRouter = await ethers.getContractAt(InstanceName.CustomBribeRewardRouter, CustomBribeRewardRouter_Proxy.target);
  await logTx(
    CustomBribeRewardRouter,
    CustomBribeRewardRouter.initialize(
      BlastGovernor,
      DeployedContracts[AliasDeployedContracts.VoterUpgradeable_Proxy],
      BribeVeFNXRewardToken.target,
    ),
  );

  await logTx(
    BribeVeFNXRewardToken,
    BribeVeFNXRewardToken.grantRole(await BribeVeFNXRewardToken.MINTER_ROLE(), CustomBribeRewardRouter.target),
  );

  await logTx(
    CustomBribeRewardRouter,
    CustomBribeRewardRouter.setupFuncEnable(CustomBribeRewardRouter.notifyRewardFNXInVeFNX.fragment.selector, true),
  );

  await logTx(
    CustomBribeRewardRouter,
    CustomBribeRewardRouter.setupFuncEnable(CustomBribeRewardRouter.notifyRewardVeFNXInVeFnx.fragment.selector, true),
  );

  await logTx(
    BribeVeFNXRewardToken,
    BribeVeFNXRewardToken.grantRole(await BribeVeFNXRewardToken.DEFAULT_ADMIN_ROLE(), TARGET_OWNER_ADDRESS),
  );

  await logTx(
    CustomBribeRewardRouter,
    CustomBribeRewardRouter.grantRole(await CustomBribeRewardRouter.DEFAULT_ADMIN_ROLE(), TARGET_OWNER_ADDRESS),
  );

  await logTx(BribeVeFNXRewardToken, BribeVeFNXRewardToken.revokeRole(await BribeVeFNXRewardToken.DEFAULT_ADMIN_ROLE(), deployer));

  await logTx(CustomBribeRewardRouter, CustomBribeRewardRouter.revokeRole(await CustomBribeRewardRouter.DEFAULT_ADMIN_ROLE(), deployer));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
