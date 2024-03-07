// AI Protocol FixedSupplySale: 10,000 Sale Simulation
// Following simulation executes 10,000 sale scenario; buyers buy single iNFTs, buy multiple iNFTs
// in batches, try to buy more than allowed, etc

const log = require("loglevel");
log.setLevel(process.env.LOG_LEVEL? process.env.LOG_LEVEL: "info");

// Zeppelin test helpers
const {
	BN,
	constants,
	expectEvent,
	expectRevert,
} = require("@openzeppelin/test-helpers");

// Chai test helpers
const {expect} = require("chai");

// web3 utils
const toWei = web3.utils.toWei;

// number utils
const {
	random_int,
	random_element,
	print_n,
} = require("../include/number_utils");

// BN utils
const {
	draw_amounts,
} = require("../include/bn_utils");

// block utils
const {extract_gas} = require("../include/block_utils");

// deployment routines in use
const {
	sale_deploy_initialized,
} = require("./include/deployment_routines");

// run 10k sale simulation
contract("FixedSupplySale: 10,000 Sale Simulation", function(accounts) {
	// extract accounts to be used:
	// A0 – special default zero account accounts[0] used by Truffle, reserved
	// a0 – deployment account having all the permissions, reserved
	// H0 – initial token holder account
	// a1, a2,... – working accounts to perform tests on
	const [A0, a0, H0, a1, a2] = accounts;
	// participants – rest of the accounts
	const participants = accounts.slice(3);

	// deploy and initialize the sale
	let nft, persona, iNft, sale, ITEM_PRICE, ITEMS_ON_SALE;
	beforeEach(async function() {
		({nft, persona, iNft, sale, ITEM_PRICE, ITEMS_ON_SALE} = await sale_deploy_initialized(a0));
	});

	// simulation executor
	async function sale_sim_test(limit = ITEMS_ON_SALE) {
		// for this simulation we will be working with all the available accounts
		// which are going to buy iNFTs at random in random quantities
		const len = participants.length;

		// buys n iNFTs to the buyer, wisely executing buySingle or buy
		async function buy(buyer, n) {
			const dust_amt = Math.random() < 0.1? toWei(new BN(random_int(0, 100)), "szabo"): new BN(0);
			return n > 1?
				await sale.buy(n, {value: ITEM_PRICE.muln(n).add(dust_amt), from: buyer}):
				await sale.buySingle({value: ITEM_PRICE.add(dust_amt), from: buyer});
		}

		// buy items until all items on sale are bought
		let items_sold = 0;
		let total_gas_used = 0;
		let tx_counter = 0;
		while(items_sold < limit) {
			const buyer = random_element(participants);
			// how many iNFTs buyer is going to buy
			let n = random_int(1, 50);
			if(items_sold + n > ITEMS_ON_SALE) {
				await expectRevert(buy(buyer, n), "inactive sale or not enough items available");
			}
			if(items_sold + n > limit) {
				n = limit - items_sold;
			}
			log.debug("buying %o/%o/%o iNFT(s)", n, items_sold, ITEMS_ON_SALE);
			const receipt = await buy(buyer, n);
			tx_counter++;
			items_sold += n;
			const gas_used = extract_gas(receipt);
			total_gas_used += gas_used;
			log.info("%o/%o/%o iNFT(s) bought; gas used %o", n, items_sold, ITEMS_ON_SALE, print_n(gas_used));
			expect(
				await sale.soldCounter(),
				"items_sold doesn't match with items_sold"
			).to.be.bignumber.that.equals(items_sold + "");
			expectEvent(receipt, "Bought", {
				_by: buyer,
				_to: buyer,
				_amount: n + "",
				_aliValue: "0",
				_value: ITEM_PRICE.muln(n),
			});
			expect(await sale.nextId()).to.be.bignumber.that.equals(items_sold + 1 + "");
		}

		log.info(
			"%o iNFTs bought by %o accounts in %o transactions.\n%o cumulative gas used",
			items_sold,
			len,
			tx_counter,
			print_n(total_gas_used)
		);

		// verify final sale state indicators
		if(limit < ITEMS_ON_SALE) {
			// if not all the items were bought (low complexity test)
			expect(
				await sale.itemsOnSale(),
				"there must be still items on sale"
			).to.be.bignumber.that.equals(ITEMS_ON_SALE - limit + "");
			expect(
				await sale.itemsAvailable(),
				"there must be still items available"
			).to.be.bignumber.that.equals(ITEMS_ON_SALE - limit + "");
			expect(
				await sale.isActive(),
				"sale must be still active"
			).to.be.true;
		}
		else {
			// if all the items were bought (full simulation)
			expect(
				await sale.itemsOnSale(),
				"there are still items on sale"
			).to.be.bignumber.that.equals("0");
			expect(
				await sale.itemsAvailable(),
				"there are still items available"
			).to.be.bignumber.that.equals("0");
			expect(
				await sale.isActive(),
				"sale is still active"
			).to.be.false;
		}

		// verify sale ETH balance
		expect(
			await web3.eth.getBalance(sale.address),
			"Sale contract balance doesn't match total iNFTs sold price"
		).to.equal(ITEM_PRICE.muln(limit) + "");

		// verify total supplies
		expect(
			await nft.totalSupply(),
			"NFT supply doesn't match iNFTs sold"
		).to.be.bignumber.that.equals(limit + "")
		expect(
			await persona.totalSupply(),
			"AI Personality supply doesn't match iNFTs sold"
		).to.be.bignumber.that.equals(limit + "")
		expect(
			await persona.balanceOf(iNft.address),
			"AI Personality iNFT balance doesn't match iNFTs sold"
		).to.be.bignumber.that.equals(limit + "")
		expect(
			await iNft.totalSupply(),
			"iNFT supply doesn't match iNFTs sold"
		).to.be.bignumber.that.equals(limit + "")

		// get individual account balances
		const nft_balances = new Array(len);
		for(let i = 0; i < len; i++) {
			nft_balances[i] = await nft.balanceOf(participants[i]);
		}
		log.info("NFT balances:\n%o", draw_amounts(nft_balances));

		log.info("Execution complete.")
	}

	// low complexity test executes in coverage
	it("10,000 sale simulation (low complexity)", async function() {
		await sale_sim_test(1000);
	});
	// tests marked with @skip-on-coverage will are removed from solidity-coverage,
	// see yield-solcover.js, see https://github.com/sc-forks/solidity-coverage/blob/master/docs/advanced.md
	it("10,000 sale simulation [ @skip-on-coverage ]", async function() {
		await sale_sim_test();
	});

});
