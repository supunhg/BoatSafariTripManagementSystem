// Test script to check schedule API endpoints
const http = require('http');

function makeRequest(path, method = 'GET') {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({ status: res.statusCode, data: jsonData });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.end();
    });
}

async function testScheduleAPI() {
    try {
        console.log('Testing schedule API endpoints...\n');
        
        // Test 1: Get all schedules
        console.log('1. Testing GET /api/dashboard/schedules');
        const schedulesResponse = await makeRequest('/api/dashboard/schedules');
        console.log('Status:', schedulesResponse.status);
        console.log('Response:', JSON.stringify(schedulesResponse.data, null, 2));
        
        if (schedulesResponse.status === 200 && schedulesResponse.data.length > 0) {
            const firstScheduleId = schedulesResponse.data[0].id;
            console.log(`\n2. Testing GET /api/dashboard/schedules/${firstScheduleId}`);
            
            // Test 2: Get specific schedule
            const scheduleResponse = await makeRequest(`/api/dashboard/schedules/${firstScheduleId}`);
            console.log('Status:', scheduleResponse.status);
            console.log('Response:', JSON.stringify(scheduleResponse.data, null, 2));
        } else {
            console.log('No schedules found or error occurred');
        }
        
    } catch (error) {
        console.error('Test error:', error.message);
    }
}

testScheduleAPI();