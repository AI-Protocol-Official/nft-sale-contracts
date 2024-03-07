// AI Protocol FixedSupplySale: Sale Tests

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
const { expect } = require("chai");

// web3 utils
const toWei = web3.utils.toWei;

// number utils
const {
	random_int,
	random_element,
} = require("../include/number_utils");

// BN utils
const { random_bn } = require("../include/bn_utils");

// block utils
const {
	default_deadline,
	extract_gas_cost,
} = require("../include/block_utils");

// ACL features and roles
const {
	not,
	FEATURE_PUBLIC_SALE,
	ROLE_SALE_MANAGER,
	ROLE_WITHDRAWAL_MANAGER,
	ROLE_BUYER,
} = require("../include/features_roles");

// ALI ERC20 tokens constants
const { TOTAL_SUPPLY: S0 } = require("../ali_token/include/ali_erc20_constants");

// deployment routines in use
const {
	ali_erc20_deploy_restricted,
	persona_deploy_restricted,
	intelligent_nft_deploy,
	SALE_PARAMS,
	sale_deploy,
	sale_deploy_initialized,
	sale_deploy_restricted,
	sale_deploy_pure,
} = require("./include/deployment_routines");

const { ai_protocol_erc721_deploy_restricted } = require("@ai-protocol/ali-nft-contracts/test/include/deployment_routines")

