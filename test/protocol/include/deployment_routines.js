// Both Truffle and Hardhat with Truffle make instances of web3 and artifacts available in the global scope

// ACL token features and roles
const {
	FEATURE_ALL,
	ROLE_TOKEN_CREATOR,
	ROLE_MINTER,
} = require("../../include/features_roles");

const { ai_protocol_erc721_deploy } = require("@ai-protocol/ali-nft-contracts/test/include/deployment_routines")

// block utils
const { default_deadline } = require("../../include/block_utils");

/**
 * Deploys AliERC20 token with all the features enabled
 *
 * @param a0 smart contract owner, super admin
 * @param H0 initial token holder address
 * @returns AliERC20 instance
 */
async function ali_erc20_deploy(a0, H0 = a0) {
	// deploy ALI token
	const token = await ali_erc20_deploy_restricted(a0, H0);

	// enable all permissions on the token
	await token.updateFeatures(FEATURE_ALL, { from: a0 });

	// return the reference
	return token;
}

/**
 * Deploys AliERC20 token with no features enabled
 *
 * @param a0 smart contract owner, super admin
 * @param H0 initial token holder address
 * @returns AliERC20 instance
 */
async function ali_erc20_deploy_restricted(a0, H0 = a0) {
	// smart contracts required
	const AliERC20 = artifacts.require("./AliERC20v2");

	// deploy and return the reference to instance
	return await AliERC20.new(H0, { from: a0 });
}


/**
 * Deploys Whitelabel ERC721 token with all the features enabled
 *
 * @param a0 smart contract owner, super admin
 * @param name ERC721 name, optional, default value "Whitelabel NFT"
 * @param symbol ERC721 symbol, optional, default value "WFT"
 * @returns WhitelabelNFT instance
 */
async function whitelabel_erc721_deploy(a0, name, symbol) {
	// deploy the token
	const token = await whitelabel_erc721_deploy_restricted(a0, name, symbol);

	// enable all permissions on the token
	await token.updateFeatures(FEATURE_ALL, { from: a0 });

	// return the reference
	return token;
}

/**
 * Deploys Whitelabel ERC721 token with no features enabled
 *
 * @param a0 smart contract owner, super admin
 * @param name ERC721 name, optional, default value "Whitelabel NFT"
 * @param symbol ERC721 symbol, optional, default value "WFT"
 * @returns WhitelabelNFT instance
 */
async function whitelabel_erc721_deploy_restricted(a0, name = "Whitelabel NFT", symbol = "WFT") {
	// smart contracts required
	const WhitelabelNFT = artifacts.require("./WhitelabelNFT");

	// deploy and return the reference to instance
	return await WhitelabelNFT.new(name, symbol, { from: a0 });
}

/**
 * Deploys Personality Pod ERC721 token with all the features enabled
 *
 * @param a0 smart contract owner, super admin
 * @param name ERC721 name, optional, default value "iNFT Personality Pod"
 * @param symbol ERC721 symbol, optional, default value "POD"
 * @returns PersonalityPodERC721 instance
 */
async function persona_deploy(a0, name, symbol) {
	// deploy the token
	const token = await persona_deploy_restricted(a0, name, symbol);

	// enable all permissions on the token
	await token.updateFeatures(FEATURE_ALL, { from: a0 });

	// return the reference
	return token;
}

/**
 * Deploys Personality Pod ERC721 token with no features enabled
 *
 * @param a0 smart contract owner, super admin
 * @param name ERC721 name, optional, default value "iNFT Personality Pod"
 * @param symbol ERC721 symbol, optional, default value "POD"
 * @returns PersonalityPodERC721 instance
 */
async function persona_deploy_restricted(a0, name = "iNFT Personality Pod", symbol = "POD") {
	// smart contracts required
	const PersonalityPodERC721 = artifacts.require("./PersonalityPodERC721");

	// deploy and return the reference to instance
	return await PersonalityPodERC721.new(name, symbol, { from: a0 });
}

/**
 * Deploys Intelligent NFT v2
 *
 * If ALI ERC20 token instance address is specified – binds iNFT to it, deploys new one otherwise
 *
 * @param a0 smart contract owner, super admin
 * @param ali_addr AliERC20 token address, optional
 * @returns AliERC20 token instance, IntelligentNFTv2 instance
 */
async function intelligent_nft_deploy(a0, ali_addr) {
	// smart contracts required
	const AliERC20 = artifacts.require("./AliERC20v2");
	const IntelligentNFTv2 = artifacts.require("./IntelligentNFTv2");

	// link/deploy the contracts
	const ali = ali_addr ? await AliERC20.at(ali_addr) : await ali_erc20_deploy(a0);
	const iNft = await IntelligentNFTv2.new(ali.address, { from: a0 });

	// return all the linked/deployed instances
	return { ali, iNft };
}


