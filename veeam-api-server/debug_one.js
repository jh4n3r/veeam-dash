const axios = require('axios');
const https = require('https');

const ONE_SERVER = "192.168.150.12";
const ONE_PORT = "1239";
const ONE_USER = "VEEAM-SERVER\\Administrador"; // Note the double backslash for JS string
const ONE_PASS = "ymM3Pp78Bj!*";

const oneAgent = new https.Agent({ rejectUnauthorized: false });

async function testOne() {
    console.log("Testing Veeam ONE connection...");
    console.log(`URL: https://${ONE_SERVER}:${ONE_PORT}/api/token`);
    console.log(`User: ${ONE_USER}`);

    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', ONE_USER);
    params.append('password', ONE_PASS);

    try {
        // 1. Get Token
        const tokenResponse = await axios.post(
            `https://${ONE_SERVER}:${ONE_PORT}/api/token`,
            params,
            {
                httpsAgent: oneAgent,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }
        );

        console.log("Token obtained successfully!");
        const token = tokenResponse.data.access_token;

        // 2. Get Tape Jobs
        console.log("Fetching Tape Jobs...");
        const jobsResponse = await axios.get(
            `https://${ONE_SERVER}:${ONE_PORT}/api/v2.2/vbrJobs/backupToTapeJobs`,
            {
                httpsAgent: oneAgent,
                headers: { 'Authorization': `Bearer ${token}` }
            }
        );

        console.log("Tape Jobs Response Status:", jobsResponse.status);
        console.log("Data items count:", (jobsResponse.data.items || []).length);
        if (jobsResponse.data.items && jobsResponse.data.items.length > 0) {
            console.log("Sample Job:", JSON.stringify(jobsResponse.data.items[0], null, 2));
        } else {
            console.log("No items found or different structure:", Object.keys(jobsResponse.data));
        }

    } catch (error) {
        console.error("ERROR:");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        } else {
            console.error(error.message);
        }
    }
}

testOne();
