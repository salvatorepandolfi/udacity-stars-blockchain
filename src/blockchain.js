/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message`
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if (this.height === -1) {
            let block = new BlockClass.Block({data: 'Genesis Block'});
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        return new Promise((resolve, reject) => {
            resolve(this.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to
     * create the `block hash` and push the block into the chain array. Don't for get
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention
     * that this method is a private method.
     */
    _addBlock(block) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            try {
                block.height = self.height + 1
                block.time = new Date().getTime().toString().slice(0, -3)
                if (self.height >= 0) {
                    block.previousBlockHash = self._getLatestBlock().hash
                }
                block.hash = SHA256(JSON.stringify(block)).toString()
                self.chain.push(block)
                self.height++
                const errorLog = await self.validateChain()
                if (Array.isArray(errorLog) && errorLog.length > 0) {
                    //Asserting that the chain was valid before adding the block
                    //if the chain is broken at this point, it means that the last block invalidata the full chain
                    //this could be checked reading the errorlog.
                    //Anyway, before resolve the Promise, i remove the last insered block.
                    self.chain.pop()
                    self.height--
                    return reject(errorLog)
                }
                return resolve(block)
            } catch (e) {
                reject(e)
            }
        });
    }

    /**
     * _getLatestBlock get the last insered block in the chain
     * @returns {*} Block
     * @private
     */
    _getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address
     */
    requestMessageOwnershipVerification(address) {
        return new Promise((resolve) => {
            resolve(`${address}:${new Date().getTime().toString().slice(0, -3)}:starRegistry`)
        });
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address
     * @param {*} message
     * @param {*} signature
     * @param {*} star
     */
    submitStar(address, message, signature, star) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            //Get the time from the message sent as a parameter
            const time = parseInt(message.split(':')[1])
            //Check if the time elapsed is less than 5 minutes
            if (parseInt(new Date().getTime().toString().slice(0, -3)) - time >= 300)
                return reject('The time for validate the signature has expired, try to get a new verification message')
            //Verify the message with wallet address and signature:
            try {
                if (bitcoinMessage.verify(message, address, signature)) {
                    resolve(self._addBlock(new BlockClass.Block({data: {address, message, star}})))
                } else
                    reject('The message validation is failed! Validate your input and try again')
            } catch (e) {
                reject(e.message)
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash
     */
    getBlockByHash(hash) {
        let self = this;
        return new Promise((resolve, reject) => {
            let block = self.chain.filter(b => b.hash === hash)[0];
            if (block) {
                resolve(block);
            } else {
                resolve("There's no block with this hash");
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block object
     * with the height equal to the parameter `height`
     * @param {*} height
     */
    getBlockByHeight(height) {
        let self = this;
        return new Promise((resolve, reject) => {
            let block = self.chain.filter(p => p.height === height)[0]
            if (block) {
                resolve(block)
            } else {
                resolve("No block at this height")
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address
     */
    async getStarsByWalletAddress(address) {
        let self = this;

        return new Promise(async (resolve, reject) => {
            try {
                let blocks = await Promise.all(
                    self.chain.map(async b => {
                        if (b.height > 0) {
                            const data = await b.getBData()
                            return {owner: data.address, star: data.star}
                        }
                        //this is for the Genesis block
                        //to prevent error on subsequent filter,
                        //I added an empty data object
                        return {owner: '', star: {}}
                    }))

                blocks = blocks.filter(b => (b.owner === address))

                if (blocks.length > 0)
                    return resolve(blocks)


                resolve("This address owns no stars")
            } catch (e) {
                reject(e.message)
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain() {
        let self = this;
        let errorLog = [];
        return new Promise(async (resolve, reject) => {

            self.chain.forEach((b) => {
                if (b.height > 0) {
                    const prevB = self.chain[b.height - 1]
                    if (b.previousBlockHash !== prevB.hash)
                        errorLog.push({message: `The chain is broken at this height: ${b.height}`, block: b})
                }
                if (!b.validate())
                    errorLog.push({message: `The block is not valid at height: ${b.height}`, block: b})
            })

            if (errorLog.length > 0)
                resolve(errorLog)

            resolve("The chain is valid, no error occurred")


        });
    }

}

module.exports.Blockchain = Blockchain;
