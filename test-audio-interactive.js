const { chromium } = require('playwright');

async function interactiveAudioTest() {
    console.log('🎵 Starting Interactive Audio Test with Playwright');
    console.log('👂 You will be able to hear and test the audio functionality\n');
    
    const browser = await chromium.launch({ 
        headless: false,  // Show browser so you can see and interact
        slowMo: 500,      // Slow down actions to make them visible
        devtools: true,   // Open DevTools for monitoring
        args: [
            '--use-fake-ui-for-media-stream',  // Auto-accept microphone permissions
            '--autoplay-policy=no-user-gesture-required'  // Allow audio playback without user gesture
        ]
    });
    
    const context = await browser.newContext({
        permissions: ['microphone'],
        // Record video for debugging if needed
        recordVideo: {
            dir: './test-videos',
            size: { width: 1280, height: 720 }
        }
    });
    
    const page = await context.newPage();
    
    // Add console logging to see what's happening
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        
        if (type === 'error') {
            console.error('❌ Browser Error:', text);
        } else if (text.includes('Audio') || text.includes('audio') || 
                   text.includes('Session') || text.includes('WebSocket') ||
                   text.includes('Recording') || text.includes('Voice')) {
            console.log(`🔊 ${type.toUpperCase()}: ${text}`);
        }
    });
    
    page.on('pageerror', error => {
        console.error('❌ Page Error:', error.message);
    });

    try {
        console.log('📄 Loading Daily Vibes application...');
        await page.goto('http://localhost:3000', { 
            waitUntil: 'networkidle',
            timeout: 30000 
        });
        
        // Wait for page to fully load
        await page.waitForTimeout(2000);
        console.log('✅ Page loaded successfully\n');

        // Check if audio client is available
        const audioSupport = await page.evaluate(() => {
            if (typeof window.RealtimeAudioClient === 'undefined') {
                return { available: false };
            }
            
            const support = window.RealtimeAudioClient.isSupported();
            return {
                available: true,
                ...support
            };
        });
        
        if (audioSupport.available) {
            console.log('✅ Audio Client Status:');
            console.log('   - WebSocket Support:', audioSupport.webSocket ? '✅' : '❌');
            console.log('   - Audio Context Support:', audioSupport.audioContext ? '✅' : '❌');
            console.log('   - Media Devices Support:', audioSupport.mediaDevices ? '✅' : '❌');
        } else {
            console.log('❌ Audio client not available');
        }

        console.log('\n🤖 Opening AI Chat Widget...');
        
        // Force show the chat toggle and open the widget immediately
        console.log('🤖 Force opening chat widget...');
        
        await page.evaluate(() => {
            // Force show toggle button
            const toggle = document.getElementById('aiChatToggle');
            if (toggle) {
                toggle.classList.remove('hidden');
                toggle.style.display = 'block';
                toggle.style.visibility = 'visible';
                console.log('Chat toggle made visible');
            }
        });
        
        await page.waitForTimeout(1000);
        
        // Force click the toggle
        await page.click('#aiChatToggle', { force: true });
        await page.waitForTimeout(1500);
        
        // Force open the widget
        await page.evaluate(() => {
            const widget = document.getElementById('aiChatWidget');
            if (widget) {
                widget.classList.add('open');
                widget.style.display = 'flex';
                console.log('Chat widget forced open');
                
                // Check for AI chat instance
                if (window.aiChat) {
                    console.log('AI Chat instance found:', typeof window.aiChat);
                } else {
                    console.log('AI Chat instance not found - initializing manually');
                    // Try to initialize manually
                    if (window.AIChatWidget) {
                        window.aiChat = new window.AIChatWidget();
                        console.log('AI Chat manually initialized');
                    }
                }
            }
        });
        
        console.log('✅ Chat widget opened');
        
        // Wait for widget to fully open
        await page.waitForTimeout(1500);
        
        // Check if the widget properly opened and elements exist
        const widgetStatus = await page.evaluate(() => {
            const widget = document.getElementById('aiChatWidget');
            const chatStatus = document.getElementById('chatStatus');
            const voiceBtn = document.querySelector('.voice-btn');
            
            return {
                widgetExists: !!widget,
                widgetOpen: widget ? widget.classList.contains('open') : false,
                chatStatusExists: !!chatStatus,
                voiceBtnExists: !!voiceBtn,
                chatStatusContent: chatStatus ? chatStatus.textContent : null
            };
        });
        
        console.log('📊 Widget Status Check:');
        console.log('   - Widget Exists:', widgetStatus.widgetExists ? '✅' : '❌');
        console.log('   - Widget Open:', widgetStatus.widgetOpen ? '✅' : '❌');
        console.log('   - Chat Status Element:', widgetStatus.chatStatusExists ? '✅' : '❌');
        console.log('   - Voice Button:', widgetStatus.voiceBtnExists ? '✅' : '❌');
        if (widgetStatus.chatStatusContent) {
            console.log('   - Current Status:', widgetStatus.chatStatusContent);
        }
        
        // Check if voice button exists
        const voiceButtonExists = await page.$('.voice-btn') !== null;
        
        if (voiceButtonExists) {
            console.log('✅ Voice button found\n');
            
            console.log('🎤 TESTING VOICE FUNCTIONALITY');
            console.log('================================');
            console.log('1. Testing WebSocket connection...');
            
            // Test WebSocket connection first
            const connectionTest = await page.evaluate(async () => {
                try {
                    const result = await window.RealtimeAudioClient.testConnection();
                    return { success: true, result };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            });
            
            if (connectionTest.success) {
                console.log('   ✅ WebSocket connection successful\n');
            } else {
                console.log('   ❌ WebSocket connection failed:', connectionTest.error, '\n');
            }
            
            console.log('2. Attempting to start voice recording...');
            console.log('   (Note: Using fake audio device for testing)\n');
            
            // Click voice button to start recording
            const voiceBtn = await page.$('.voice-btn');
            await voiceBtn.click();
            
            // Wait for connection and recording to start
            await page.waitForTimeout(3000);
            
            // Check recording status
            const recordingStatus = await page.evaluate(() => {
                if (window.aiChat && window.aiChat.audioClient) {
                    return {
                        connected: window.aiChat.audioClient.isConnected,
                        recording: window.aiChat.audioClient.isRecording,
                        status: window.aiChat.audioClient.getStatus()
                    };
                }
                return null;
            });
            
            if (recordingStatus) {
                console.log('📊 Audio Client Status:');
                console.log('   - Connected:', recordingStatus.connected ? '✅' : '❌');
                console.log('   - Recording:', recordingStatus.recording ? '✅' : '❌');
                console.log('   - Full Status:', JSON.stringify(recordingStatus.status, null, 2));
            }
            
            console.log('\n🎯 INTERACTIVE TEST MODE');
            console.log('========================');
            console.log('The browser window is now open for you to:');
            console.log('');
            console.log('1. 🎤 Click the microphone button to test voice input');
            console.log('2. 🗣️  Speak to test audio recording (if microphone allowed)');
            console.log('3. 🔊 Listen for audio responses from the AI');
            console.log('4. 💬 Type messages in the chat to test text interaction');
            console.log('5. 📝 Check the console for any errors or warnings');
            console.log('');
            console.log('⏰ The test will keep running for 2 minutes...');
            console.log('   (Or press Ctrl+C to stop earlier)\n');
            
            // Monitor for session events
            await page.evaluate(() => {
                if (window.aiChat && window.aiChat.audioClient) {
                    // Add temporary listeners for session events
                    const originalWarning = window.aiChat.audioClient.onSessionWarning;
                    window.aiChat.audioClient.onSessionWarning = (msg) => {
                        console.log('🔔 SESSION WARNING:', msg);
                        if (originalWarning) originalWarning(msg);
                    };
                    
                    const originalRenewal = window.aiChat.audioClient.onSessionRenewed;
                    window.aiChat.audioClient.onSessionRenewed = (msg) => {
                        console.log('🔄 SESSION RENEWED:', msg);
                        if (originalRenewal) originalRenewal(msg);
                    };
                    
                    const originalError = window.aiChat.audioClient.onError;
                    window.aiChat.audioClient.onError = (error) => {
                        console.error('🚨 AUDIO ERROR:', error);
                        if (originalError) originalError(error);
                    };
                }
            });
            
            // Periodic status checks
            let checkCount = 0;
            const statusInterval = setInterval(async () => {
                checkCount++;
                
                const currentStatus = await page.evaluate(() => {
                    if (window.aiChat && window.aiChat.audioClient) {
                        return {
                            connected: window.aiChat.audioClient.isConnected,
                            recording: window.aiChat.audioClient.isRecording,
                            playing: window.aiChat.audioClient.isPlaying
                        };
                    }
                    return null;
                });
                
                if (currentStatus) {
                    console.log(`\n⏱️  Status Check #${checkCount}:`);
                    console.log(`   Connected: ${currentStatus.connected ? '✅' : '❌'} | ` +
                               `Recording: ${currentStatus.recording ? '🔴' : '⚪'} | ` +
                               `Playing: ${currentStatus.playing ? '🔊' : '🔇'}`);
                }
            }, 15000); // Check every 15 seconds
            
            // Keep the browser open for 5 minutes for extensive testing
            await page.waitForTimeout(300000);
            
            clearInterval(statusInterval);
            
        } else {
            console.log('❌ Voice button not found in the interface');
            console.log('   This might indicate the audio feature is not properly initialized');
        }
        
        console.log('\n📸 Test completed!');
        console.log('   Video saved to: ./test-videos (if recording was enabled)');
        
    } catch (error) {
        console.error('\n❌ Test failed with error:', error.message);
        console.error('Stack trace:', error.stack);
    } finally {
        console.log('\n🧹 Cleaning up...');
        
        // Take a final screenshot
        try {
            await page.screenshot({ 
                path: 'test-audio-final-state.png',
                fullPage: true 
            });
            console.log('📸 Final screenshot saved to: test-audio-final-state.png');
        } catch (e) {
            // Ignore screenshot errors
        }
        
        await context.close();
        await browser.close();
        console.log('✅ Test completed and browser closed');
    }
}

// Run the test
console.log('🚀 Daily Vibes Audio Feature Test');
console.log('==================================\n');

interactiveAudioTest().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});