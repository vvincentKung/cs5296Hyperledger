# Hyperledger and Hyperledger Caliper

##Testing Environment
Ubuntu 20.04

## Prerequisite software

#### Install Git
    sudo apt install git

#### Install curl
    sudo apt-get install curl

#### Install nodejs and npm
    sudo apt install nodejs npm

#### Install docker-compose
    sudo apt-get -y install docker-compose

#### Start the docker
"username" is mean your user accout (e.g. ubuntu)

    sudo systemctl start docker
	sudo systemctl enable docker
	sudo usermod -a -G docker <username>

#### fabric-peer, fabric-orderer, fabric-tools
Please install the last version of fabric-peer, fabric-orderer, fabric-tools

    sudo docker pull hyperledger/fabric-peer:2.4
    sudo docker tag hyperledger/fabric-peer:2.4 hyperledger/fabric-peer:latest
    sudo docker pull hyperledger/fabric-orderer:2.4
    sudo docker tag hyperledger/fabric-orderer:2.4 hyperledger/fabric-orderer:latest
    sudo docker pull hyperledger/fabric-tools:2.4
    sudo docker tag hyperledger/fabric-tools:2.4 hyperledger/fabric-tools:latest

#### Pull the Repository
    git clone https://github.com/vvincentKung/cs5296Hyperledger.git

## Start up the network

1. Initialize the network
    cd cs5296project/my-fabric/my-network/
    sudo ./network.sh up createChannel -c mychannel -ca

2. Initialize the chaincode
    cd ../asset-transfer-basic/chaincode-typescript
	npm install && npm run build

3. Bind the chaincode to the network
        cd ../../my-network/
		sudo ./network.sh deployCC -ccn basic -ccp ../asset-transfer-basic/chaincode-typescript/ -ccl typescript

4. After the chaincide is binded to the network, some new files would be created. These files are used for Hyperledger Caliper testing. We need to  change the permission of these files,
        sudo chmod -R ugo+rwx /organizations/peerOrganizations/org1.example.com/users/