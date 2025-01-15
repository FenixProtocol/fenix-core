// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract VoterMock {
    mapping(address => bool) public isGauge;
    mapping(address => address) public poolForGauge;
    address public token;

    function setGauge(address gauge_, address pool_) external {
        isGauge[gauge_] = true;
        poolForGauge[gauge_] = pool_;
    }

    function setToken(address token_) external {
        token = token_;
    }

    function notifyRewardAmount(uint256 amount_) external {
        ERC20(token).transferFrom(msg.sender, address(this), amount_);
    }

    event OnAfterTokenTransfer(address caller_, address from_, address to_, uint256 tokenId_);
    event OnAfterTokenMerge(address caller_, uint256 fromTokenId_, uint256 toTokenId_);

    function onAfterTokenTransfer(address from_, address to_, uint256 tokenId_) external {
        emit OnAfterTokenTransfer(msg.sender, from_, to_, tokenId_);
    }

    function onAfterTokenMerge(uint256 fromTokenId_, uint256 toTokenId_) external {
        emit OnAfterTokenMerge(msg.sender, fromTokenId_, toTokenId_);
    }
}
