const Web3 = require('web3')
const conf = require('../conf')
import { Utils } from './Utils'

class ShrimpWatch {
    web3: any
    utils: Utils

    constructor() {
        this.web3 = new Web3(new Web3.providers.HttpProvider(conf.httpProvider))
        this.utils = new Utils()
    }

    async start() {
        let currentBlockNumber: number = conf.startblock
        while (true) {
            let latestBlockHeight = await this.web3.eth.getBlock('latest')
            let latestBlockNumber: number = latestBlockHeight.number

            // If at top of chain, wait for next block
            if (currentBlockNumber >= latestBlockNumber) {
                await this.utils.sleep(1000)
                continue
            }
        }
    }
}

function main() {
    let shrimp: ShrimpWatch = new ShrimpWatch();
    shrimp.start();
}
main()