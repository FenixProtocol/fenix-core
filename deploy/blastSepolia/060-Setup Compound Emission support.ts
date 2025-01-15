import { ethers } from 'hardhat';
import {
  AliasDeployedContracts,
  deploy,
  deployNewImplementationAndUpgradeProxy,
  deployProxy,
  getBlastGovernorAddress,
  getDeployedContractsAddressList,
  getProxyAdminAddress,
  logTx,
} from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';

async function main() {
  const [deployer] = await ethers.getSigners();
  const DeployedContracts = await getDeployedContractsAddressList();
  const ProxyAdmin = await getProxyAdminAddress();
  const BlastGovernor = await getBlastGovernorAddress();

  let CompoundEmissionExtensionUpgradeable_Implementation = await deploy({
    deployer: deployer,
    name: InstanceName.CompoundEmissionExtensionUpgradeable,
    constructorArguments: [BlastGovernor],
    verify: true,
    saveAlias: AliasDeployedContracts.CompoundEmissionExtensionUpgradeable_Implementation,
  });

  let Proxy = await deployProxy({
    saveAlias: AliasDeployedContracts.CompoundEmissionExtensionUpgradeable_Proxy,
    admin: await getProxyAdminAddress(),
    logic: CompoundEmissionExtensionUpgradeable_Implementation.target.toString(),
    deployer: deployer,
    verify: true,
  });

  let CompoundEmissionExtensionUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.CompoundEmissionExtensionUpgradeable,
    Proxy.target,
  );

  await logTx(
    CompoundEmissionExtensionUpgradeable_Proxy,
    CompoundEmissionExtensionUpgradeable_Proxy.initialize(
      BlastGovernor,
      DeployedContracts[AliasDeployedContracts.VoterUpgradeable_Proxy],
      DeployedContracts[AliasDeployedContracts.Fenix],
      DeployedContracts[AliasDeployedContracts.VotingEscrowUpgradeable_Proxy],
    ),
  );

  await deployNewImplementationAndUpgradeProxy({
    implementationName: InstanceName.VoterUpgradeable,
    deployer: deployer,
    implementationConstructorArguments: [BlastGovernor],
    implementationSaveAlias: AliasDeployedContracts.VoterUpgradeable_Implementation,
    proxyAddress: DeployedContracts[AliasDeployedContracts.VoterUpgradeable_Proxy],
    proxyAdmin: await getProxyAdminAddress(),
    verify: true,
  });

  await deployNewImplementationAndUpgradeProxy({
    implementationName: InstanceName.VotingEscrowUpgradeable,
    deployer: deployer,
    implementationConstructorArguments: [BlastGovernor],
    implementationSaveAlias: AliasDeployedContracts.VotingEscrowUpgradeable_Implementation,
    proxyAddress: DeployedContracts[AliasDeployedContracts.VotingEscrowUpgradeable_Proxy],
    proxyAdmin: await getProxyAdminAddress(),
    verify: true,
  });

  let Voter = await ethers.getContractAt(InstanceName.VoterUpgradeable, DeployedContracts[AliasDeployedContracts.VoterUpgradeable_Proxy]);

  await logTx(Voter, Voter.updateAddress('compoundEmissionExtension', CompoundEmissionExtensionUpgradeable_Proxy.target));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
