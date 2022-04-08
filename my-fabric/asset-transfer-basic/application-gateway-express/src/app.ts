import * as grpc from '@grpc/grpc-js';
import { connect, Contract, Gateway, Identity, Signer, signers } from '@hyperledger/fabric-gateway';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { TextDecoder } from 'util';
import express from 'express';


const channelName = envOrDefault('CHANNEL_NAME', 'mychannel');
const chaincodeName = envOrDefault('CHAINCODE_NAME', 'basic');
const mspId = envOrDefault('MSP_ID', 'Org1MSP');

// Path to crypto materials.
const cryptoPath = envOrDefault('CRYPTO_PATH', path.resolve(__dirname, '..', '..', '..', 'my-network', 'organizations', 'peerOrganizations', 'org1.example.com'));

// Path to user private key directory.
const keyDirectoryPath = envOrDefault('KEY_DIRECTORY_PATH', path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'keystore'));

// Path to user certificate.
const certPath = envOrDefault('CERT_PATH', path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'signcerts', 'cert.pem'));

// Path to peer tls certificate.
const tlsCertPath = envOrDefault('TLS_CERT_PATH', path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt'));

// Gateway peer endpoint.
const peerEndpoint = envOrDefault('PEER_ENDPOINT', 'localhost:7051');

// Gateway peer SSL host name override.
const peerHostAlias = envOrDefault('PEER_HOST_ALIAS', 'peer0.org1.example.com');

const utf8Decoder = new TextDecoder();
// const assetId = `asset${Date.now()}`;

// const express = require('express')
const app = express()
const port = 3000;

var client: grpc.Client;
var gateway: Gateway;

async function main(): Promise<void> {

    await displayInputParameters();

    // The gRPC client connection should be shared by all Gateway connections to this endpoint.

    client = await newGrpcConnection();

    gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
        // Default timeouts for different gRPC calls
        evaluateOptions: () => {
            return { deadline: Date.now() + 5000 }; // 5 seconds
        },
        endorseOptions: () => {
            return { deadline: Date.now() + 15000 }; // 15 seconds
        },
        submitOptions: () => {
            return { deadline: Date.now() + 5000 }; // 5 seconds
        },
        commitStatusOptions: () => {
            return { deadline: Date.now() + 60000 }; // 1 minute
        },
    });

    // try {
    //     // Get a network instance representing the channel where the smart contract is deployed.
    //     const network = gateway.getNetwork(channelName);

    //     // Get the smart contract from the network.
    //     const contract = network.getContract(chaincodeName);

    //     // Initialize a set of asset data on the ledger using the chaincode 'InitLedger' function.
    //     await initLedger(contract);

    //     // Return all the current assets on the ledger.
    //     // await getAllAssets(contract);

    //     // // Create a new asset on the ledger.
    //     // await createAsset(contract);

    //     // // Update an existing asset asynchronously.
    //     // await transferAssetAsync(contract);

    //     // // Get the asset details by assetID.
    //     // await readAssetByID(contract);

    //     // // Update an asset which does not exist.
    //     // await updateNonExistentAsset(contract)
    // } finally {
    //     gateway.close();
    //     client.close();
    // }
}

main().catch(error => {
    console.error('******** FAILED to run the application:', error);
    process.exitCode = 1;
});

async function newGrpcConnection(): Promise<grpc.Client> {
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
}

async function newIdentity(): Promise<Identity> {
    const credentials = await fs.readFile(certPath);
    return { mspId, credentials };
}

async function newSigner(): Promise<Signer> {
    const files = await fs.readdir(keyDirectoryPath);
    const keyPath = path.resolve(keyDirectoryPath, files[0]);
    const privateKeyPem = await fs.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}

/**
 * This type of transaction would typically only be run once by an application the first time it was started after its
 * initial deployment. A new version of the chaincode deployed later would likely not need to run an "init" function.
 */
async function initLedger(contract: Contract): Promise<void> {
    console.log('\n--> Submit Transaction: InitLedger, function creates the initial set of assets on the ledger');

    await contract.submitTransaction('InitLedger');

    console.log('*** Transaction committed successfully');
}

/**
 * Evaluate a transaction to query ledger state.
 */
async function getAllAssets(contract: Contract): Promise<any> {

    const resultBytes = await contract.evaluateTransaction('GetAllAssets');

    const resultJson = utf8Decoder.decode(resultBytes);
    const result = JSON.parse(resultJson);
    console.log('*** Result:', result);

    return result;
}

/**
 * Submit a transaction synchronously, blocking until it has been committed to the ledger.
 */
async function createAsset(contract: Contract, id: string, user: string, inTime: string, outTime: string): Promise<void> {
    console.log('\n--> Submit Transaction: CreateAsset, creates new asset with ID, Color, Size, Owner and AppraisedValue arguments');

    await contract.submitTransaction(
        'CreateAsset',
        id,
        user,
        inTime,
        outTime,
    );

    console.log('*** CreateAsset successfully\n', `Asset`);
}

