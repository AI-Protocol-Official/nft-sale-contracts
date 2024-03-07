// AI Protocol PersonalityDrop: 1,012 Airdrop Simulation
// Following simulation executes 1,012 airdrop scenario;
// eligible addresses claim their pods randomly

const log = require("loglevel");
log.setLevel(process.env.LOG_LEVEL? process.env.LOG_LEVEL: "info");

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

// web3 utils
const toWei = web3.utils.toWei;

// number utils
const {
	random_int,
	random_element,
} = require("../include/number_utils");

// BN utils
const {
	print_amt,
	random_bn,
	draw_amounts,
	print_symbols,
} = require("../include/bn_utils");

// block utils
const {
	default_deadline,
	extract_gas,
} = require("../include/block_utils");

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
	persona_drop_deploy_restricted,
} = require("./include/deployment_routines");

// run 1,012 airdrop simulation
contract("PersonalityDrop: 1,012 Airdrop Simulation", function(accounts) {
	// extract accounts to be used:
	// A0 – special default zero account accounts[0] used by Truffle, reserved
	// a0 – deployment account having all the permissions, reserved
	// H0 – initial token holder account
	// a1, a2,... – working accounts to perform tests on
	const [A0, a0, H0, a1, a2] = accounts;
	// participants – rest of the accounts
	const participants = accounts.slice(3);

	// deploy the airdrop, init the Merkle tree root
	const POD_ID_OFFSET = 8989;
	const ITEMS_TO_DROP = 1012;
	const {drop, leaves, tree, root} = generate_drop(POD_ID_OFFSET, ITEMS_TO_DROP, participants);
	let persona, airdrop;
	beforeEach(async function() {
		({persona, airdrop} = await persona_drop_deploy_restricted(a0));
		airdrop.setInputDataRoot(root, {from: a0});
		airdrop.updateFeatures(FEATURE_REDEEM_ACTIVE, {from: a0});
	});

	// low complexity test executes in coverage
	it("1,012 airdrop simulation ", async function() {
		// for this simulation we will be working with all the available accounts
		// which are going to buy iNFTs at random in random quantities
		const len = participants.length;

		// save the initial persona supply
		const personaSupply0 = await persona.totalSupply();

		// make sure balances are zero initially
		for(let i = 0; i < len; i++) {
			expect(
				await persona.balanceOf(participants[i]),
				`non-zero initial POD balance for participant ${i}`
			).to.be.bignumber.that.equals("0");
		}

			// execute the drop simulation
		for(let i = 0; i < drop.length; i++) {
			const executor = random_element(participants);
			const proof = tree.getHexProof(leaves[i]);

			// do the simulation step
			const receipt = await airdrop.redeem(drop[i].to, drop[i].tokenId, proof, {from: executor});

			// verify the emitted events
			expectEvent(receipt, "Redeemed", {
				_by: executor,
				_to: drop[i].to,
				_tokenId: drop[i].tokenId + "",
				_proof: proof,
			});
			await expectEvent.inTransaction(receipt.tx, persona, "Transfer", {
				_from: ZERO_ADDRESS,
				_to: drop[i].to,
				_tokenId: drop[i].tokenId + "",
			});

			// verify POD was minted properly
			expect(
				await persona.ownerOf(drop[i].tokenId),
				`[${i}] unexpected token ${drop[i].tokenId} owner`
			).to.be.equal(drop[i].to);

			// log the progress
			log[(i + 1) % 10 === 0 || i === drop.length - 1? "info": "debug"]("successfully redeemed %o token(s)", i + 1);
		}

		// verify the persona supply increased as expected
		expect(
			(await persona.totalSupply()).sub(personaSupply0),
			"unexpected POD total supply increase"
		).to.be.bignumber.that.equals(ITEMS_TO_DROP + "");

		// get and verify individual account balances
		const persona_balances = new Array(len);
		for(let i = 0; i < len; i++) {
			// get the balance
			persona_balances[i] = await persona.balanceOf(participants[i]);

			// immediately verify it is as expected
			expect(
				persona_balances[i],
				`unexpected participant ${i} POD balance`
			).to.be.bignumber.that.equals(drop.filter(a => a.to === participants[i]).length + "");
		}
		// log.info("POD balances:\n%o", print_symbols(persona_balances));
		log.info("POD balances:\n%o", draw_amounts(persona_balances));

		log.info("Execution complete.")
	});
});
