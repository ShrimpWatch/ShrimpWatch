import { PrismaClient } from "@prisma/client"
import md5 from "md5"

export class DBHandler {
    prisma

    constructor() {
        this.prisma = new PrismaClient()
    }

    async endBlockBtc(blockNumber) {

        const pkg = {
            id: "shrimpwatch",
            lastBlockBtc: blockNumber.toString()
        }

        await this.prisma.shrimpwatch.upsert({
            where: { id: pkg.id },
            update: pkg,
            create: pkg
        }).catch((e) => { })
    }

    async endBlockEth(blockNumber) {

        const pkg = {
            id: "shrimpwatch",
            lastBlockEth: blockNumber.toString()
        }

        await this.prisma.shrimpwatch.upsert({
            where: { id: pkg.id },
            update: pkg,
            create: pkg
        }).catch((e) => { })
    }

    async fillCoinbase(receivers, transaction, block) {
        let amountReceived = 0
        for (let i = 0; i < receivers.length; i++) { amountReceived = amountReceived + receivers[i].value }

        const pkg = {
            id: transaction.txid,
            txHex: transaction.hex,
            amount: parseFloat(amountReceived),
            blockHash: block.hash,
            blockNumber: parseInt(block.height),
            timeStamp: parseFloat(block.time),
            coinbase: true
        }

        await this.prisma.btcTransaction.upsert({
            where: { id: pkg.id },
            update: pkg,
            create: pkg
        }).catch((e) => { })

        for (let i = 0; i < receivers.length; i++) {
            const receiver = receivers[i]

            const results = await this.prisma.btcWallet.findMany({
                where: {
                    id: receiver.address.toLowerCase()
                },
                take: 1
            })

            if (results.length == 0) {
                await this.prisma.btcWallet.create({
                    data: {
                        id: receiver.address.toLowerCase(),
                        balance: parseFloat(receiver.value),
                        nonce: 0,
                    }
                }).catch((e) => { })

            } else if (results.length > 0) {
                for (let r = 0; r < results.length; r++) {
                    let oldBalance = parseFloat(results[r].balance)

                    const pkg = {
                        id: receiver.address.toLowerCase(),
                        balance: (oldBalance + receiver.value),
                        nonce: results[r].nonce,
                    }

                    await this.prisma.btcWallet.upsert({
                        where: { id: pkg.id },
                        update: pkg,
                        create: pkg
                    }).catch((e) => { })
                }
            }

            const putPkg = {
                id: md5(`${transaction.txid}${receiver.address.toLowerCase()}${receiver.index}`),
                publicKey: receiver.address.toLowerCase(),
                amount: parseFloat(receiver.value),
                txId: transaction.txid,
                type: receiver.type,
                timeStamp: parseFloat(block.time)
            }

            await this.prisma.output.upsert({
                where: { id: putPkg.id },
                update: putPkg,
                create: putPkg
            }).catch((e) => { })
        }
    }