/**
 * Deploys Fixed Supply Sale with all the features enabled, and all the required roles set up
 *
 * If ALI ERC20, target NFT, PersonalityPodERC721, and IntelligentNFTv2 instance addresses are specified,
 * binds sale to them, deploys new instances otherwise
 *
 * @param a0 smart contract owner, super admin
 * @param ali_addr AliERC20 token address, optional
 * @param nft_addr ERC721 token sale is going to mint and bind iNFT to, optional
 * @param persona_addr PersonalityPodERC721 instance address, optional
 * @param iNft_addr IntelligentNFTv2 instance address, optional
 * @returns AliERC20, target NFT, PersonalityPodERC721, IntelligentNFTv2, FixedSupplySale instances
 */
async function sale_deploy(a0, ali_addr, nft_addr, persona_addr, iNft_addr) {
	// deploy infrastructure required with no features and roles set up
	const { ali, nft, persona, iNft, sale } = await sale_deploy_restricted(a0, ali_addr, nft_addr, persona_addr, iNft_addr);

	// features setup
	await sale.updateFeatures(FEATURE_ALL, { from: a0 });

	// permissions setup
	await nft.updateRole(sale.address, ROLE_TOKEN_CREATOR, { from: a0 });
	await persona.updateRole(sale.address, ROLE_TOKEN_CREATOR, { from: a0 });
	await iNft.updateRole(sale.address, ROLE_MINTER, { from: a0 });

	// return all the linked/deployed instances
	return { ali, nft, persona, iNft, sale };
}

// default sale initialization parameters and function to deploy and initialize the sale with these parameters
const SALE_PARAMS = {
	ITEM_PRICE: web3.utils.toWei(new web3.utils.BN(10), "finney"),
	NEXT_ID: 1,
	ITEMS_ON_SALE: 10_000,
	FINAL_ID: 10_000,
	SALE_DURATION: 3600, // sale ends in 1 hour after the start
	BATCH_LIMIT: 0,
	ALI_SOURCE: "0x0000000000000000000000000000000000000000",
	ALI_VALUE: 0,
};

/**
 * Deploys Fixed Supply Sale with all the features enabled, and all the required roles set up,
 * and initializes the sale with the default parameters specified above
 *
 * If ALI ERC20, target NFT, PersonalityPodERC721, and IntelligentNFTv2 instance addresses are specified,
 * binds sale to them, deploys new instances otherwise
 *
 * @param a0 smart contract owner, super admin
 * @param ali_addr AliERC20 token address, optional
 * @param nft_addr ERC721 token sale is going to mint and bind iNFT to, optional
 * @param persona_addr PersonalityPodERC721 instance address, optional
 * @param iNft_addr IntelligentNFTv2 instance address, optional
 * @returns AliERC20, target NFT, PersonalityPodERC721, IntelligentNFTv2, FixedSupplySale instances
 */
async function sale_deploy_initialized(a0, ali_addr, nft_addr, persona_addr, iNft_addr) {
	// deploy infrastructure required
	const { ali, nft, persona, iNft, sale } = await sale_deploy(a0, ali_addr, nft_addr, persona_addr, iNft_addr);

	// initialize the sale with the defaults
	const sale_start = await default_deadline(0);
	const sale_end = sale_start + SALE_PARAMS.SALE_DURATION;
	await sale.initialize(
		SALE_PARAMS.ITEM_PRICE, // _itemPrice
		SALE_PARAMS.NEXT_ID, // _nextId
		SALE_PARAMS.FINAL_ID, // _finalId
		sale_start, // _saleStart
		sale_end, // _saleEnd
		SALE_PARAMS.BATCH_LIMIT, // _batchLimit
		SALE_PARAMS.ALI_SOURCE,
		SALE_PARAMS.ALI_VALUE,
		{ from: a0 }
	);

	// return all the linked/deployed instances
	return { ali, nft, persona, iNft, sale, SALE_START: sale_start, SALE_END: sale_end, ...SALE_PARAMS };
}

/**
 * Deploys Fixed Supply Sale with no features enabled, and no required roles set up
 *
 * If ALI ERC20, target ERC721, PersonalityPodERC721, and IntelligentNFTv2 instance addresses are specified,
 * binds sale to them, deploys new instances otherwise
 *
 * @param a0 smart contract owner, super admin
 * @param ali_addr AliERC20 token address, optional
 * @param nft_addr ERC721 token sale is going to mint and bind iNFT to, optional
 * @param persona_addr PersonalityPodERC721 instance address, optional
 * @param iNft_addr IntelligentNFTv2 instance address, optional
 * @returns AliERC20, target NFT, PersonalityPodERC721, IntelligentNFTv2, FixedSupplySale instances
 */
