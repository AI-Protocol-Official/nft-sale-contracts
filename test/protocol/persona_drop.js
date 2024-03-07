// AI Protocol PersonalityDrop: Airdrop Tests

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
const {
	assert,
	expect,
} = require("chai");

// number utils
const {random_element} = require("../include/number_utils");

// BN utils
const {random_bn256} = require("../include/bn_utils");

// Merkle tree and data generation utils
const {
	generate_drop,
	air_data_to_leaf,
} = require("./include/merkle_utils");

// ACL features and roles
const {
	not,
	FEATURE_REDEEM_ACTIVE,
	ROLE_DATA_MANAGER,
} = require("../include/features_roles");

// deployment routines in use
const {
	ali_erc20_deploy_restricted,
	persona_deploy_restricted,
	persona_drop_deploy_restricted,
	nft_drop_deploy_pure,
} = require("./include/deployment_routines");

// run drop tests
contract("PersonalityDrop: Airdrop Tests", function(accounts) {
	// extract accounts to be used:
	// A0 – special default zero account accounts[0] used by Truffle, reserved
	// a0 – deployment account having all the permissions, reserved
	// H0 – initial token holder account
	// a1, a2,... – working accounts to perform tests on
	const [A0, a0, H0, a1, a2, a3, a4, a5] = accounts;

	describe("PersonalityDrop deployment", function() {
		it("fails if target contract is not set", async function() {
			await expectRevert(nft_drop_deploy_pure(a0, ZERO_ADDRESS), "target contract is not set");
		});
		it("fails if target contract is not valid ERC721", async function() {
			const target = await ali_erc20_deploy_restricted(a0);
			await expectRevert(nft_drop_deploy_pure(a0, target.address), "unexpected target type");
		});
		describe("succeeds otherwise", async function() {
			let target, airdrop1;
			beforeEach(async function() {
				target = await persona_deploy_restricted(a0);
				airdrop1 = await nft_drop_deploy_pure(a0, target.address);
			})
			it("target contract is set as expected", async function() {
				expect(await airdrop1.targetContract()).to.be.equal(target.address);
			});
			it("Merkle tree root is not set", async function() {
				expect(await airdrop1.root()).to.be.equal(ZERO_BYTES32);
			});
		});
	});
	describe("after PersonalityDrop is deployed", function() {
		// will be used for initialization
		const {drop, leaves, tree, root} = generate_drop();
		const rnd_pick = random_element(drop);
		const leaf = air_data_to_leaf(rnd_pick);
		const proof = tree.getHexProof(leaf);

		// deploy the airdrop
		let persona, airdrop;
		beforeEach(async function() {
			({persona, airdrop} = await persona_drop_deploy_restricted(a0));
		});
		describe("PersonalityDrop ACL", function() {
			beforeEach(async function() {
				await airdrop.setInputDataRoot(root, {from: a0});
			});

			const by = a1;
			const root1 = web3.utils.randomHex(32);

			async function setInputDataRoot() {
				return await airdrop.setInputDataRoot(root1, {from: by});
			}
			describe("when sender doesn't have ROLE_DATA_MANAGER permission", function() {
				beforeEach(async function() {
					await airdrop.updateRole(by, not(ROLE_DATA_MANAGER), {from: a0});
				});
				it("setInputDataRoot fails", async function() {
					await expectRevert(setInputDataRoot(), "access denied");
				});
			});
			describe("when sender has ROLE_DATA_MANAGER permission", function() {
				beforeEach(async function() {
					await airdrop.updateRole(by, ROLE_DATA_MANAGER, {from: a0});
				});
				describe("setInputDataRoot succeeds", function() {
					let receipt;
					beforeEach(async function() {
						receipt = await setInputDataRoot();
					});
					it("root gets set as expected", async function() {
						expect(await airdrop.root()).to.be.equal(root1);
					});
					it('"RootChanged" event is emitted', async function() {
						expectEvent(receipt, "RootChanged", {_by: by, _root: root1});
					});
				});
			});

			async function redeem() {
				return await airdrop.redeem(rnd_pick.to, rnd_pick.tokenId, proof, {from: by});
			}
			describe("when FEATURE_REDEEM_ACTIVE is disabled", function() {
				beforeEach(async function() {
					await airdrop.updateFeatures(not(FEATURE_REDEEM_ACTIVE), {from: a0});
				});
				it("redeem fails", async function() {
					await expectRevert(redeem(), "redeems are disabled");
				});
			});
			describe("when FEATURE_REDEEM_ACTIVE is enabled", function() {
				beforeEach(async function() {
					await airdrop.updateFeatures(FEATURE_REDEEM_ACTIVE, {from: a0});
				});
				describe("deposit succeeds", function() {
					let receipt;
					beforeEach(async function() {
						receipt = await redeem();
					});
					it('"Redeemed" event is emitted', async function() {
						expectEvent(receipt, "Redeemed", {
							_by: by,
							_to: rnd_pick.to,
							_tokenId: rnd_pick.tokenId + "",
							_proof: proof,
						});
					});
					it('"Transfer" event is emitted', async function() {
						await expectEvent.inTransaction(receipt.tx, persona, "Transfer", {
							_from: ZERO_ADDRESS,
							_to: rnd_pick.to,
							_tokenId: rnd_pick.tokenId + "",
						});
					});
					it("ownership of the minted token is as expected", async function() {
						expect(await persona.ownerOf(rnd_pick.tokenId)).to.be.equal(rnd_pick.to);
					});
					it("token total supply increased by one", async function() {
						expect(await persona.totalSupply()).to.be.bignumber.that.equals("1");
					});
				});
			});
		});
		describe("PersonalityDrop initialization (Merkle root setup)", function() {
			it("cannot validate random token before initialization", async function f() {
				expect(await airdrop.isTokenValid(rnd_pick.to, rnd_pick.tokenId, proof)).to.be.false;
			});
			describe("after PersonalityDrop is initialized (Merkle root is set)", function() {
				beforeEach(async function() {
					await airdrop.setInputDataRoot(root, {from: a0});
				});
				it("can validate random token", async function() {
					expect(await airdrop.isTokenValid(rnd_pick.to, rnd_pick.tokenId, proof)).to.be.true;
				});
			});
		});
		describe("after PersonalityDrop is deployed and initialized", function() {
			beforeEach(async function() {
				await airdrop.setInputDataRoot(root, {from: a0});
				await airdrop.updateFeatures(FEATURE_REDEEM_ACTIVE, {from: a0});
			});

			const by = a1;

			describe("can redeem legit registered token", async function() {
				let receipt;
				beforeEach(async function() {
					receipt = await airdrop.redeem(rnd_pick.to, rnd_pick.tokenId, proof, {from: by});
				});
				it('"Redeemed" event is emitted', async function() {
					expectEvent(receipt, "Redeemed", {
						_by: by,
						_to: rnd_pick.to,
						_tokenId: rnd_pick.tokenId + "",
						_proof: proof,
					});
				});
				it('"Transfer" event is emitted', async function() {
					await expectEvent.inTransaction(receipt.tx, persona, "Transfer", {
						_from: ZERO_ADDRESS,
						_to: rnd_pick.to,
						_tokenId: rnd_pick.tokenId + "",
					});
				});
				it("ownership of the minted token is as expected", async function() {
					expect(await persona.ownerOf(rnd_pick.tokenId)).to.be.equal(rnd_pick.to);
				});
				it("token total supply increased by one", async function() {
					expect(await persona.totalSupply()).to.be.bignumber.that.equals("1");
				});
			});
			it("cannot steal someone's else token", async function() {
				await expectRevert(airdrop.redeem(by, rnd_pick.tokenId, proof, {from: by}), "invalid token");
			});
		});
	});
});