    async fillBtcWallet(senders, receivers, txId, timeStamp) {
        for (let i = 0; i < receivers.length; i++) {
            const receiver = receivers[i]

            const results = await this.prisma.btcWallet.findMany({
                where: {
                    id: receiver.address.toLowerCase()
                },
                take: 1
            })

            if (results.length == 0) {
                await this.prisma.btcWallet.create({
                    data: {
                        id: receiver.address.toLowerCase(),
                        balance: parseFloat(receiver.value),
                        nonce: 0,
                    }
                }).catch((e) => { })


            } else if (results.length > 0) {
                for (let r = 0; r < results.length; r++) {
                    let oldBalance = parseFloat(results[r].balance)

                    const pkg = {
                        id: receiver.address.toLowerCase(),
                        balance: (oldBalance + receiver.value),
                        nonce: results[r].nonce,
                    }

                    await this.prisma.btcWallet.upsert({
                        where: { id: pkg.id },
                        update: pkg,
                        create: pkg
                    }).catch((e) => { })
                }
            }

            const putPkg = {
                id: md5(`${txId}${receiver.address.toLowerCase()}${receiver.index}`),
                publicKey: receiver.address.toLowerCase(),
                amount: receiver.value.toString(),
                txId: txId,
                type: receiver.type,
                timeStamp: timeStamp
            }

            await this.prisma.output.upsert({
                where: { id: putPkg.id },
                update: putPkg,
                create: putPkg
            }).catch((e) => { })
        }

        for (let i = 0; i < senders.length; i++) {
            const sender = senders[i]
            const results = await this.prisma.btcWallet.findMany({
                where: {
                    id: sender.address.toLowerCase()
                },
                take: 1
            })

            for (let r = 0; r < results.length; r++) {
                let oldBalance = parseFloat(results[r].balance)
                let oldNonce = parseInt(results[r].nonce)

                const pkg = {
                    id: sender.address.toLowerCase(),
                    balance: (oldBalance - sender.value),
                    nonce: (oldNonce++)
                }

                await this.prisma.btcWallet.upsert({
                    where: { id: pkg.id },
                    update: pkg,
                    create: pkg
                }).catch((e) => { })

                const putPkg = {
                    id: md5(`${txId}${sender.address.toLowerCase()}${sender.index}`),
                    publicKey: sender.address.toLowerCase(),
                    amount: parseFloat(sender.value),
                    txId: txId,
                    type: sender.type,
                    timeStamp: timeStamp
                }

                await this.prisma.input.upsert({
                    where: { id: putPkg.id },
                    update: putPkg,
                    create: putPkg
                }).catch((e) => { })
            }
        }
    }

    async fillTransactionBtc(transaction, senders, receivers, block) {
        let amountSent = 0
        let amountReceived = 0
        for (let i = 0; i < senders.length; i++) { amountSent = amountSent + senders[i].value }
        for (let i = 0; i < receivers.length; i++) { amountReceived = amountReceived + receivers[i].value }

        const pkg = {
            id: transaction.txid,
            txHex: transaction.hex,
            amount: amountReceived,
            blockHash: block.hash,
            blockNumber: parseInt(block.height),
            gas: (amountSent - amountReceived),
            timeStamp: parseFloat(block.time),
            coinbase: false
        }

        await this.prisma.btcTransaction.upsert({
            where: { id: pkg.id },
            update: pkg,
            create: pkg
        }).catch((e) => { })
    }

    async fillTransactionEth(transaction, block, type) {

        const pkg = {
            id: transaction.hash,
            from: transaction.from.toLowerCase(),
            to: transaction.to.toLowerCase(),
            amount: parseFloat(transaction.value),
            blockHash: transaction.blockHash,
            blockNumber: parseInt(transaction.blockNumber),
            baseFeePerGas: parseFloat(block.baseFeePerGas),
            gasUsed: parseFloat(transaction.gas),
            gasPrice: parseFloat(transaction.gasPrice),
            feePerGas: parseFloat(transaction.maxFeePerGas),
            priorityFeeperGas: parseFloat(transaction.maxPriorityFeePerGas),
            timeStamp: parseFloat(block.timestamp),
            type: type
        }

        await this.prisma.ethTransaction.upsert({
            where: { id: pkg.id },
            update: pkg,
            create: pkg
        }).catch((e) => { })
    }

