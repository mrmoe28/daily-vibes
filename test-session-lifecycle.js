const { chromium } = require('playwright');

class AudioSessionTestSuite {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.testResults = [];
    }

    async setup() {
        console.log('🚀 Setting up comprehensive audio session test suite...');
        
        this.browser = await chromium.launch({ headless: false });
        this.context = await this.browser.newContext({
            permissions: ['microphone']
        });
        this.page = await this.context.newPage();
        
        // Enhanced error tracking
        this.page.on('console', msg => {
            if (msg.type() === 'error') {
                console.error('❌ Browser Error:', msg.text());
                this.testResults.push({
                    type: 'error',
                    message: msg.text(),
                    timestamp: new Date()
                });
            } else if (msg.text().includes('Session') || msg.text().includes('audio') || msg.text().includes('OpenAI')) {
                console.log('📊 Audio Log:', msg.text());
            }
        });
        
        this.page.on('pageerror', error => {
            console.error('❌ Page Error:', error.message);
            this.testResults.push({
                type: 'page_error',
                message: error.message,
                timestamp: new Date()
            });
        });
    }

    async runTest(testName, testFunction) {
        console.log(`\n🧪 Running test: ${testName}`);
        const startTime = Date.now();
        
        try {
            const result = await testFunction.call(this);
            const duration = Date.now() - startTime;
            
            console.log(`✅ ${testName} - PASSED (${duration}ms)`);
            this.testResults.push({
                type: 'test_result',
                testName,
                status: 'PASSED',
                duration,
                result,
                timestamp: new Date()
            });
            
            return true;
        } catch (error) {
            const duration = Date.now() - startTime;
            
            console.error(`❌ ${testName} - FAILED (${duration}ms):`, error.message);
            this.testResults.push({
                type: 'test_result',
                testName,
                status: 'FAILED',
                duration,
                error: error.message,
                timestamp: new Date()
            });
            
            return false;
        }
    }

    async testBasicConnection() {
        await this.page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
        await this.page.waitForTimeout(2000);

        // Check if RealtimeAudioClient is available
        const audioClientAvailable = await this.page.evaluate(() => {
            return typeof window.RealtimeAudioClient !== 'undefined';
        });

        if (!audioClientAvailable) {
            throw new Error('RealtimeAudioClient not available');
        }

        // Test WebSocket connection
        const connectionResult = await this.page.evaluate(async () => {
            try {
                return await window.RealtimeAudioClient.testConnection();
            } catch (error) {
                throw new Error(`Connection test failed: ${error.message}`);
            }
        });

        return { audioClientAvailable, connectionResult };
    }

    async testChatWidgetInitialization() {
        // Find and click the chat toggle
        const chatToggle = await this.page.waitForSelector('#aiChatToggle', { timeout: 5000 });
        await chatToggle.click();
        
        // Wait for widget to open
        await this.page.waitForTimeout(1000);
        
        // Check if widget is open
        const isOpen = await this.page.$eval('#aiChatWidget', el => el.classList.contains('open'));
        
        if (!isOpen) {
            throw new Error('Chat widget did not open');
        }

        // Check if voice button exists and is clickable
        const voiceBtn = await this.page.$('.voice-btn');
        if (!voiceBtn) {
            throw new Error('Voice button not found');
        }

        return { widgetOpen: isOpen, voiceBtnExists: true };
    }

    async testVoiceButtonFunctionality() {
        // Click voice button to start recording
        const voiceBtn = await this.page.$('.voice-btn');
        await voiceBtn.click();
        
        // Wait for connection
        await this.page.waitForTimeout(3000);
        
        // Check if recording started
        const isRecording = await this.page.$eval('.voice-btn', btn => btn.classList.contains('recording'));
        
        if (!isRecording) {
            // Check for error messages
            const errorMessages = await this.page.evaluate(() => {
                return Array.from(document.querySelectorAll('[class*="toast"], [class*="error"]')).map(el => el.textContent);
            });
            
            if (errorMessages.length > 0) {
                throw new Error(`Voice recording failed: ${errorMessages.join(', ')}`);
            }
        }

        // Stop recording
        await voiceBtn.click();
        await this.page.waitForTimeout(1000);

        return { recordingStarted: isRecording };
    }

    async testSessionRenewalNotifications() {
        // This test simulates session renewal by checking if the frontend can handle renewal messages
        const result = await this.page.evaluate(async () => {
            // Mock a session warning message
            if (window.aiChat && window.aiChat.audioClient) {
                const mockWarning = {
                    type: 'session.warning',
                    message: 'Session will expire in 10 minutes',
                    timeRemaining: 10 * 60 * 1000
                };
                
                // Trigger the warning handler
                if (window.aiChat.audioClient.onSessionWarning) {
                    window.aiChat.audioClient.onSessionWarning(mockWarning);
                    return { warningHandled: true };
                }
            }
            return { warningHandled: false };
        });

        return result;
    }

    async testErrorRecovery() {
        // Test how the system handles connection errors
        const result = await this.page.evaluate(async () => {
            if (window.aiChat && window.aiChat.audioClient) {
                // Simulate an error
                if (window.aiChat.audioClient.onError) {
                    window.aiChat.audioClient.onError('Simulated connection error');
                    return { errorHandled: true };
                }
            }
            return { errorHandled: false };
        });

        return result;
    }

    async testLongConnection() {
        console.log('🕐 Testing long connection stability (60 seconds)...');
        
        // Start voice connection
        const voiceBtn = await this.page.$('.voice-btn');
        await voiceBtn.click();
        await this.page.waitForTimeout(2000);

        // Monitor connection for 60 seconds
        const startTime = Date.now();
        let connectionStable = true;
        let errorCount = 0;

        while (Date.now() - startTime < 60000) { // 60 seconds
            // Check for errors in console
            const recentErrors = this.testResults.filter(r => 
                r.type === 'error' && 
                r.timestamp.getTime() > startTime
            ).length;

            if (recentErrors > errorCount) {
                console.log(`⚠️  Error detected during long connection test`);
                errorCount = recentErrors;
            }

            // Check connection status
            const status = await this.page.evaluate(() => {
                return window.aiChat?.audioClient?.getStatus() || null;
            });

            if (!status || !status.connected) {
                connectionStable = false;
                console.log('⚠️  Connection lost during long connection test');
            }

            await this.page.waitForTimeout(5000); // Check every 5 seconds
        }

        // Stop recording
        await voiceBtn.click();

        return { 
            connectionStable, 
            errorCount, 
            duration: Date.now() - startTime 
        };
    }

    async generateReport() {
        console.log('\n📊 COMPREHENSIVE TEST REPORT');
        console.log('=' .repeat(50));

        const passed = this.testResults.filter(r => r.type === 'test_result' && r.status === 'PASSED').length;
        const failed = this.testResults.filter(r => r.type === 'test_result' && r.status === 'FAILED').length;
        const errors = this.testResults.filter(r => r.type === 'error' || r.type === 'page_error').length;

        console.log(`✅ Tests Passed: ${passed}`);
        console.log(`❌ Tests Failed: ${failed}`);
        console.log(`🐛 Errors Detected: ${errors}`);
        console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

        if (failed > 0) {
            console.log('\n❌ FAILED TESTS:');
            this.testResults
                .filter(r => r.type === 'test_result' && r.status === 'FAILED')
                .forEach(test => {
                    console.log(`  - ${test.testName}: ${test.error}`);
                });
        }

        if (errors > 0) {
            console.log('\n🐛 ERRORS DETECTED:');
            this.testResults
                .filter(r => r.type === 'error' || r.type === 'page_error')
                .slice(-5) // Show last 5 errors
                .forEach(error => {
                    console.log(`  - ${error.message}`);
                });
        }

        // Check for session expiration issues
        const sessionErrors = this.testResults.filter(r => 
            r.message && r.message.includes('session_expired')
        ).length;

        if (sessionErrors > 0) {
            console.log(`\n🚨 SESSION EXPIRATION ISSUES DETECTED: ${sessionErrors}`);
        } else {
            console.log(`\n✅ NO SESSION EXPIRATION CASCADE DETECTED`);
        }

        return {
            passed,
            failed,
            errors,
            sessionErrors,
            successRate: (passed / (passed + failed)) * 100
        };
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    async runFullTestSuite() {
        try {
            await this.setup();

            // Run all tests
            await this.runTest('Basic Connection', this.testBasicConnection);
            await this.runTest('Chat Widget Initialization', this.testChatWidgetInitialization);
            await this.runTest('Voice Button Functionality', this.testVoiceButtonFunctionality);
            await this.runTest('Session Renewal Notifications', this.testSessionRenewalNotifications);
            await this.runTest('Error Recovery', this.testErrorRecovery);
            await this.runTest('Long Connection Stability', this.testLongConnection);

            const report = await this.generateReport();
            
            console.log('\n🎉 TEST SUITE COMPLETED');
            
            return report;

        } finally {
            await this.cleanup();
        }
    }
}

// Run the test suite if this file is executed directly
if (require.main === module) {
    const testSuite = new AudioSessionTestSuite();
    testSuite.runFullTestSuite().catch(console.error);
}

module.exports = AudioSessionTestSuite;