async function sale_deploy_restricted(a0, ali_addr, nft_addr, persona_addr, iNft_addr) {
	// smart contracts required
	const AliERC20 = artifacts.require("./AliERC20v2");
	const ALINFT = artifacts.require("./ALINFT");
	const PersonalityPodERC721 = artifacts.require("./PersonalityPodERC721");
	const IntelligentNFTv2 = artifacts.require("./IntelligentNFTv2");

	// link/deploy the contracts
	let iNft, ali;
	if (iNft_addr) {
		iNft = await IntelligentNFTv2.at(iNft_addr);
		ali = await AliERC20.at(await iNft.aliContract());
		if (ali_addr && ali_addr.localeCompare(ali.address) !== 0) {
			throw "ALI ERC20 address mismatch";
		}
	}
	else {
		({ iNft, ali } = await intelligent_nft_deploy(a0, ali_addr));
	}
	const nft = nft_addr ? await ALINFT.at(nft_addr) : await ai_protocol_erc721_deploy(a0);
	const persona = persona_addr ? await PersonalityPodERC721.at(persona_addr) : await persona_deploy(a0);
	const sale = await sale_deploy_pure(a0, ali.address, nft.address, persona.address, iNft.address);

	// return all the linked/deployed instances
	return { ali, nft, persona, iNft, sale };
}

/**
 * Deploys Fixed Supply Sale with no features enabled, and no required roles set up
 *
 * Requires a valid AliERC20, target NFT, PersonalityPodERC721, and IntelligentNFTv2 instance addresses to be specified
 *
 * @param a0 smart contract owner, super admin
 * @param ali_addr AliERC20 token address, required
 * @param nft_addr ERC721 token sale is going to mint and bind iNFT to, required
 * @param persona_addr PersonalityPodERC721 instance address, required
 * @param iNft_addr IntelligentNFTv2 instance address, required
 * @returns FixedSupplySale instance
 */
async function sale_deploy_pure(a0, ali_addr, nft_addr, persona_addr, iNft_addr) {
	// smart contracts required
	const FixedSupplySale = artifacts.require("./FixedSupplySaleMock");

	// deploy and return the reference to instance
	return await FixedSupplySale.new(ali_addr, nft_addr, persona_addr, iNft_addr, { from: a0 });
}

/**
 * Deploys Mintable Sale attached to PersonalityPodERC721 with all the features enabled,
 * and all the required roles set up
 *
 * If PersonalityPodERC721 instance addresses is specified,
 * binds sale to it, deploys a new instance otherwise
 *
 * @param a0 smart contract owner, super admin
 * @param persona_addr PersonalityPodERC721 instance address, optional
 * @returns PersonalityPodERC721, MintableSale instances
 */
async function persona_sale_deploy(a0, persona_addr) {
	// deploy infrastructure required with no features and roles set up
	const { persona, sale } = await persona_sale_deploy_restricted(a0, persona_addr)

	// permissions setup
	await persona.updateRole(sale.address, ROLE_TOKEN_CREATOR, { from: a0 });

	// return all the linked/deployed instances
	return { persona, sale };
}

/**
 * Deploys Mintable Sale attached to PersonalityPodERC721 with all the features enabled,
 * and all the required roles set up,
 * and initializes the sale with the default parameters specified above
 *
 * If PersonalityPodERC721 instance addresses is specified,
 * binds sale to it, deploys a new instance otherwise
 *
 * @param a0 smart contract owner, super admin
 * @param persona_addr PersonalityPodERC721 instance address, optional
 * @returns PersonalityPodERC721, MintableSale instances
 */
async function persona_sale_deploy_initialized(a0, persona_addr) {
	// deploy infrastructure required
	const { persona, sale } = await persona_sale_deploy(a0, persona_addr);

	// initialize the sale with the defaults
	const sale_start = await default_deadline(0);
	const sale_end = sale_start + SALE_PARAMS.SALE_DURATION;
	await sale.initialize(
		SALE_PARAMS.ITEM_PRICE, // _itemPrice
		SALE_PARAMS.NEXT_ID, // _nextId
		SALE_PARAMS.FINAL_ID, // _finalId
		sale_start, // _saleStart
		sale_end, // _saleEnd
		SALE_PARAMS.BATCH_LIMIT, // _batchLimit
		{ from: a0 }
	);

	// return all the linked/deployed instances
	return { persona, sale, SALE_START: sale_start, SALE_END: sale_end, ...SALE_PARAMS };
}