async function updateAsset(contract: Contract, id: string, user?: string, inTime?: string, outTime?: string): Promise<void> {
    console.log('\n--> Submit Transaction: UpdateAsset asset70, asset70 does not exist and should return an error');

    const resultBytes = await contract.evaluateTransaction('ReadAsset', id);
    const resultJson = utf8Decoder.decode(resultBytes);
    const result = JSON.parse(resultJson);

    try {
        await contract.submitTransaction(
            'UpdateAsset',
            id,
            user ?? result.User,
            inTime ?? result.InTime,
            outTime ?? result.OutTime,
        );
        console.log('******** SUCCESSED to update asset');
    } catch (error) {
        console.log('*** FAILED to update asset: \n', error);
    }
}

async function readAssetByID(contract: Contract, id: string): Promise<any> {
    console.log('\n--> Evaluate Transaction: ReadAsset, function returns asset attributes');

    const resultBytes = await contract.evaluateTransaction('ReadAsset', id);
    const resultJson = utf8Decoder.decode(resultBytes);
    const result = JSON.parse(resultJson);

    console.log('*** Result:', result);

    return result;
}

/**
 * Submit transaction asynchronously, allowing the application to process the smart contract response (e.g. update a UI)
 * while waiting for the commit notification.
 */
async function transferAssetAsync(contract: Contract, id: string, user: string): Promise<void> {
    console.log('\n--> Async Submit Transaction: TransferAsset, updates existing asset owner');

    const commit = await contract.submitAsync('TransferAsset', {
        arguments: [id, user],
    });
    const oldOwner = utf8Decoder.decode(commit.getResult());

    console.log(`*** Successfully submitted transaction to transfer ownership from ${oldOwner} to Saptha`);
    console.log('*** Waiting for transaction commit');

    const status = await commit.getStatus();
    if (!status.successful) {
        throw new Error(`Transaction ${status.transactionId} failed to commit with status code ${status.code}`);
    }

    console.log('*** Transaction committed successfully');
}

/**
 * submitTransaction() will throw an error containing details of any error responses from the smart contract.
 */
// async function updateNonExistentAsset(contract: Contract): Promise<void> {
//     console.log('\n--> Submit Transaction: UpdateAsset asset70, asset70 does not exist and should return an error');

//     try {
//         await contract.submitTransaction(
//             'UpdateAsset',
//             'asset70',
//             'Tomoko',
//             '14:00',
//             '17:00',
//         );
//         console.log('******** FAILED to return an error');
//     } catch (error) {
//         console.log('*** Successfully caught the error: \n', error);
//     }
// }

app.get('/', async (req, res) => {
    // res.send('Hello World!')
    // await displayInputParameters();

    // The gRPC client connection should be shared by all Gateway connections to this endpoint.
    // client = await newGrpcConnection();

    // gateway = connect({
    //     client,
    //     identity: await newIdentity(),
    //     signer: await newSigner(),
    //     // Default timeouts for different gRPC calls
    //     evaluateOptions: () => {
    //         return { deadline: Date.now() + 5000 }; // 5 seconds
    //     },
    //     endorseOptions: () => {
    //         return { deadline: Date.now() + 15000 }; // 15 seconds
    //     },
    //     submitOptions: () => {
    //         return { deadline: Date.now() + 5000 }; // 5 seconds
    //     },
    //     commitStatusOptions: () => {
    //         return { deadline: Date.now() + 60000 }; // 1 minute
    //     },
    // });

    try {
        // Get a network instance representing the channel where the smart contract is deployed.
        const network = gateway.getNetwork(channelName);

        // Get the smart contract from the network.
        const contract = network.getContract(chaincodeName);

        // Initialize a set of asset data on the ledger using the chaincode 'InitLedger' function.
        await initLedger(contract);


        res.status(200).send("InitLedger success");
    } catch (e) {
        res.status(400).send(e);
    } finally {
        // gateway.close();
        // client.close();
    }
})

app.post('/create', async (req, res) => {
    // const id = req.body.id;
    const user = req.body.user;
    const inTime = req.body.inTime;
    const outTime = req.body.outTime;

    if (user == undefined || user == null) {
        res.status(400).send("user is required");
        return;
    }

    if (inTime == undefined || inTime == null) {
        res.status(400).send("In Time is required");
        return;
    }

    if (outTime == undefined || outTime == null) {
        res.status(400).send("Out Time is required");
        return;
    }

    // const client = await newGrpcConnection();
    // const gateway = connect({
    //     client,
    //     identity: await newIdentity(),
    //     signer: await newSigner(),
    //     // Default timeouts for different gRPC calls
    //     evaluateOptions: () => {
    //         return { deadline: Date.now() + 5000 }; // 5 seconds
    //     },
    //     endorseOptions: () => {
    //         return { deadline: Date.now() + 15000 }; // 15 seconds
    //     },
    //     submitOptions: () => {
    //         return { deadline: Date.now() + 5000 }; // 5 seconds
    //     },
    //     commitStatusOptions: () => {
    //         return { deadline: Date.now() + 60000 }; // 1 minute
    //     },
    // });

    try {
        // Get a network instance representing the channel where the smart contract is deployed.
        const network = gateway.getNetwork(channelName);

        // Get the smart contract from the network.
        const contract = network.getContract(chaincodeName);
        const assetId = `asset_${Date.now()}`;
        await createAsset(contract, assetId, user, inTime, outTime);
        res.status(200).send(`Asset: ${assetId} updated successfully.`);

    } catch (e) {
        res.status(400).send(e);
    } finally {
        // gateway.close();
        // client.close();
    }
})