    async fillWalletEth(transaction, web3, timeStamp, type) {

        if (type == "toContract") {
            const nonceFrom = await web3.eth.getTransactionCount(transaction.from, 'latest')
            const blanceFromWei = await web3.eth.getBalance(transaction.from)
            const blanceFrom = await web3.utils.fromWei(blanceFromWei, 'ether')
            const balanceFromAtBlock = await web3.eth.getBalance(transaction.from, transaction.blockNumber)

            const pkgFrom = {
                id: transaction.from.toLowerCase(),
                balance: parseFloat(blanceFrom),
                nonce: parseInt(nonceFrom)
            }

            await this.prisma.evmWallet.upsert({
                where: { id: pkgFrom.id },
                update: pkgFrom,
                create: pkgFrom
            }).catch((e) => { })

            await this.prisma.balanceHistoryEth.create({
                data: {
                    id: md5(`${transaction.hash}${transaction.from.toLowerCase()}${transaction.transactionIndex}`),
                    walletId: transaction.from.toLowerCase(),
                    balance: parseFloat(balanceFromAtBlock),
                    timeStamp: timeStamp
                }
            }).catch((e) => { })

        } else if (type == "fromContract") {
            const nonceTo = await web3.eth.getTransactionCount(transaction.to, 'latest')
            const blanceToWei = await web3.eth.getBalance(transaction.to)
            const blanceTo = await web3.utils.fromWei(blanceToWei, 'ether')
            const balanceToAtBlock = await web3.eth.getBalance(transaction.to, transaction.blockNumber)

            const pkgTo = {
                id: transaction.to.toLowerCase(),
                balance: parseFloat(blanceTo),
                nonce: parseInt(nonceTo)
            }

            await this.prisma.evmWallet.upsert({
                where: { id: pkgTo.id },
                update: pkgTo,
                create: pkgTo
            }).catch((e) => { })

            await this.prisma.balanceHistoryEth.create({
                data: {
                    id: md5(`${transaction.hash}${transaction.to.toLowerCase()}${transaction.transactionIndex}`),
                    walletId: transaction.to.toLowerCase(),
                    balance: parseFloat(balanceToAtBlock),
                    timeStamp: timeStamp
                }
            }).catch((e) => { })

        } else if (type == "regular") {
            const nonceTo = await web3.eth.getTransactionCount(transaction.to, 'latest')
            const blanceToWei = await web3.eth.getBalance(transaction.to)
            const blanceTo = await web3.utils.fromWei(blanceToWei, 'ether')

            const nonceFrom = await web3.eth.getTransactionCount(transaction.from, 'latest')
            const blanceFromWei = await web3.eth.getBalance(transaction.from)
            const blanceFrom = await web3.utils.fromWei(blanceFromWei, 'ether')

            const pkgFrom = {
                id: transaction.from.toLowerCase(),
                balance: parseFloat(blanceFrom),
                nonce: parseInt(nonceFrom)
            }

            const pkgTo = {
                id: transaction.to.toLowerCase(),
                balance: parseFloat(blanceTo),
                nonce: parseInt(nonceTo)
            }

            await this.prisma.evmWallet.upsert({
                where: { id: pkgTo.id },
                update: pkgTo,
                create: pkgTo
            }).catch((e) => { })

            await this.prisma.evmWallet.upsert({
                where: { id: pkgFrom.id },
                update: pkgFrom,
                create: pkgFrom
            }).catch((e) => { })

            await this.prisma.balanceHistoryEth.create({
                data: {
                    id: md5(`${transaction.hash}${transaction.from.toLowerCase()}${transaction.transactionIndex}`),
                    walletId: transaction.from.toLowerCase(),
                    balance: parseFloat(blanceFrom),
                    timeStamp: timeStamp
                }
            }).catch((e) => { })

            await this.prisma.balanceHistoryEth.create({
                data: {
                    id: md5(`${transaction.hash}${transaction.to.toLowerCase()}${transaction.transactionIndex}`),
                    walletId: transaction.to.toLowerCase(),
                    balance: parseFloat(blanceTo),
                    timeStamp: timeStamp
                }
            }).catch((e) => { })
        }
    }
}

// function trashboat() {
//     const outPutResults = await this.prisma.output.findMany({
//         where: {
//             publicKey: receiver.address.toLowerCase(),
//             timeStamp: {
//                 lte: parseFloat(block.time)
//             }
//         }
//     })
//     let outputAmounts = 0
//     for (let o = 0; o < outPutResults.length; o++) { outputAmounts += outPutResults[o].amount }

//     const inPutResults = await this.prisma.input.findMany({
//         where: {
//             publicKey: receiver.address.toLowerCase(),
//             timeStamp: {
//                 lte: parseFloat(block.time)
//             }
//         }
//     })
//     let inputAmounts = 0
//     for (let l = 0; l < inPutResults.length; l++) { inputAmounts += inPutResults[l].amount }

//     let newBalance = 0
//     if (inputAmounts == 0) {
//         newBalance = outputAmounts
//     } else {
//         newBalance = outputAmounts - inputAmounts
//     }

//     await this.prisma.balanceHistoryBtc.create({
//         data: {
//             id: md5(`${transaction.txid}${receiver.address.toLowerCase()}${receiver.index}`),
//             walletId: receiver.address.toLowerCase(),
//             balance: newBalance,
//             timeStamp: parseFloat(block.time),
//         }
//     }).catch((e) => { })
// }