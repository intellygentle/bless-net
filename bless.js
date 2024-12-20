const fs = require('fs').promises;
const readline = require('readline');
const os = require('os');  // To check local network IP

const apiBaseUrl = "https://gateway-run.bls.dev/api/v1";
const ipServiceUrl = "https://tight-block-2413.txlabs.workers.dev";

// Utility function to validate IP address format
function isValidIP(ip) {
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
}

async function loadFetch() {
    const fetch = await import('node-fetch').then(module => module.default);
    return fetch;
}

async function promptInput(promptMessage) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        rl.question(promptMessage, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function createIdFile() {
    const ids = [];
    console.log("Enter node IDs and hardware IDs in the format nodeId:hardwareId. Type 'done' to finish.");

    while (true) {
        const input = await promptInput("Node ID and Hardware ID: ");
        if (input.toLowerCase() === 'done') break;
        if (input.includes(':')) {
            ids.push(input);
        } else {
            console.log("Invalid format. Please use nodeId:hardwareId.");
        }
    }

    await fs.writeFile('id.txt', ids.join('\n'), 'utf-8');
    console.log("id.txt has been created.");
}

async function createUserFile() {
    const authToken = await promptInput("Enter your user auth bearer token: ");
    await fs.writeFile('user.txt', authToken, 'utf-8');
    console.log("user.txt has been created.");
}

async function readNodeAndHardwareIds() {
    const data = await fs.readFile('id.txt', 'utf-8');
    const ids = data.trim().split('\n').filter(id => id).map(id => {
        const [nodeId, hardwareId] = id.split(':');
        return { nodeId, hardwareId };
    });
    return ids;
}

async function readAuthToken() {
    const data = await fs.readFile('user.txt', 'utf-8');
    return data.trim();
}

async function fetchIpAddress(fetch) {
    let ipAddress = await promptInput("Would you like to (1) Enter your IP address manually, (2) Fetch IP from service, or (3) Use local network IP? (1/2/3): ");
    
    if (ipAddress === '1') {
        ipAddress = await promptInput("Please enter your IP address: ");
        // Validate the entered IP address
        if (!isValidIP(ipAddress)) {
            console.log("Invalid IP address format. Please enter a valid IPv4 address.");
            return fetchIpAddress(fetch); // Retry if invalid
        }
    } else if (ipAddress === '2') {
        // Fetch IP using external service
        const response = await fetch(ipServiceUrl);
        const data = await response.json();
        console.log(`[${new Date().toISOString()}] IP fetch response:`, data);
        ipAddress = data.ip;
    } else if (ipAddress === '3') {
        // Query local network IP
        ipAddress = getLocalIpAddress();
        console.log(`[${new Date().toISOString()}] Local network IP:`, ipAddress);
    } else {
        console.log("Invalid option. Defaulting to fetching IP from the external service.");
        // Default to external service
        const response = await fetch(ipServiceUrl);
        const data = await response.json();
        ipAddress = data.ip;
    }

    return ipAddress;
}

// Function to get local IP address from the network
function getLocalIpAddress() {
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces) {
        for (const interfaceDetails of networkInterfaces[interfaceName]) {
            if (!interfaceDetails.internal && interfaceDetails.family === 'IPv4') {
                return interfaceDetails.address;
            }
        }
    }
    return '127.0.0.1'; // Default to localhost if no external IP found
}

async function registerNode(nodeId, hardwareId, ipAddress) {
    const fetch = await loadFetch();
    const authToken = await readAuthToken();

    const registerUrl = `${apiBaseUrl}/nodes/${nodeId}`;
    console.log(`[${new Date().toISOString()}] Registering node with IP: ${ipAddress}, Hardware ID: ${hardwareId}`);
    const response = await fetch(registerUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
            ipAddress,
            hardwareId
        })
    });

    let data;
    try {
        data = await response.json();
    } catch (error) {
        const text = await response.text();
        console.error(`[${new Date().toISOString()}] Failed to parse JSON. Response text:`, text);
        throw error;
    }

    console.log(`[${new Date().toISOString()}] Registration response:`, data);
    return data;
}

