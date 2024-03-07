// AI Protocol MintableSale attached to PersonalityPodERC721: Cascade Sale Tests

// Zeppelin test helpers
const {
	BN,
	balance,
	constants,
	expectEvent,
	expectRevert,
} = require("@openzeppelin/test-helpers");
const {
	ZERO_ADDRESS,
	ZERO_BYTES32,
	MAX_UINT256,
} = constants;

// Chai test helpers
const {expect} = require("chai");

// web3 utils
const toWei = web3.utils.toWei;

// block utils
const {
	default_deadline,
	extract_gas,
} = require("../include/block_utils");

// deployment routines in use
const {
	SALE_PARAMS,
	persona_sale_deploy,
} = require("./include/deployment_routines");

// run sale tests
contract("MintableSale(PersonalityPodERC721): Cascade Sale Tests", function(accounts) {
	// extract accounts to be used:
	// A0 – special default zero account accounts[0] used by Truffle, reserved
	// a0 – deployment account having all the permissions, reserved
	// H0 – initial token holder account
	// a1, a2,... – working accounts to perform tests on
	const [A0, a0, H0, a1, a2, a3, a4, a5] = accounts;

	// deploy the sale
	let persona, sale;
	before(async function() {
		({persona, sale} = await persona_sale_deploy(a0));
	});

	const cascades = 10;
	const n = 10; // how many items are bought in one cascade
	const buyer = a1;
	for(let i = 0; i < cascades; i++) {
		describe(`Cascade ${i}/${cascades}`, function() {
			const item_price = SALE_PARAMS.ITEM_PRICE;
			before(async function() {
				const next_id = i * n + 1;
				const final_id = (i + 1) * n;
				const sale_start = await default_deadline(0);
				const sale_end = sale_start + SALE_PARAMS.SALE_DURATION;
				const batch_size = 0;
				await sale.initialize(item_price, next_id, final_id, sale_start, sale_end, batch_size, {from: a0});
			});
			it(`soldCounter increases by ${n}: ${n * (i + 1)}`, async function() {
				await sale.buy(n, {from: buyer, value: item_price.muln(n)});
				expect(await sale.soldCounter()).to.be.bignumber.that.equals(n * (i + 1) + "");
			});
		});
	}
});