/**
 * Deploys Mintable Sale attached to PersonalityPodERC721 with no features enabled,
 * and no required roles set up
 *
 * If PersonalityPodERC721 instance addresses is specified,
 * binds sale to it, deploys a new instance otherwise
 *
 * @param a0 smart contract owner, super admin
 * @param persona_addr PersonalityPodERC721 instance address, optional
 * @returns PersonalityPodERC721, MintableSale instances
 */
async function persona_sale_deploy_restricted(a0, persona_addr) {
	// smart contracts required
	const PersonalityPodERC721 = artifacts.require("./PersonalityPodERC721");

	// link/deploy the contracts
	const persona = persona_addr ? await PersonalityPodERC721.at(persona_addr) : await persona_deploy(a0);
	const sale = await mintable_sale_deploy_pure(a0, persona.address);

	// return all the linked/deployed instances
	return { persona, sale };
}

/**
 * Deploys Mintable Sale with no features enabled, and no required roles set up
 *
 * Requires a valid MintableERC721 instance address to be specified
 *
 * @param a0 smart contract owner, super admin
 * @param token_addr MintableERC721 instance address, required
 * @returns MintableSale instance
 */
async function mintable_sale_deploy_pure(a0, token_addr) {
	// smart contracts required
	const MintableSale = artifacts.require("./MintableSaleMock");

	// deploy and return the reference to instance
	return await MintableSale.new(token_addr, { from: a0 });
}



/**
 * Deploys OpenSeaFactory with no features enabled, and no required roles set up
 *
 * Requires a valid PersonalityPodERC721 and ProxyRegistry instance addresses to be specified
 *
 * @param a0 smart contract owner, super admin
 * @param range_bounds an array defining token ID ranges for each option
 * @param persona_addr PersonalityPodERC721 token OpenSeaFactory is going to mint, required
 * @param proxy_registry_addr OpenSea proxy registry address
 * @returns OpenSeaFactory instance
 */
async function os_factory_deploy_pure(a0, range_bounds, persona_addr, proxy_registry_addr) {
	// smart contracts required
	const OpenSeaFactory = artifacts.require("./OpenSeaFactoryImpl");

	// deploy and return the reference to instance
	return await OpenSeaFactory.new(persona_addr, proxy_registry_addr, range_bounds, { from: a0 });
}

/**
 * Deploys PersonalityDrop with no features enabled, but all the required roles set up
 *
 * If PersonalityPodERC721 instance address is specified, binds the drop to it
 *
 * @param a0 smart contract owner, super admin
 * @param persona_addr PersonalityPodERC721 token Airdrop is going to mint, optional
 * @returns PersonalityDrop, PersonalityPodERC721 instances
 */
async function persona_drop_deploy_restricted(a0, persona_addr) {
	// smart contracts required
	const PersonalityPodERC721 = artifacts.require("./PersonalityPodERC721");

	// link/deploy the contracts
	const persona = persona_addr ? await PersonalityPodERC721.at(persona_addr) : await persona_deploy(a0);
	const airdrop = await nft_drop_deploy_pure(a0, persona.address);

	// grant sale permission to mint tokens
	await persona.updateRole(airdrop.address, ROLE_TOKEN_CREATOR, { from: a0 });

	// return all the linked/deployed instances
	return { persona, airdrop };
}

/**
 * Deploys PersonalityDrop with no features enabled, and no roles set up
 *
 * Requires a valid MintableERC721 instance address to be specified
 *
 * @param a0 smart contract owner, super admin
 * @param nft_addr MintableERC721 token Airdrop is going to mint, required
 * @returns PersonalityDrop instance
 */
async function nft_drop_deploy_pure(a0, nft_addr) {
	// smart contracts required
	const PersonalityDrop = artifacts.require("./ERC721Drop");

	// deploy and return the reference to instance
	return await PersonalityDrop.new(nft_addr, { from: a0 });
}


// export public deployment API
module.exports = {
	ali_erc20_deploy,
	ali_erc20_deploy_restricted,
	whitelabel_erc721_deploy,
	whitelabel_erc721_deploy_restricted,
	persona_deploy,
	persona_deploy_restricted,
	intelligent_nft_deploy,
	sale_deploy,
	SALE_PARAMS,
	sale_deploy_initialized,
	sale_deploy_restricted,
	sale_deploy_pure,
	persona_sale_deploy,
	persona_sale_deploy_initialized,
	persona_sale_deploy_restricted,
	mintable_sale_deploy_pure,
	os_factory_deploy_pure,
	persona_drop_deploy_restricted,
	nft_drop_deploy_pure
};