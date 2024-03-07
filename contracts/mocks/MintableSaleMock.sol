// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../protocol/MintableSale.sol";

/// @dev Allows to override isActive() and now256() on the MintableSale
contract MintableSaleMock is MintableSale {
	/// @dev Defines if isActive() should be overridden
	bool private _activeStateOverride;

	/// @dev Overrides isActive() if `_activeStateOverride` is true
	bool private _activeStateValue;

	/// @dev Overrides now256() if set (non-zero)
	uint256 private _now256;

	/// @dev Deploys MintableSaleMock passing all the params to MintableSale
	constructor(address _tokenContract) MintableSale(_tokenContract) {}

	/// @inheritdoc MintableSale
	function isActive() public view override returns(bool) {
		// override state if required, delegate to super otherwise
		return _activeStateOverride ? _activeStateValue : super.isActive();
	}

	/// @inheritdoc MintableSale
	function now256() public view override returns (uint256) {
		// override now256 if it is set, delegate to super otherwise
		return _now256 > 0? _now256: super.now256();
	}

	/// @dev Sets isActive() override
	function setStateOverride(bool _value) public {
		_activeStateOverride = true;
		_activeStateValue = _value;
	}

	/// @dev Removes isActive() override
	function removeStateOverride() public {
		_activeStateOverride = false;
	}

	/// @dev Sets/removes now256() override (set to zero to remove)
	function setNow256(uint256 _value) public {
		_now256 = _value;
	}

}
