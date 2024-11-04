// Sources flattened with hardhat v2.22.6 https://hardhat.org

// SPDX-License-Identifier: MIT

// File @openzeppelin/contracts/utils/Context.sol@v4.9.5

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.4) (utils/Context.sol)
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

pragma solidity ^0.8.0;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}


// File @openzeppelin/contracts/access/Ownable.sol@v4.9.5

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (access/Ownable.sol)

pragma solidity ^0.8.0;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * By default, the owner account will be the one that deploys the contract. This
 * can later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor() {
        _transferOwnership(_msgSender());
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}


// File @openzeppelin/contracts/security/ReentrancyGuard.sol@v4.9.5

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (security/ReentrancyGuard.sol)

pragma solidity ^0.8.0;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be _NOT_ENTERED
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");

        // Any calls to nonReentrant after this point will fail
        _status = _ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == _ENTERED;
    }
}


// File @openzeppelin/contracts/token/ERC20/IERC20.sol@v4.9.5

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (token/ERC20/IERC20.sol)

pragma solidity ^0.8.0;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `from` to `to` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}


// File contracts/a.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.0;



interface ILockingContract {
    function createLockFor(uint _value, uint _lock_duration, address _to,bool boost,bool ispermanentlocked, uint id) external returns (uint);
}
contract veFNXClaimer is Ownable, ReentrancyGuard {
    IERC20 public fnxToken;
    ILockingContract public lockingContract;

    uint256 public constant LOCK_DURATION = 182 * 24 * 60 * 60; // 182 days in seconds
    uint256 public chrRatio;
    uint256 public spchrRatio;
    uint256 public elchrRatio;
    uint256 public vechrRatio;
    uint256 public chrnftRatio;

    mapping(address => uint256) public chrClaimAmount;
    mapping(address => uint256) public spchrClaimAmount;
    mapping(address => uint256) public elchrClaimAmount;
    mapping(address => uint256) public vechrClaimAmount;
    mapping(address => uint256) public chrnftClaimAmount;

    mapping(address => uint256) public chrClaimedAmount;
    mapping(address => uint256) public spchrClaimedAmount;
    mapping(address => uint256) public elchrClaimedAmount;
    mapping(address => uint256) public vechrClaimedAmount;
    mapping(address => uint256) public chrnftClaimedAmount;

    mapping(address => uint256) public chrMigratedAmount;
    mapping(address => uint256) public spchrMigratedAmount;
    mapping(address => uint256) public elchrMigratedAmount;
    mapping(address => uint256) public vechrMigratedAmount;
    mapping(address => uint256) public chrnftMigratedAmount;

    event Claimed(address indexed user, uint256 amount, string tokenType);
    event ClaimAmountSet(address indexed user, uint256 amount, string tokenType);
    event MigratedAmountSet(address indexed user, uint256 amount, string tokenType);
    event RatiosSet(uint256 chrRatio, uint256 spchrRatio, uint256 elchrRatio, uint256 vechrRatio, uint256 chrnftRatio);

    using SafeMath for uint256;

    constructor(address _fnxToken, address _lockingContract) Ownable() {
        fnxToken = IERC20(_fnxToken);
        lockingContract = ILockingContract(_lockingContract);
        chrRatio = 15500;
        spchrRatio = 15500;
        elchrRatio = 15500;
        vechrRatio = 9700;
        chrnftRatio = 1094000;
    }

    function setRatios(uint256 _chrRatio, uint256 _spchrRatio, uint256 _elchrRatio, uint256 _vechrRatio, uint256 _chrnftRatio) external onlyOwner {
        chrRatio = _chrRatio;
        spchrRatio = _spchrRatio;
        elchrRatio = _elchrRatio;
        vechrRatio = _vechrRatio;
        chrnftRatio = _chrnftRatio;

        emit RatiosSet(chrRatio, spchrRatio, elchrRatio, vechrRatio, chrnftRatio);
    }

    function claimWithCHR() external nonReentrant {
        uint256 claimAmount = chrClaimAmount[msg.sender];
        require(claimAmount > 0, "No claimable amount");

        fnxToken.approve(address(lockingContract), claimAmount);
        lockingContract.createLockFor(claimAmount, LOCK_DURATION, msg.sender,false,true,0);

        chrClaimedAmount[msg.sender] += claimAmount;
        updateClaimAmount(msg.sender, "CHR");
    }

    function claimWithSPCHR() external nonReentrant {
        uint256 claimAmount = spchrClaimAmount[msg.sender];
        require(claimAmount > 0, "No claimable amount");
        
        fnxToken.approve(address(lockingContract), claimAmount);
        lockingContract.createLockFor(claimAmount, LOCK_DURATION, msg.sender,false,true,0);

        spchrClaimedAmount[msg.sender] += claimAmount;
        updateClaimAmount(msg.sender, "SPCHR");
    }

    function claimWithELCHR() external nonReentrant {
        uint256 claimAmount = elchrClaimAmount[msg.sender];
        require(claimAmount > 0, "No claimable amount");

        fnxToken.approve(address(lockingContract), claimAmount);
        lockingContract.createLockFor(claimAmount, LOCK_DURATION, msg.sender,false,true,0);

        elchrClaimedAmount[msg.sender] += claimAmount;
        updateClaimAmount(msg.sender, "ELCHR");
    }

    function claimWithVECHR() external nonReentrant {
        uint256 claimAmount = vechrClaimAmount[msg.sender];
        require(claimAmount > 0, "No claimable amount");

        fnxToken.approve(address(lockingContract), claimAmount);
        lockingContract.createLockFor(claimAmount, LOCK_DURATION, msg.sender,false,true,0);

        vechrClaimedAmount[msg.sender] += claimAmount;
        updateClaimAmount(msg.sender, "VECHR");
    }

    function claimWithCHRNFT() external nonReentrant {
        uint256 claimAmount = chrnftClaimAmount[msg.sender];
        require(claimAmount > 0, "No claimable amount");

        fnxToken.approve(address(lockingContract), claimAmount);
        lockingContract.createLockFor(claimAmount, LOCK_DURATION, msg.sender,false,true,0);

        chrnftClaimedAmount[msg.sender] += claimAmount;
        updateClaimAmount(msg.sender, "CHRNFT");
    }

    function updateClaimAmount(address user, string memory tokenType) internal {
        if (keccak256(abi.encodePacked(tokenType)) == keccak256("CHR")) {
            emit Claimed(user, chrClaimAmount[user], "CHR");
            chrClaimAmount[user] = 0;
        } else if (keccak256(abi.encodePacked(tokenType)) == keccak256("SPCHR")) {
            emit Claimed(user, spchrClaimAmount[user], "SPCHR");
            spchrClaimAmount[user] = 0;
        } else if (keccak256(abi.encodePacked(tokenType)) == keccak256("ELCHR")) {
            emit Claimed(user, elchrClaimAmount[user], "ELCHR");
            elchrClaimAmount[user] = 0;
        } else if (keccak256(abi.encodePacked(tokenType)) == keccak256("VECHR")) {
            emit Claimed(user, vechrClaimAmount[user], "VECHR");
            vechrClaimAmount[user] = 0;
        } else if (keccak256(abi.encodePacked(tokenType)) == keccak256("CHRNFT")) {
            emit Claimed(user, chrnftClaimAmount[user], "CHRNFT");
            chrnftClaimAmount[user] = 0;
        }
    }

    function setUserClaimAmounts(address[] memory users, uint256[] memory migratedAmounts, string memory tokenType) external onlyOwner {
        require(users.length == migratedAmounts.length, "Users and migrated amounts arrays must be the same length");

        bytes32 tokenTypeHash = keccak256(abi.encodePacked(tokenType));

        require(
            tokenTypeHash == keccak256("CHR") ||
            tokenTypeHash == keccak256("SPCHR") ||
            tokenTypeHash == keccak256("ELCHR") ||
            tokenTypeHash == keccak256("VECHR") ||
            tokenTypeHash == keccak256("CHRNFT"),
            "Invalid token type"
        );

        uint256 ratio;
        if (tokenTypeHash == keccak256("CHRNFT")) {
            ratio = chrnftRatio;
        } else if (tokenTypeHash == keccak256("CHR")) {
            ratio = chrRatio;
        } else if (tokenTypeHash == keccak256("SPCHR")) {
            ratio = spchrRatio;
        } else if (tokenTypeHash == keccak256("ELCHR")) {
            ratio = elchrRatio;
        } else if (tokenTypeHash == keccak256("VECHR")) {
            ratio = vechrRatio;
        }

        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            uint256 migratedAmount = migratedAmounts[i];
            uint256 amount;
            if( tokenTypeHash == keccak256("CHR") ||
            tokenTypeHash == keccak256("SPCHR") ||
            tokenTypeHash == keccak256("ELCHR") ||
            tokenTypeHash == keccak256("VECHR")){
             amount = migratedAmount.mul(1000).div(ratio);
            }
            else{
                 amount = migratedAmount.mul(ratio).mul(1e18).div(1000);
            }
            

            if (tokenTypeHash == keccak256("CHR")) {
                chrClaimAmount[user] = amount;
                chrMigratedAmount[user] = migratedAmount;
            } else if (tokenTypeHash == keccak256("SPCHR")) {
                spchrClaimAmount[user] = amount;
                spchrMigratedAmount[user] = migratedAmount;
            } else if (tokenTypeHash == keccak256("ELCHR")) {
                elchrClaimAmount[user] = amount;
                elchrMigratedAmount[user] = migratedAmount;
            } else if (tokenTypeHash == keccak256("VECHR")) {
                vechrClaimAmount[user] = amount;
                vechrMigratedAmount[user] = migratedAmount;
            } else if (tokenTypeHash == keccak256("CHRNFT")) {
                chrnftClaimAmount[user] = amount;
                chrnftMigratedAmount[user] = migratedAmount;
            }

            emit ClaimAmountSet(user, amount, tokenType);
            emit MigratedAmountSet(user, migratedAmount, tokenType);
        }
    }

    function retrieveExcessFNX(uint256 amount) external onlyOwner {
        uint256 balance = fnxToken.balanceOf(address(this));
        require(amount <= balance, "Amount exceeds balance");
        fnxToken.transfer(msg.sender, amount);
    }
}