async function startSession(nodeId) {
    const fetch = await loadFetch();
    const authToken = await readAuthToken();

    const startSessionUrl = `${apiBaseUrl}/nodes/${nodeId}/start-session`;
    console.log(`[${new Date().toISOString()}] Starting session for node ${nodeId}, it might take a while...`);
    const response = await fetch(startSessionUrl, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${authToken}`
        }
    });
    const data = await response.json();
    console.log(`[${new Date().toISOString()}] Start session response:`, data);
    return data;
}

async function pingNode(nodeId, ipAddress) {
    const fetch = await loadFetch();
    const chalk = await import('chalk');
    const authToken = await readAuthToken();

    const pingUrl = `${apiBaseUrl}/nodes/${nodeId}/ping`;
    console.log(`[${new Date().toISOString()}] Pinging node ${nodeId} with IP: ${ipAddress}`);
    const response = await fetch(pingUrl, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${authToken}`
        }
    });

    const data = await response.json();
    
    const status = data.status;
    const logMessage = `[${new Date().toISOString()}] Ping response, NodeID: ${chalk.default.green(nodeId)}, Status: ${chalk.default.yellow(status)}, IP: ${ipAddress}`;
    console.log(logMessage);
    
    return data;
}


async function displayHeader() {
    console.log("");
    console.log(`██╗███╗   ██╗████████╗███████╗██╗     ██╗     `);
    console.log(`██║████╗  ██║╚══██╔══╝██╔════╝██║     ██║     `);
    console.log(`██║██╔██╗ ██║   ██║   █████╗  ██║     ██║     `);
    console.log(`██║██║╚██╗██║   ██║   ██╔══╝  ██║     ██║     `);
    console.log(`██║██║ ╚████║   ██║   ███████╗███████╗███████╗`);
    console.log(`╚═╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝╚══════╝╚══════╝`);
    console.log(`   follow on X --> https://x.com/Intellygentle`);
    console.log(`     Reachout to me on X for questions        `);
    console.log("");
}


async function processNode(nodeId, hardwareId, ipAddress) {
    while (true) {
        try {
            console.log(`[${new Date().toISOString()}] Processing nodeId: ${nodeId}, hardwareId: ${hardwareId}, IP: ${ipAddress}`);
            
            const registrationResponse = await registerNode(nodeId, hardwareId, ipAddress);
            console.log(`[${new Date().toISOString()}] Node registration completed for nodeId: ${nodeId}. Response:`, registrationResponse);
            
            const startSessionResponse = await startSession(nodeId);
            console.log(`[${new Date().toISOString()}] Session started for nodeId: ${nodeId}. Response:`, startSessionResponse);
            
            console.log(`[${new Date().toISOString()}] Sending initial ping for nodeId: ${nodeId}`);
            await pingNode(nodeId, ipAddress);

            setInterval(async () => {
                try {
                    console.log(`[${new Date().toISOString()}] Sending ping for nodeId: ${nodeId}`);
                    await pingNode(nodeId, ipAddress);
                } catch (error) {
                    console.error(`[${new Date().toISOString()}] Error during ping: ${error.message}`);
                    throw error;
                }
            }, 60000);
            
            break;

        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error occurred for nodeId: ${nodeId}, restarting process: ${error.message}`);
        }
    }
}

async function runAll(initialRun = true) {
    try {
        if (initialRun) {
            await displayHeader();
            await createIdFile();
            await createUserFile();
        }

        const ids = await readNodeAndHardwareIds();
        const ipAddress = await fetchIpAddress(await loadFetch());

        for (let i = 0; i < ids.length; i++) {
            const { nodeId, hardwareId } = ids[i];
            processNode(nodeId, hardwareId, ipAddress);
        }
    } catch (error) {
        const chalk = await import('chalk');
        console.error(chalk.default.yellow(`[${new Date().toISOString()}] An error occurred: ${error.message}`));
    }
}

process.on('uncaughtException', (error) => {
    console.error(`[${new Date().toISOString()}] Uncaught exception: ${error.message}`);
    runAll(false);
});

runAll();