// run sale tests
contract("FixedSupplySale: Sale Tests", function (accounts) {
	// extract accounts to be used:
	// A0 – special default zero account accounts[0] used by Truffle, reserved
	// a0 – deployment account having all the permissions, reserved
	// H0 – initial token holder account
	// a1, a2,... – working accounts to perform tests on
	const [A0, a0, H0, a1, a2, a3, a4, a5] = accounts;

	describe("FixedSupplySale deployment", function () {
		let ali, nft, persona, iNft;
		let ali_addr, nft_addr, persona_addr, iNft_addr;
		beforeEach(async function () {
			nft = await ai_protocol_erc721_deploy_restricted(a0);
			persona = await persona_deploy_restricted(a0);
			({ ali, iNft } = await intelligent_nft_deploy(a0));

			ali_addr = ali.address;
			nft_addr = nft.address;
			persona_addr = persona.address;
			iNft_addr = iNft.address;
		});
		it("fails if ALI Token address is not set", async function () {
			ali_addr = ZERO_ADDRESS; // unset the address
			await expectRevert(
				sale_deploy_pure(a0, ali_addr, nft_addr, persona_addr, iNft_addr),
				"ALI Token contract is not set"
			);
		});
		it("fails if NFT address is not set", async function () {
			nft_addr = ZERO_ADDRESS; // unset the address
			await expectRevert(
				sale_deploy_pure(a0, ali_addr, nft_addr, persona_addr, iNft_addr),
				"NFT contract is not set"
			);
		});
		it("fails if AI Personality address is not set", async function () {
			persona_addr = ZERO_ADDRESS; // unset the address
			await expectRevert(
				sale_deploy_pure(a0, ali_addr, nft_addr, persona_addr, iNft_addr),
				"AI Personality contract is not set"
			);
		});
		it("fails if iNFT address is not set", async function () {
			iNft_addr = ZERO_ADDRESS; // unset the address
			await expectRevert(
				sale_deploy_pure(a0, ali_addr, nft_addr, persona_addr, iNft_addr),
				"iNFT contract is not set"
			);
		});
		it("fails if ALI Token is not valid ERC20", async function () {
			ali_addr = nft_addr; // mess up the address
			await expectRevert(
				sale_deploy_pure(a0, ali_addr, nft_addr, persona_addr, iNft_addr),
				"unexpected ALI Token type"
			);
		});
		it("fails if NFT is not valid ERC721", async function () {
			nft_addr = iNft_addr; // mess up the address
			await expectRevert(
				sale_deploy_pure(a0, ali_addr, nft_addr, persona_addr, iNft_addr),
				"unexpected NFT type"
			);
		});
		it("fails if AI Personality is not valid ERC721", async function () {
			persona_addr = iNft_addr; // mess up the address
			await expectRevert(
				sale_deploy_pure(a0, ali_addr, nft_addr, persona_addr, iNft_addr),
				"unexpected AI Personality type"
			);
		});
		it("fails if iNFT is not valid iNFT (IntelligentNFTv2Spec)", async function () {
			iNft_addr = nft_addr; // mess up the address
			await expectRevert(
				sale_deploy_pure(a0, ali_addr, nft_addr, persona_addr, iNft_addr),
				"unexpected iNFT type"
			);
		});
		describe("succeeds with valid ALI Token, NFT, AI Personality, and iNFT", function () {
			let sale;
			beforeEach(async function () {
				sale = await sale_deploy_pure(a0, ali_addr, nft_addr, persona_addr, iNft_addr);
			});
			it("ALI Token address is set as expected", async function () {
				expect(await sale.aliContract()).to.be.equal(ali_addr);
			});
			it("NFT address is set as expected", async function () {
				expect(await sale.nftContract()).to.be.equal(nft_addr);
			});
			it("AI Personality address is set as expected", async function () {
				expect(await sale.personalityContract()).to.be.equal(persona_addr);
			});
			it("iNFT address is set as expected", async function () {
				expect(await sale.iNftContract()).to.be.equal(iNft_addr);
			});
			it("soldCounter is zero", async function () {
				expect(await sale.soldCounter()).to.be.bignumber.that.equals("0");
			});
		});
	});
	describe("after FixedSupplySale is deployed", function () {
		let sale;
		beforeEach(async function () {
			({ sale } = await sale_deploy_restricted(a0));
		});

		describe("FixedSupplySale initialization", function () {
			const sale_manager = a3;
			const item_price = random_int(10_000_000, 100_000_000);
			const next_id = random_int(1, 10_000);
			const items_on_sale = random_int(5_000, 10_000);
			const final_id = next_id + items_on_sale - 1;
			const batch_limit = random_int(2, 16);
			const sale_start = random_int(100_000_000, 1_000_000_000);
			const sale_end = random_int(100_000_000, 1_000_000_000);
			const ali_source = random_element(accounts);
			const ali_value = random_bn(toWei("1", "ether"), toWei("1000000", "ether"));
			const sale_init = async (
				_next_id = next_id,
				_ali_source = ali_source,
				_ali_value = ali_value
			) => await sale.initialize(
				item_price, // _itemPrice
				_next_id, // _nextId
				final_id, // _finalId
				sale_start, // _saleStart
				sale_end, // _saleEnd
				batch_limit, // _batchLimit
				_ali_source, // _aliSource
				_ali_value, // _aliValue
				{ from: sale_manager },
			);
			describe("when executed by an account with no ROLE_SALE_MANAGER permission", function () {
				beforeEach(async function () {
					await sale.updateRole(sale_manager, not(ROLE_SALE_MANAGER), { from: a0 });
				});
				it("fails (reverts)", async function () {
					await expectRevert(sale_init(), "access denied");
				});
			});
			describe("when executed by an account with ROLE_SALE_MANAGER permission", function () {
				beforeEach(async function () {
					await sale.updateRole(sale_manager, ROLE_SALE_MANAGER, { from: a0 });
				});
				it("fails if nextId is zero", async function () {
					await expectRevert(sale_init(0), "zero nextId");
				});
				it("fails if aliSource is set, but aliValue is not", async function () {
					await expectRevert(sale_init(next_id, ali_source, 0), "invalid ALI source/value");
				});
				it("fails if aliSource is set, but aliValue is low", async function () {
					await expectRevert(sale_init(next_id, ali_source, 1e12 - 1), "invalid ALI source/value");
				});
				it("fails if aliSource is not set, but aliValue is set", async function () {
					await expectRevert(sale_init(next_id, ZERO_ADDRESS, ali_value), "invalid ALI source/value");
				});
				function succeeds(_next_id = next_id, _ali_source = ali_source, _ali_value = ali_value) {
					_ali_value = new BN(_ali_value);
					let receipt;
					beforeEach(async function () {
						receipt = await sale_init(_next_id, _ali_source, _ali_value);
					});
					it("itemPrice is set as expected", async function () {
						expect(await sale.itemPrice()).to.be.bignumber.that.equals(item_price + "");
					});
					it("nextId is set as expected", async function () {
						expect(await sale.nextId()).to.be.bignumber.that.equals(_next_id + "");
					});
					it("finalId is set as expected", async function () {
						expect(await sale.finalId()).to.be.bignumber.that.equals(final_id + "");
					});
					it("saleStart is set as expected", async function () {
						expect(await sale.saleStart()).to.be.bignumber.that.equals(sale_start + "");
					});
					it("saleEnd is set as expected", async function () {
						expect(await sale.saleEnd()).to.be.bignumber.that.equals(sale_end + "");
					});
					it("batchLimit is set as expected", async function () {
						expect(await sale.batchLimit()).to.be.bignumber.that.equals(batch_limit + "");
					});
					it("aliSource is set as expected", async function () {
						expect(await sale.aliSource()).to.equal(_ali_source);
					});
					it("aliValue is set as expected", async function () {
						expect(await sale.aliValue()).to.be.bignumber.that.equals(_ali_value);
					});
					it("itemsOnSale is as expected", async function () {
						expect(await sale.itemsOnSale()).to.be.bignumber.that.equals(items_on_sale + "");
					});
					it("itemsAvailable is zero (sale is inactive)", async function () {
						expect(await sale.itemsAvailable()).to.be.bignumber.that.equals("0");
					});
					it("soldCounter remains zero", async function () {
						expect(await sale.soldCounter()).to.be.bignumber.that.equals("0");
					});
					it('"Initialized" event is emitted', async function () {
						await expectEvent(receipt, "Initialized", {
							_by: sale_manager,
							_itemPrice: new BN(item_price),
							_nextId: new BN(_next_id),
							_finalId: new BN(final_id),
							_saleStart: new BN(sale_start),
							_saleEnd: new BN(sale_end),
							_batchLimit: new BN(batch_limit),
							_aliSource: _ali_source,
							_aliValue: _ali_value,
						});
					});
				}
				describe("succeeds if nextId is valid and ALI source/value are set", function () {
					succeeds();
				});
				describe("succeeds if nextId is valid and ALI source/value are not set", function () {
					succeeds(next_id, ZERO_ADDRESS, 0);
				});
			});
		});
		describe("FixedSupplySale partial initialization", function () {
			const sale_init = async (
				item_price = (new BN(2).pow(new BN(64))).subn(1), // 0xFFFFFFFFFFFFFFFF
				next_id = 0xFFFF_FFFF,
				final_id = 0xFFFF_FFFF,
				sale_start = 0xFFFF_FFFF,
				sale_end = 0xFFFF_FFFF,
				batch_limit = 0xFFFF_FFFF,
				ali_source = "0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF",
				ali_value = (new BN(2).pow(new BN(96))).subn(1), // 0xFFFFFFFFFFFFFFFFFFFFFFFF
			) => await sale.initialize(
				item_price, // _itemPrice
				next_id, // _nextId
				final_id, // _finalId
				sale_start, // _saleStart
				sale_end, // _saleEnd
				batch_limit, // _batchLimit
				ali_source, // _aliSource
				ali_value, // _aliValue
				{ from: a0 },
			);
			// define 2 different sets of params
			const item_price1 = toWei(new BN(1), "ether");
			const item_price2 = item_price1.addn(20_000_000);
			const next_id1 = new BN(1_000_000);
			const next_id2 = next_id1.addn(100_000);
			const final_id1 = new BN(10_000_000);
			const final_id2 = next_id1.addn(1_000_000);
			const sale_start1 = new BN(1629018000); // August 15, 2021 09:00 UTC
			const sale_start2 = sale_start1.addn(18_000);
			const sale_end1 = new BN(2147483647); // January 19, 2038, 3:14:07 UTC
			const sale_end2 = sale_end1.addn(18_000);
			const batch_limit1 = new BN(10);
			const batch_limit2 = batch_limit1.addn(5);
			const ali_source1 = H0;
			const ali_source2 = a2;
			const ali_value1 = toWei(new BN(1_000), "ether");
			const ali_value2 = ali_value1.addn(30_000_000);

			// init with the initial params we will check against
			beforeEach(async function () {
				await sale_init(item_price1, next_id1, final_id1, sale_start1, sale_end1, batch_limit1, ali_source1, ali_value1);
			});
			it(`when itemPrice is "unset" (0xFFFFFFFFFFFFFFFF) it remains unchanged`, async function () {
				await sale_init(undefined, next_id2, final_id2, sale_start2, sale_end2, batch_limit2, ali_source2, ali_value2);
				expect(await sale.itemPrice()).to.be.bignumber.that.equals(item_price1);
				expect(await sale.nextId(), "nextId didn't change").to.be.bignumber.that.equals(next_id2);
			});
			it(`when nextId is "unset" (0xFFFFFFFF) it remains unchanged`, async function () {
				await sale_init(item_price2, undefined, final_id2, sale_start2, sale_end2, batch_limit2, ali_source2, ali_value2);
				expect(await sale.nextId()).to.be.bignumber.that.equals(next_id1);
				expect(await sale.finalId(), "finalId didn't change").to.be.bignumber.that.equals(final_id2);
			});
			it(`when finalId is "unset" (0xFFFFFFFF) it remains unchanged`, async function () {
				await sale_init(item_price2, next_id2, undefined, sale_start2, sale_end2, batch_limit2, ali_source2, ali_value2);
				expect(await sale.finalId()).to.be.bignumber.that.equals(final_id1);
				expect(await sale.saleStart(), "saleStart didn't change").to.be.bignumber.that.equals(sale_start2);
			});
			it(`when saleStart is "unset" (0xFFFFFFFF) it remains unchanged`, async function () {
				await sale_init(item_price2, next_id2, final_id2, undefined, sale_end2, batch_limit2, ali_source2, ali_value2);
				expect(await sale.saleStart()).to.be.bignumber.that.equals(sale_start1);
				expect(await sale.saleEnd(), "saleEnd didn't change").to.be.bignumber.that.equals(sale_end2);
			});
			it(`when saleEnd is "unset" (0xFFFFFFFF) it remains unchanged`, async function () {
				await sale_init(item_price2, next_id2, final_id2, sale_start2, undefined, batch_limit2, ali_source2, ali_value2);
				expect(await sale.saleEnd()).to.be.bignumber.that.equals(sale_end1);
				expect(await sale.batchLimit(), "batchLimit didn't change").to.be.bignumber.that.equals(batch_limit2);
			});
			it(`when batchLimit is "unset" (0xFFFFFFFF) it remains unchanged`, async function () {
				await sale_init(item_price2, next_id2, final_id2, sale_start2, sale_end2, undefined, ali_source2, ali_value2);
				expect(await sale.batchLimit()).to.be.bignumber.that.equals(batch_limit1);
				expect(await sale.aliSource(), "aliSource did't change").to.equal(ali_source2);
			});
			it(`when aliSource and aliValue are "unset" (0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF and 0xFFFFFFFFFFFFFFFFFFFFFFFF) they remain unchanged`, async function () {
				await sale_init(item_price2, next_id2, final_id2, sale_start2, sale_end2, batch_limit2, undefined, undefined);
				expect(await sale.aliSource(), "aliSource changed").to.equal(ali_source1);
				expect(await sale.aliValue(), "aliValue changed").to.be.bignumber.that.equals(ali_value1);
				expect(await sale.itemPrice(), "itemPrice didn't change").to.be.bignumber.that.equals(item_price2);
			});
		});
		describe("FixedSupplySale state", function () {
			it("is inactive if itemPrice is zero", async function () {
				const sale_start = await default_deadline(0);
				const sale_end = sale_start + 60;
				await sale.initialize(
					0, // _itemPrice
					SALE_PARAMS.NEXT_ID, // _nextId
					SALE_PARAMS.FINAL_ID, // _finalId
					sale_start, // _saleStart
					sale_end, // _saleEnd
					SALE_PARAMS.BATCH_LIMIT, // _batchLimit
					SALE_PARAMS.ALI_SOURCE, // _aliSource
					SALE_PARAMS.ALI_VALUE, // _aliValue
					{ from: a0 },
				);
				expect(await sale.isActive()).to.be.false;
			});
			it("is inactive if nextId is bigger than finalId", async function () {
				const sale_start = await default_deadline(0);
				const sale_end = sale_start + 60;
				await sale.initialize(
					SALE_PARAMS.ITEM_PRICE, // _itemPrice
					SALE_PARAMS.FINAL_ID + 1, // _nextId
					SALE_PARAMS.FINAL_ID, // _finalId
					sale_start, // _saleStart
					sale_end, // _saleEnd
					SALE_PARAMS.BATCH_LIMIT, // _batchLimit
					SALE_PARAMS.ALI_SOURCE, // _aliSource
					SALE_PARAMS.ALI_VALUE, // _aliValue
					{ from: a0 },
				);
				expect(await sale.isActive()).to.be.false;
			});
			it("is inactive if saleStart is in the future", async function () {
				const sale_start = await default_deadline(60);
				const sale_end = sale_start + 60;
				await sale.initialize(
					SALE_PARAMS.ITEM_PRICE, // _itemPrice
					SALE_PARAMS.NEXT_ID, // _nextId
					SALE_PARAMS.FINAL_ID, // _finalId
					sale_start, // _saleStart
					sale_end, // _saleEnd
					SALE_PARAMS.BATCH_LIMIT, // _batchLimit
					SALE_PARAMS.ALI_SOURCE, // _aliSource
					SALE_PARAMS.ALI_VALUE, // _aliValue
					{ from: a0 },
				);
				expect(await sale.isActive()).to.be.false;
			});
			it("is inactive if saleEnd is not in the future", async function () {
				const sale_start = await default_deadline(-120);
				const sale_end = sale_start + 60;
				await sale.initialize(
					SALE_PARAMS.ITEM_PRICE, // _itemPrice
					SALE_PARAMS.NEXT_ID, // _nextId
					SALE_PARAMS.FINAL_ID, // _finalId
					sale_start, // _saleStart
					sale_end, // _saleEnd
					SALE_PARAMS.BATCH_LIMIT, // _batchLimit
					SALE_PARAMS.ALI_SOURCE, // _aliSource
					SALE_PARAMS.ALI_VALUE, // _aliValue
					{ from: a0 },
				);
				expect(await sale.isActive()).to.be.false;
			});
			it("is inactive if saleEnd becomes in the past", async function () {
				const sale_start = await default_deadline(0);
				const sale_end = sale_start + 60;
				await sale.initialize(
					SALE_PARAMS.ITEM_PRICE, // _itemPrice
					SALE_PARAMS.NEXT_ID, // _nextId
					SALE_PARAMS.FINAL_ID, // _finalId
					sale_start, // _saleStart
					sale_end, // _saleEnd
					SALE_PARAMS.BATCH_LIMIT, // _batchLimit
					SALE_PARAMS.ALI_SOURCE, // _aliSource
					SALE_PARAMS.ALI_VALUE, // _aliValue
					{ from: a0 },
				);
				await sale.setNow256(sale_end);
				expect(await sale.isActive()).to.be.false;
			});
			it("is active otherwise", async function () {
				const sale_start = await default_deadline(0);
				const sale_end = sale_start + 60;
				await sale.initialize(
					SALE_PARAMS.ITEM_PRICE, // _itemPrice
					SALE_PARAMS.NEXT_ID, // _nextId
					SALE_PARAMS.FINAL_ID, // _finalId
					sale_start, // _saleStart
					sale_end, // _saleEnd
					SALE_PARAMS.BATCH_LIMIT, // _batchLimit
					SALE_PARAMS.ALI_SOURCE, // _aliSource
					SALE_PARAMS.ALI_VALUE, // _aliValue
					{ from: a0 },
				);
				expect(await sale.isActive()).to.be.true;
			});
		});
	});
	describe("after FixedSupplySale is deployed and initialized with no ALI source/value", function () {
		// deploy and initialize the sale
		let nft, persona, iNft, sale, ITEM_PRICE, NEXT_ID, FINAL_ID, SALE_START, SALE_END, ITEMS_ON_SALE, ALI_SOURCE, ALI_VALUE;
		beforeEach(async function () {
			({ nft, persona, iNft, sale, ITEM_PRICE, NEXT_ID, FINAL_ID, SALE_START, SALE_END, ITEMS_ON_SALE, ALI_SOURCE, ALI_VALUE }
				= await sale_deploy_initialized(a0));
		});

		describe("itemsAvailable (iNFTs available on sale)", function () {
			it("is zero if sale is inactive", async function () {
				await sale.setStateOverride(false, { from: a0 });
				expect(await sale.itemsAvailable()).to.be.bignumber.that.equals("0");
			});
			it("is as expected if sale is active", async function () {
				await sale.setStateOverride(true, { from: a0 });
				expect(await sale.itemsAvailable()).to.be.bignumber.that.equals(ITEMS_ON_SALE + "");
			});
		});
		describe("buying a single iNFT", function () {
			const payer = a1;
			const recipient = a2;

			let price;
			beforeEach(async function () {
				price = ITEM_PRICE;
			})

			it("fails if FEATURE_PUBLIC_SALE is disabled and buyer doesn't have ROLE_BUYER permission", async function () {
				await sale.updateFeatures(not(FEATURE_PUBLIC_SALE), { from: a0 });
				await sale.updateRole(payer, not(ROLE_BUYER), { from: a0 });
				await expectRevert(sale.buySingle({ from: payer, value: price }), "access denied");
			});
			it("fails if sale is inactive", async function () {
				// impossibility to buy an iNFT if sale is inactive is tested with the mocking
				// smart contract which overrides isActive() function which always returns false
				await sale.setStateOverride(false, { from: a0 });
				await expectRevert(sale.buySingle({ from: payer, value: price }), "inactive sale");
			});
			it("fails if transaction doesn't supply enough ETH", async function () {
				await expectRevert(sale.buySingle({ from: payer, value: price.subn(1) }), "not enough funds");
			});
			it("fails if recipient address is zero", async function () {
				await expectRevert(sale.buySingleTo(ZERO_ADDRESS, { from: payer, value: price }), "recipient not set");
			});
			describe("succeeds if FEATURE_PUBLIC_SALE is enabled", function () {
				beforeEach(async function () {
					await sale.updateFeatures(FEATURE_PUBLIC_SALE, { from: a0 });
					await sale.updateRole(payer, 0, { from: a0 });
				});
				succeeds();
			});
			describe("succeeds if buyer has ROLE_BUYER permission", function () {
				beforeEach(async function () {
					await sale.updateFeatures(not(FEATURE_PUBLIC_SALE), { from: a0 });
					await sale.updateRole(payer, ROLE_BUYER, { from: a0 });
				});
				succeeds();
			});

			function succeeds() {
				// use Zeppelin balance tracker to track payer and sale balances
				let payerTracker, saleTracker;
				beforeEach(async function () {
					payerTracker = await balance.tracker(payer);
					saleTracker = await balance.tracker(sale.address);
				});

				// buy single iNFT
				let receipt;
				beforeEach(async function () {
					receipt = await sale.buySingleTo(recipient, { from: payer, value: price });
				});

				it("nextId increases by one", async function () {
					expect(await sale.nextId()).to.be.bignumber.that.equals(NEXT_ID + 1 + "");
				});
				it("soldCounter increases by one", async function () {
					// TODO: add a test to check soldCounter doesn't decrease after reinitialization
					expect(await sale.soldCounter()).to.be.bignumber.that.equals("1");
				});
				it("NFT with expected ID is minted", async function () {
					expect(await nft.exists(NEXT_ID)).to.be.true;
				});
				it("AI Personality with expected ID is minted", async function () {
					expect(await persona.exists(NEXT_ID)).to.be.true;
				});
				it("iNFT with expected ID is minted", async function () {
					expect(await iNft.exists(NEXT_ID)).to.be.true;
				});
				it("NFT is owned by the recipient", async function () {
					expect(await nft.ownerOf(NEXT_ID)).to.equal(recipient);
				});
				it("AI Personality is owned by iNFT smart contract", async function () {
					expect(await persona.ownerOf(NEXT_ID)).to.equal(iNft.address);
				});
				it("iNFT is owned by the recipient", async function () {
					expect(await iNft.ownerOf(NEXT_ID)).to.equal(recipient);
				});
				describe("iNFT record is correct", function () {
					// note: we check only basic iNFT state created, exhaustive testing
					// is done in the iNFT smart contract tests
					let binding;
					beforeEach(async function () {
						binding = await iNft.bindings(NEXT_ID);
					});
					it("personalityContract is AI Personality contract address", async function () {
						expect(binding.personalityContract).to.equal(persona.address);
					});
					it("personalityId is expected AI Personality ID", async function () {
						expect(binding.personalityId).to.be.bignumber.that.equals(NEXT_ID + "");
					});
					it("aliValue is zero", async function () {
						expect(binding.aliValue).to.be.bignumber.that.equals("0");
					});
					it("targetContract is NFT contract address", async function () {
						expect(binding.targetContract).to.equal(nft.address);
					});
					it("targetId is expected NFT ID", async function () {
						expect(binding.targetId).to.be.bignumber.that.equals(NEXT_ID + "");
					});
				});
				it("buyer balance decreases as expected", async function () {
					const gas_cost = await extract_gas_cost(receipt);
					expect((await payerTracker.delta()).neg().sub(gas_cost)).to.be.bignumber.that.equals(price);
				});
				it("sale balance increases as expected", async function () {
					expect(await saleTracker.delta()).to.be.bignumber.that.equals(price);
				});
				it('"Bought" event is emitted', async function () {
					expectEvent(receipt, "Bought", {
						_by: payer,
						_to: recipient,
						_amount: new BN(1),
						_aliValue: new BN(0),
						_value: price,
					});
				});
			}
		});
		describe("buying a batch of iNFTs", function () {
			const payer = a1;
			const recipient = a2;

			const n = random_int(2, 4);
			let price;
			beforeEach(async function () {
				price = ITEM_PRICE.muln(n);
			});

			it("fails if FEATURE_PUBLIC_SALE is disabled and buyer doesn't have ROLE_BUYER permission", async function () {
				await sale.updateFeatures(not(FEATURE_PUBLIC_SALE), { from: a0 });
				await sale.updateRole(payer, not(ROLE_BUYER), { from: a0 });
				await expectRevert(sale.buy(n, { from: payer, value: price }), "access denied");
			});
			it("fails if sale is inactive", async function () {
				// impossibility to buy an iNFT if sale is inactive is tested with the mocking
				// smart contract which overrides isActive() function which always returns false
				await sale.setStateOverride(false, { from: a0 });
				await expectRevert(sale.buy(n, { from: payer, value: price }), "inactive sale or not enough items available");
			});
			it("fails if transaction doesn't supply enough ETH", async function () {
				await expectRevert(sale.buy(n, { from: payer, value: price.subn(1) }), "not enough funds");
			});
			it("fails if recipient address is zero", async function () {
				await expectRevert(sale.buyTo(ZERO_ADDRESS, n, { from: payer, value: price }), "recipient not set");
			});
			it("fails if amount is less than 2", async function () {
				await expectRevert(sale.buy(0, { from: payer, value: price }), "incorrect amount");
				await expectRevert(sale.buy(1, { from: payer, value: price }), "incorrect amount");
			});
			it("fails if amount exceeds batchLimit set", async function () {
				// reinitialize with non-zero batchLimit
				const BATCH_SIZE = 4;
				const n = BATCH_SIZE + 1;
				const price = ITEM_PRICE.muln(n);
				await sale.initialize(ITEM_PRICE, NEXT_ID, FINAL_ID, SALE_START, SALE_END, BATCH_SIZE, ALI_SOURCE, ALI_VALUE, { from: a0 });
				await expectRevert(sale.buy(n, { from: payer, value: price }), "incorrect amount");
			});
			it("fails if amount exceeds sale amount", async function () {
				// reinitialize with non-zero batchLimit and small finalId
				const BATCH_SIZE = 10;
				const FINAL_ID = 5;
				const price = ITEM_PRICE.muln(BATCH_SIZE);
				await sale.initialize(ITEM_PRICE, NEXT_ID, FINAL_ID, SALE_START, SALE_END, BATCH_SIZE, ALI_SOURCE, ALI_VALUE, { from: a0 });
				await expectRevert(sale.buy(BATCH_SIZE, { from: payer, value: price }), "inactive sale or not enough items available");
			});
			describe("succeeds if FEATURE_PUBLIC_SALE is enabled", function () {
				beforeEach(async function () {
					await sale.updateFeatures(FEATURE_PUBLIC_SALE, { from: a0 });
					await sale.updateRole(payer, 0, { from: a0 });
				});
				succeeds();
			});
			describe("succeeds if buyer has ROLE_BUYER permission", function () {
				beforeEach(async function () {
					await sale.updateFeatures(not(FEATURE_PUBLIC_SALE), { from: a0 });
					await sale.updateRole(payer, ROLE_BUYER, { from: a0 });
				});
				succeeds();
			});

			function succeeds() {
				// use Zeppelin balance tracker to track payer and sale balances
				let payerTracker, saleTracker;
				beforeEach(async function () {
					payerTracker = await balance.tracker(payer);
					saleTracker = await balance.tracker(sale.address);
				});

				// buy batch of iNFTs
				let receipt;
				beforeEach(async function () {
					receipt = await sale.buyTo(recipient, n, { from: payer, value: price });
				});

				it("nextId increases by the batch size", async function () {
					expect(await sale.nextId()).to.be.bignumber.that.equals(NEXT_ID + n + "");
				});
				it("soldCounter increases by the batch size", async function () {
					// TODO: add a test to check soldCounter doesn't decrease after reinitialization
					expect(await sale.soldCounter()).to.be.bignumber.that.equals(n + "");
				});
				it("NFTs with expected IDs are minted", async function () {
					for (let i = 0; i < n; i++) {
						expect(await nft.exists(NEXT_ID + i), `${i} NFT in a batch doesn't exist`).to.be.true;
					}
				});
				it("AI Personalities with expected IDs are minted", async function () {
					for (let i = 0; i < n; i++) {
						expect(await persona.exists(NEXT_ID + i), `${i} AI Personality in a batch doesn't exist`).to.be.true;
					}
				});
				it("iNFTs with expected IDs are minted", async function () {
					for (let i = 0; i < n; i++) {
						expect(await iNft.exists(NEXT_ID + i), `${i} iNFT in a batch doesn't exist`).to.be.true;
					}
				});
				it("NFTs are owned by the recipient", async function () {
					for (let i = 0; i < n; i++) {
						expect(await nft.ownerOf(NEXT_ID + i), `${i} NFT in a batch doesn't belong to the recipient`).to.equal(recipient);
					}
				});
				it("AI Personalities are owned by iNFT smart contract", async function () {
					for (let i = 0; i < n; i++) {
						expect(
							await persona.ownerOf(NEXT_ID + i),
							`${i} AI Personality in a batch doesn't belong to the iNFT contract`
						).to.equal(iNft.address);
					}
				});
				it("iNFTs are owned by the recipient", async function () {
					for (let i = 0; i < n; i++) {
						expect(await iNft.ownerOf(NEXT_ID + i), `${i} iNFT in a batch doesn't belong to the recipient`).to.equal(recipient);
					}
				});
				describe("iNFTs records are correct", function () {
					for (let i = 0; i < n; i++) {
						// note: we check only basic iNFT state created, exhaustive testing
						// is done in the iNFT smart contract tests
						let binding;
						beforeEach(async function () {
							binding = await iNft.bindings(NEXT_ID + i);
						});
						it(`${i} personalityContract is AI Personality contract address`, async function () {
							expect(binding.personalityContract).to.equal(persona.address);
						});
						it(`${i} personalityId is expected AI Personality ID`, async function () {
							expect(binding.personalityId).to.be.bignumber.that.equals(NEXT_ID + i + "");
						});
						it(`${i} aliValue is zero`, async function () {
							expect(binding.aliValue).to.be.bignumber.that.equals("0");
						});
						it(`${i} targetContract is NFT contract address`, async function () {
							expect(binding.targetContract).to.equal(nft.address);
						});
						it(`${i} targetId is expected NFT ID`, async function () {
							expect(binding.targetId).to.be.bignumber.that.equals(NEXT_ID + i + "");
						});
					}
				});
				it("buyer balance decreases as expected", async function () {
					const gas_cost = await extract_gas_cost(receipt);
					expect((await payerTracker.delta()).neg().sub(gas_cost)).to.be.bignumber.that.equals(price);
				});
				it("sale balance increases as expected", async function () {
					expect(await saleTracker.delta()).to.be.bignumber.that.equals(price);
				});
				it('"Bought" event is emitted', async function () {
					expectEvent(receipt, "Bought", {
						_by: payer,
						_to: recipient,
						_amount: new BN(n),
						_aliValue: new BN(0),
						_value: price,
					});
				});
			}
		});
		describe("dust ETH is sent back to payer", function () {
			const payer = a1;
			// use Zeppelin balance tracker to track payer and sale balances
			let payerTracker, saleTracker;
			beforeEach(async function () {
				payerTracker = await balance.tracker(payer);
				saleTracker = await balance.tracker(sale.address);
			});

			describe("when buying single with a small dust", function () {
				let price, receipt;
				beforeEach(async function () {
					price = ITEM_PRICE;
					receipt = await sale.buySingle({ from: payer, value: price.addn(1) });
				});
				it("buyer balance decreases as expected", async function () {
					const gas_cost = await extract_gas_cost(receipt);
					expect((await payerTracker.delta()).neg().sub(gas_cost)).to.be.bignumber.that.equals(price);
				});
				it("sale balance increases as expected", async function () {
					expect(await saleTracker.delta()).to.be.bignumber.that.equals(price);
				});
			});
			describe("when buying single with a significant dust", function () {
				let price, receipt;
				beforeEach(async function () {
					price = ITEM_PRICE;
					receipt = await sale.buySingle({ from: payer, value: price.muln(2).addn(1) });
				});
				it("buyer balance decreases as expected", async function () {
					const gas_cost = await extract_gas_cost(receipt);
					expect((await payerTracker.delta()).neg().sub(gas_cost)).to.be.bignumber.that.equals(price);
				});
				it("sale balance increases as expected", async function () {
					expect(await saleTracker.delta()).to.be.bignumber.that.equals(price);
				});
			});
			describe("when buying batch with a small dust", function () {
				const n = random_int(2, 4);
				let price, receipt;
				beforeEach(async function () {
					price = ITEM_PRICE.muln(n);
					receipt = await sale.buy(n, { from: payer, value: price.addn(1) });
				});
				it("buyer balance decreases as expected", async function () {
					const gas_cost = await extract_gas_cost(receipt);
					expect((await payerTracker.delta()).neg().sub(gas_cost)).to.be.bignumber.that.equals(price);
				});
				it("sale balance increases as expected", async function () {
					expect(await saleTracker.delta()).to.be.bignumber.that.equals(price);
				});
			});
			describe("when buying batch with a significant dust", function () {
				const n = random_int(2, 4);
				let price, receipt;
				beforeEach(async function () {
					price = ITEM_PRICE.muln(n);
					receipt = await sale.buy(n, { from: payer, value: price.muln(2).addn(1) });
				});
				it("buyer balance decreases as expected", async function () {
					const gas_cost = await extract_gas_cost(receipt);
					expect((await payerTracker.delta()).neg().sub(gas_cost)).to.be.bignumber.that.equals(price);
				});
				it("sale balance increases as expected", async function () {
					expect(await saleTracker.delta()).to.be.bignumber.that.equals(price);
				});
			});
		});
		describe("withdrawal", function () {
			const buyer = a1;
			const withdraw_manager = a4;
			const recipient = a5;

			// use Zeppelin balance tracker to track recipient balance
			let recipientTracker;
			beforeEach(async function () {
				recipientTracker = await balance.tracker(recipient);
			});

			beforeEach(async function () {
				await sale.buySingle({ from: buyer, value: ITEM_PRICE });
			});
			it("there is ITEM_PRICE ETH on the sale balance after successful buy", async function () {
				expect(await web3.eth.getBalance(sale.address)).to.be.bignumber.that.equals(ITEM_PRICE);
			});

			describe("when executed by an account with no ROLE_WITHDRAWAL_MANAGER permission", function () {
				beforeEach(async function () {
					await sale.updateRole(withdraw_manager, not(ROLE_WITHDRAWAL_MANAGER), { from: a0 });
				});
				it("fails (reverts)", async function () {
					await expectRevert(sale.withdraw({ from: withdraw_manager }), "access denied");
				});
			});
			describe("when executed by an account with ROLE_WITHDRAWAL_MANAGER permission", function () {
				beforeEach(async function () {
					await sale.updateRole(withdraw_manager, ROLE_WITHDRAWAL_MANAGER, { from: a0 });
				});
				it("fails if sale balance is zero", async function () {
					await sale.withdraw({ from: withdraw_manager }); // zero the balance first
					await expectRevert(sale.withdraw({ from: withdraw_manager }), "zero balance");
				});
				it("fails if recipient address is zero", async function () {
					await expectRevert(sale.withdrawTo(ZERO_ADDRESS, { from: withdraw_manager }), "address not set");
				});
				describe("succeeds otherwise", function () {
					let receipt;
					beforeEach(async function () {
						receipt = await sale.withdrawTo(recipient, { from: withdraw_manager });
					});
					it("sale balance decreases to zero", async function () {
						expect(await web3.eth.getBalance(sale.address)).to.be.bignumber.that.equals("0");
					});
					it("recipient balance increases as expected", async function () {
						expect(await recipientTracker.delta()).to.be.bignumber.that.equals(ITEM_PRICE);
					});
					it('"Withdrawn" event is emitted', async function () {
						expectEvent(receipt, "Withdrawn", {
							_by: withdraw_manager,
							_to: recipient,
							_value: ITEM_PRICE,
						});
					});
				});
			});
		});
	});
	describe("after FixedSupplySale is deployed and initialized with ALI source/value", function () {
		// deploy the sale
		let ali, nft, persona, iNft, sale;
		beforeEach(async function () {
			({ ali, nft, persona, iNft, sale } = await sale_deploy(a0));
		});

		// initialize the sale
		const item_price = random_bn(toWei(new BN(10), "finney"), toWei(new BN(1), "ether"));
		const next_id = random_int(1_000, 1_000_000);
		const final_id = next_id + SALE_PARAMS.ITEMS_ON_SALE;
		let sale_start, sale_end;
		const batch_limit = 0;
		const ali_source = a0;
		const ali_value = random_bn(toWei(new BN(1_000), "ether"), toWei(new BN(1_000_000), "ether"));
		beforeEach(async function () {
			sale_start = await default_deadline(0);
			sale_end = sale_start + 60;
			await sale.initialize(
				item_price, // _itemPrice
				next_id, // _nextId
				final_id, // _finalId
				sale_start, // _saleStart
				sale_end, // _saleEnd
				batch_limit, // _batchLimit
				ali_source, // _aliSource
				ali_value, // _aliValue
				{ from: a0 },
			);
		});
		describe("buying a single iNFT", function () {
			const payer = a1;
			const recipient = a2;

			const price = item_price;
			const ali_price = ali_value;

			async function buy() {
				return await sale.buySingleTo(recipient, { from: payer, value: price });
			}
			it("fails if ALI tokens are not supplied", async function () {
				await expectRevert(buy(), "transfer amount exceeds allowance");
			});
			it("fails if not enough ALI tokens are supplied", async function () {
				await ali.approve(sale.address, ali_price.subn(1), { from: ali_source });
				await expectRevert(buy(), "transfer amount exceeds allowance");
			});
			describe("succeeds otherwise", function () {
				let receipt;
				beforeEach(async function () {
					await ali.approve(sale.address, ali_price, { from: ali_source });
					receipt = await buy();
				});
				it("ALI source balance reduced as expected", async function () {
					expect(await ali.balanceOf(ali_source)).to.be.bignumber.that.equals(S0.sub(ali_price));
				});
				it("ALI iNFT value increased as expected", async function () {
					expect(await ali.balanceOf(iNft.address)).to.be.bignumber.that.equals(ali_price);
				});
				it("ALI gets recorded on the recipient iNFT balance properly", async function () {
					expect(await iNft.lockedValue(next_id)).to.be.bignumber.that.equals(ali_value);
				});
				it('"Bought" event is emitted', async function () {
					expectEvent(receipt, "Bought", {
						_by: payer,
						_to: recipient,
						_amount: new BN(1),
						_aliValue: ali_price,
						_value: price,
					});
				});
			});
		});
		describe("buying a batch of iNFTs", function () {
			const payer = a1;
			const recipient = a2;

			const n = random_int(2, 4);
			const price = item_price.muln(n);
			const ali_price = ali_value.muln(n);

			async function buy() {
				return await sale.buyTo(recipient, n, { from: payer, value: price });
			}
			it("fails if ALI tokens are not supplied", async function () {
				await expectRevert(buy(), "transfer amount exceeds allowance");
			});
			it("fails if not enough ALI tokens are supplied", async function () {
				await ali.approve(sale.address, ali_price.subn(1), { from: ali_source });
				await expectRevert(buy(), "transfer amount exceeds allowance");
			});
			describe("succeeds otherwise", function () {
				let receipt;
				beforeEach(async function () {
					await ali.approve(sale.address, ali_price, { from: ali_source });
					receipt = await buy();
				});
				it("ALI source balance reduced as expected", async function () {
					expect(await ali.balanceOf(ali_source)).to.be.bignumber.that.equals(S0.sub(ali_price));
				});
				it("ALI iNFT value increased as expected", async function () {
					expect(await ali.balanceOf(iNft.address)).to.be.bignumber.that.equals(ali_price);
				});
				it("ALI gets recorded on the recipient iNFT balances properly", async function () {
					for (let i = 0; i < n; i++) {
						expect(await iNft.lockedValue(next_id + i), `binding ${i}`).to.be.bignumber.that.equals(ali_value);
					}
				});
				it('"Bought" event is emitted', async function () {
					expectEvent(receipt, "Bought", {
						_by: payer,
						_to: recipient,
						_amount: new BN(n),
						_aliValue: ali_price,
						_value: price,
					});
				});
			});
		});
	});
});
