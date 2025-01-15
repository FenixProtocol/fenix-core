// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract GaugeMock {
    address public token;

    mapping(address => uint256) public mock_reward;

    constructor(address token_) {
        token = token_;
    }

    function mock__setupReward(address target_, uint256 amount_) external {
        mock_reward[target_] = amount_;
    }

    function getReward(address target_) external {
        IERC20(token).transfer(target_, mock_reward[target_]);
    }
}