app.post('/update', async (req, res) => {
    // res.send('Update Asset')
    const id = req.body.id;
    const user = req.body.user;
    const inTime = req.body.inTime;
    const outTime = req.body.outTime;

    if (id == undefined || id == null) {
        res.status(400).send("id is required");
    }

    // const client = await newGrpcConnection();
    // const gateway = connect({
    //     client,
    //     identity: await newIdentity(),
    //     signer: await newSigner(),
    //     // Default timeouts for different gRPC calls
    //     evaluateOptions: () => {
    //         return { deadline: Date.now() + 5000 }; // 5 seconds
    //     },
    //     endorseOptions: () => {
    //         return { deadline: Date.now() + 15000 }; // 15 seconds
    //     },
    //     submitOptions: () => {
    //         return { deadline: Date.now() + 5000 }; // 5 seconds
    //     },
    //     commitStatusOptions: () => {
    //         return { deadline: Date.now() + 60000 }; // 1 minute
    //     },
    // });

    try {
        // Get a network instance representing the channel where the smart contract is deployed.
        const network = gateway.getNetwork(channelName);

        // Get the smart contract from the network.
        const contract = network.getContract(chaincodeName);
        await updateAsset(contract, id, user, inTime, outTime);
        res.status(200).send(`Asset: ${id} updated successfully.`);

    } catch (e) {
        res.status(400).send(e);
    } finally {
        // gateway.close();
        // client.close();
    }
})

app.get('/readAll', async (req, res) => {
    // res.send('Read All Assets');

    // const client = await newGrpcConnection();
    // const gateway = connect({
    //     client,
    //     identity: await newIdentity(),
    //     signer: await newSigner(),
    //     // Default timeouts for different gRPC calls
    //     evaluateOptions: () => {
    //         return { deadline: Date.now() + 5000 }; // 5 seconds
    //     },
    //     endorseOptions: () => {
    //         return { deadline: Date.now() + 15000 }; // 15 seconds
    //     },
    //     submitOptions: () => {
    //         return { deadline: Date.now() + 5000 }; // 5 seconds
    //     },
    //     commitStatusOptions: () => {
    //         return { deadline: Date.now() + 60000 }; // 1 minute
    //     },
    // });

    try {
        // Get a network instance representing the channel where the smart contract is deployed.
        const network = gateway.getNetwork(channelName);

        // Get the smart contract from the network.
        const contract = network.getContract(chaincodeName);

        const results = getAllAssets(contract);
        res.json(results);

    } catch (e) {
        res.status(400).send(e);
    } finally {
        // gateway.close();
        // client.close();
    }


})

app.get('/read', async (req, res) => {
    // res.send(`Read Asset: ${id}`)
    const id: string = req.query.id as string;

    if (id == undefined || id == null) {
        res.status(400).json({ code: 400, message: "id is required" });
    }

    // const client = await newGrpcConnection();
    // const gateway = connect({
    //     client,
    //     identity: await newIdentity(),
    //     signer: await newSigner(),
    //     // Default timeouts for different gRPC calls
    //     evaluateOptions: () => {
    //         return { deadline: Date.now() + 5000 }; // 5 seconds
    //     },
    //     endorseOptions: () => {
    //         return { deadline: Date.now() + 15000 }; // 15 seconds
    //     },
    //     submitOptions: () => {
    //         return { deadline: Date.now() + 5000 }; // 5 seconds
    //     },
    //     commitStatusOptions: () => {
    //         return { deadline: Date.now() + 60000 }; // 1 minute
    //     },
    // });

    try {
        // Get a network instance representing the channel where the smart contract is deployed.
        const network = gateway.getNetwork(channelName);

        // Get the smart contract from the network.
        const contract = network.getContract(chaincodeName);
        const results = await readAssetByID(contract, id);
        res.json(results);

    } catch (e) {
        res.status(400).send(e);
    } finally {
        // gateway.close();
        // client.close();
    }
})

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})

function envOrDefault(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
}

async function displayInputParameters(): Promise<void> {
    console.log(`channelName:       ${channelName}`);
    console.log(`chaincodeName:     ${chaincodeName}`);
    console.log(`mspId:             ${mspId}`);
    console.log(`cryptoPath:        ${cryptoPath}`);
    console.log(`keyDirectoryPath:  ${keyDirectoryPath}`);
    console.log(`certPath:          ${certPath}`);
    console.log(`tlsCertPath:       ${tlsCertPath}`);
    console.log(`peerEndpoint:      ${peerEndpoint}`);
    console.log(`peerHostAlias:     ${peerHostAlias}`);
}



