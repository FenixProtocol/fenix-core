import { ethers } from 'hardhat';
import { AliasDeployedContracts, getDeployedContractsAddressList, logTx } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';

async function main() {
  const DeployedContracts = await getDeployedContractsAddressList();

  const gauges = [
    '0x5472cb9f34FD3E7344159518a7E44b54595195B1',
    '0x413BAc561C0E455C1506703B20AdfBd2AB847119',
    '0x1a59AD96c2ab144018BB422515566F9F1F0FfCC6',
    '0x0D31610FA32f8892174c58879d0c5c13958C93aA',
    '0xaDfbb89F8Ca4Fe9da3022523d48e13f7a9f425D3',
    '0xf09f94c02ec3184a9E430aAC45bF7b28dAdb8372',
    '0x04f7cED1d985c3468Ff6AeeCE28d9D390cF7fce5',
    '0x46c9B535B4bf58e96449C19112D1c8b7895d0b3E',
    '0x785F375b933E2DA179164e8C6c7CA0E92dD86d75',
    '0xD3C7255B81CFaa7541C0297ee8eB16972D9b5257',
    '0xDcf2267E82DDA230eA8c4EE62A2a3eaa0F30fF8f',
    '0xDe8aBF12032d5F65D77Ed3d7Cdd344842b40343b',
    '0x04420f9532422FaDf9439cCad927200005492689',
    '0x26796D55dF4D9e9FaB6fd6d9525cf5D30f4bd88D',
    '0xcbA584d0cFcb2cb4c22E899f1f8A678F5a405Ca2',
    '0xd21EA23BC4a5Bf561bf4c779bAfdF424C530AC44',
    '0x1f0749A9f7179B127b459d4fE1E41f2De9036759',
    '0xF4407F6655FE9E787698a60Fb67E815bc856a6e1',
    '0x27f250288B27520FdA72AfC75a88FBE525d6323e',
    '0xaE3a90C425af52C902F3F7a707197C7E9f5D8F3D',
    '0xE0DA93D91C27370166a7021B694a9A1617Bcf269',
    '0xe78c9c4636fC637Ca80164ce7e99fbA95b269340',
    '0xfE8dc0A4dD63A9653F4a311538BC383a4b4A6f04',
    '0x016A46DaB2b0E89a014514Bf7379Eacbfe2B4752',
    '0x8b431A9CDcff940F06aaea7179205aF6e04eA905',
    '0x9671f8710C058FCA1B85cDe843fD65761F113ad1',
    '0x6B89bD330cb0FC6b572f08541cA822ca2E849205',
    '0xaB0AAf0c7F5A7F294Bee1E865703A62B90729740',
    '0x067F1848da29E0Fe30aFF8F2b9C2bfF5235aDfB5',
    '0x7f7753A5b9f4966E45E717f07C9288cd6A0E6AD9',
    '0x97E7a0a0Ec9cF6DAF7d3791D38De09C5fE86b1CA',
    '0x41e5172c70b8b052F667F0d2a8AEfD3b33f27f94',
    '0x0771BF44a2ADBadd8e62C3F701F4e2634CB593d5',
    '0x3C767e0Cb498E5497648e5bf87a94124814bd5b7',
    '0x0A8a919ce6Ca6B111aC7BF69Cf9ee57952DB15c6',
    '0x0CD50bb325d6f8Fc9399a1831Fb632c9CD01704F',
    '0x18983E3fBbd3D76eA191F5eb3026A109B08F4865',
    '0xD7fa37229215672cfC75F03F44E48fd524dd9277',
    '0xfe0C944355ec6BBA1ab1D5fe798cB449eE18bf4f',
    '0x223efB0C6DF25f9Bb1DDa234863561Cd69C11f46',
    '0xAb333FB261e5CB91C7295Ee713164F595b25fa26',
    '0x7A461380ff21336eE16f1aFAc3825e674aDAF2cc',
    '0x0a87C0f29204258Eb7B130048A60fE040FB98505',
    '0x82CC03E27B4E1268B20935e84AB5ad9b0574e48A',
    '0xEE1be109e3dD8DAF1fFe209fEa39a597bceA507b',
    '0x40121ef394E47ACee206796df884D7078368DfE2',
    '0xd8882D416e71492363f9A8dF5e5F177202088dcA',
    '0xc8e0BB79710EAB107C962Ece49b188C2303ad962',
    '0x41e9490Eb743608F4CcC5FB73eB312E0Cce19eC0',
    '0xE6fDcD283DC058B595d5c9cC28c8aE28b3F35038',
    '0x97AcCecA6a2415D48b703FCB9Af19DfeF8F9c48B',
    '0xB00844C4Ca5bab31bC7C7b41bAB828aC34eFE075',
    '0x2524571D8519ccd199e6Ad52406313337B5892C0',
    '0x0e82dd4570C41c83596d7303e6196De7e9f45B75',
    '0xb935bF556d84E7D21eCd7F0AbAaAb3a2cD1b5272',
    '0xf2ac8831c7111980d0595A7Cf771505DB25C3cC5',
    '0x600581634F01628072d9460FD3fE6637586045b2',
    '0xbfaC653362C13F7803fF57fdDFc923927922CCB8',
    '0xDc425F42B743e3AA267606d792e7Ce9C1Bb1163A',
    '0x330C690bcfFE9B1b7FE98887FeCf5e3E39B50028',
    '0x46B942959d40217c29e73b2212E68cfE18Bd60BE',
    '0xeDc8413F3ed944c845E9C7cbb0A9A2f251d89f12',
    '0x2D63D3A7dA75F62C9635E54696EE6A3d169A197f',
    '0xE50C5E4b7D781788d4fF0373dfC5Cd2d04F40297',
    '0x97C173401B7040DFb0fdC9Be64B4B68eCEe08CcC',
    '0xc00268FFD3F1E631C0cb408fCF90163078987821',
    '0x5238dA4ED2fA5e2950F355B49Bccb10292F41d01',
    '0x192A1e8f4c9BAD3F2344d5D8a5a2eC8184d8Ce9D',
  ];

  let rewarders = [
    '0x4fc99c755371607a50B9a9AfEb29139DCB29b84d',
    '0xdDDd0bE35fcB03f2300ac9066E1499d77036eDC9',
    '0x5d242Bd7e3169d7A7C5270a38700304D8e326313',
    '0xf862840aD7eC5f011763559DBd3135651E15BeF6',
    '0xD805D127a695b176Ee6Dbf3E41482BEeB26e8dE0',
  ];
  let UtilsUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.UtilsUpgradeable,
    DeployedContracts[AliasDeployedContracts.UtilsUpgradeable_Proxy],
  );
  await logTx(UtilsUpgradeable_Proxy, UtilsUpgradeable_Proxy.multiUpgradeCall([...gauges, ...rewarders]));
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
