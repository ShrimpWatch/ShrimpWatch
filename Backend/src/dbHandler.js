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
                const pkg = {
                    id: receiver.address.toLowerCase(),
                    balance: parseFloat(receiver.value),
                    nonce: 0,
                }

                await this.prisma.btcWallet.upsert({
                    where: { id: pkg.id },
                    update: pkg,
                    create: pkg
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
                const pkg = {
                    id: receiver.address.toLowerCase(),
                    balance: parseFloat(receiver.value),
                    nonce: 0,
                }

                await this.prisma.btcWallet.upsert({
                    where: { id: pkg.id },
                    update: pkg,
                    create: pkg
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
                let newBalance = oldBalance - sender.value

                if (newBalance < 0 && newBalance > -0.1) { newBalance = 0 }

                const pkg = {
                    id: sender.address.toLowerCase(),
                    balance: newBalance,
                    nonce: oldNonce += 1
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

    async fillWalletEthToContract(transaction, timeStamp, nonceFrom, balanceFrom, balanceFromAtBlock) {
        const pkgFrom = {
            id: transaction.from.toLowerCase(),
            balance: parseFloat(balanceFrom),
            nonce: parseInt(nonceFrom)
        }

        await this.prisma.evmWallet.upsert({
            where: { id: pkgFrom.id },
            update: pkgFrom,
            create: pkgFrom
        }).catch((e) => { })

        const pkgFromHistory = {
            id: md5(`${transaction.hash}${transaction.from.toLowerCase()}${transaction.transactionIndex}`),
            walletId: transaction.from.toLowerCase(),
            balance: parseFloat(balanceFromAtBlock),
            timeStamp: timeStamp
        }

        await this.prisma.balanceHistoryEth.upsert({
            where: { id: pkgFromHistory.id },
            update: pkgFromHistory,
            create: pkgFromHistory
        }).catch((e) => { })
    }

    async fillWalletEthFromContract(transaction, timeStamp, nonceTo, balanceTo, balanceToAtBlock) {
        const pkgTo = {
            id: transaction.to.toLowerCase(),
            balance: parseFloat(balanceTo),
            nonce: parseInt(nonceTo)
        }

        await this.prisma.evmWallet.upsert({
            where: { id: pkgTo.id },
            update: pkgTo,
            create: pkgTo
        }).catch((e) => { })

        const pkgToHistory = {
            id: md5(`${transaction.hash}${transaction.to.toLowerCase()}${transaction.transactionIndex}`),
            walletId: transaction.to.toLowerCase(),
            balance: parseFloat(balanceToAtBlock),
            timeStamp: timeStamp
        }

        await this.prisma.balanceHistoryEth.upsert({
            where: { id: pkgToHistory.id },
            update: pkgToHistory,
            create: pkgToHistory
        }).catch((e) => { })
    }

    async fillWalletEth(transaction, timeStamp, nonceTo, nonceFrom, balanceTo, balanceFrom) {

        const pkgFrom = {
            id: transaction.from.toLowerCase(),
            balance: parseFloat(balanceFrom),
            nonce: parseInt(nonceFrom)
        }

        const pkgTo = {
            id: transaction.to.toLowerCase(),
            balance: parseFloat(balanceTo),
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

        const pkgToHistory = {
            id: md5(`${transaction.hash}${transaction.to.toLowerCase()}${transaction.transactionIndex}`),
            walletId: transaction.to.toLowerCase(),
            balance: parseFloat(balanceTo),
            timeStamp: timeStamp
        }

        const pkgFromHistory = {
            id: md5(`${transaction.hash}${transaction.from.toLowerCase()}${transaction.transactionIndex}`),
            walletId: transaction.from.toLowerCase(),
            balance: parseFloat(balanceFrom),
            timeStamp: timeStamp
        }

        await this.prisma.balanceHistoryEth.upsert({
            where: { id: pkgToHistory.id },
            update: pkgToHistory,
            create: pkgToHistory
        }).catch((e) => { })

        await this.prisma.balanceHistoryEth.upsert({
            where: { id: pkgFromHistory.id },
            update: pkgFromHistory,
            create: pkgFromHistory
        }).catch((e) => { })

    }
}