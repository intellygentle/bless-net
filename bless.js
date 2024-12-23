const fs = require('fs').promises;
const readline = require('readline');
const path = require('path');
const os = require('os');

const apiBaseUrl = "https://gateway-run.bls.dev/api/v1";
const ipServiceUrl = "https://tight-block-2413.txlabs.workers.dev";

// Utility function for user input
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

// Utility function to validate IP format
function isValidIP(ip) {
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
}

// Utility function to fetch the local network IP
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
        for (const details of interfaces[name]) {
            if (!details.internal && details.family === 'IPv4') {
                return details.address;
            }
        }
    }
    return '127.0.0.1';
}

// Fetch the public IP or use local IP
async function fetchIpAddress(fetch) {
    const choice = await promptInput("Choose IP option: (1) Manual, (2) Fetch from Service, (3) Local network IP (1/2/3): ");
    let ipAddress;

    switch (choice) {
        case '1':
            ipAddress = await promptInput("Enter your IP address: ");
            if (!isValidIP(ipAddress)) {
                console.error("Invalid IP address. Please try again.");
                return fetchIpAddress(fetch);
            }
            break;
        case '2':
            ipAddress = await retryFetch(ipServiceUrl, {}, true).then(response => response.json()).then(data => data.ip);
            break;
        case '3':
            ipAddress = getLocalIpAddress();
            break;
        default:
            console.error("Invalid choice. Defaulting to external IP service.");
            ipAddress = await retryFetch(ipServiceUrl, {}, true).then(response => response.json()).then(data => data.ip);
    }

    console.log(`Using IP address: ${ipAddress}`);
    return ipAddress;
}

// Prompt and validate `user.txt` and `id.txt`
async function setupFiles() {
    try {
        const userFilePath = path.resolve(__dirname, 'user.txt');
        let userContent = await fs.readFile(userFilePath, 'utf-8').catch(() => null);
        if (!userContent) {
            userContent = await promptInput("Enter your authentication token for user.txt: ");
            await fs.writeFile(userFilePath, userContent.trim(), 'utf-8');
            console.log("user.txt has been updated.");
        }

        const idFilePath = path.resolve(__dirname, 'id.txt');
        let idContent = await fs.readFile(idFilePath, 'utf-8').catch(() => null);
        if (!idContent) {
            console.log("Enter node IDs and hardware IDs in the format 'nodeId:hardwareId', one per line.");
            idContent = await promptInput("Enter IDs for id.txt: ");
            await fs.writeFile(idFilePath, idContent.trim(), 'utf-8');
            console.log("id.txt has been updated.");
        }
    } catch (error) {
        console.error(`Error during file setup: ${error.message}`);
        throw error;
    }
}

// Retry function for fetch requests
async function retryFetch(url, options, infiniteRetry = false, retries = 3, delay = 1000) {
    while (true) {
        try {
            const response = await fetch(url, { ...options, timeout: 30000 }); // 30-second timeout
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.statusText}`);
            }
            return response;
        } catch (error) {
            if (!infiniteRetry && retries === 0) {
                throw error;
            }
            console.error(`Retrying request to ${url} due to error: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, delay)); // wait before retry
            retries = infiniteRetry ? retries : retries - 1;
        }
    }
}

// Main function to run the program
async function runAll() {
    const fetch = await import('node-fetch').then(module => module.default);
    await setupFiles();

    const idsContent = await fs.readFile(path.resolve(__dirname, 'id.txt'), 'utf-8');
    const ids = idsContent
        .trim()
        .split('\n')
        .map(line => {
            const [nodeId, hardwareId] = line.split(':');
            return { nodeId, hardwareId };
        });

    const ipAddress = await fetchIpAddress(fetch);

    for (const { nodeId, hardwareId } of ids) {
        if (!nodeId || !hardwareId) {
            console.error(`Invalid ID entry: nodeId=${nodeId}, hardwareId=${hardwareId}`);
            continue;
        }

        while (true) {
            try {
                const authToken = (await fs.readFile(path.resolve(__dirname, 'user.txt'), 'utf-8')).trim();

                // Register Node
                const regResponse = await retryFetch(`${apiBaseUrl}/nodes/${nodeId}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ ipAddress, hardwareId })
                }, true);
                const regData = await regResponse.json();
                console.log(`[${new Date().toISOString()}] Registration response for ${nodeId}:`, regData);

                // Start Session
                const sessionResponse = await retryFetch(`${apiBaseUrl}/nodes/${nodeId}/start-session`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${authToken}` }
                }, true);
                const sessionData = await sessionResponse.json();
                console.log(`[${new Date().toISOString()}] Session started for ${nodeId}:`, sessionData);

                // Ping Node and check isB7SConnected
                const pingNode = async () => {
                    const pingResponse = await retryFetch(`${apiBaseUrl}/nodes/${nodeId}/ping`, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${authToken}` }
                    });
                    const pingData = await pingResponse.json();
                    console.log(`[${new Date().toISOString()}] Ping response for ${nodeId}:`, pingData);

                    if (pingData.isB7SConnected) {
                        console.log(`[${new Date().toISOString()}] Node ${nodeId} is now connected to B7S.`);
                    }
                };

                // Initial ping
                await pingNode();

                // Set up interval for periodic pings
                setInterval(pingNode, 60000); // Ping every 60 seconds
                break;
            } catch (error) {
                console.error(`[${new Date().toISOString()}] Error processing node ${nodeId}. Retrying: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, 5000)); // Retry after delay
            }
        }
    }
}

runAll();
