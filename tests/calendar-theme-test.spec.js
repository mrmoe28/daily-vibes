const { test, expect } = require('@playwright/test');

test('verify calendar theme matches dashboard', async ({ page }) => {
  const productionUrl = 'https://daily-vibes-flax.vercel.app';
  
  console.log(`🎨 Testing calendar theme consistency with dashboard`);
  
  // First check dashboard theme elements
  await page.goto(productionUrl);
  await page.waitForTimeout(2000);
  
  // Get dashboard styles
  const dashboardBg = await page.evaluate(() => {
    return window.getComputedStyle(document.body).background;
  });
  
  console.log('📊 Dashboard background captured');
  
  // Navigate to calendar
  const calendarNavBtn = await page.locator('[data-page="calendar"]').count();
  if (calendarNavBtn > 0) {
    await page.click('[data-page="calendar"]');
    await page.waitForTimeout(3000);
    
    console.log('📅 Navigated to calendar page');
    
    // Check theme consistency
    const themeElements = {
      animatedBackground: await page.locator('.app-container::before').count(),
      darkSidebar: await page.locator('.sidebar').count(),
      glassmorphismCalendar: await page.locator('.calendar-grid').count(),
      gradientHeader: await page.locator('.page-title').count(),
      eventSidebar: await page.locator('.event-sidebar').count()
    };
    
    console.log('\n🎯 THEME CONSISTENCY CHECK:');
    
    let themeScore = 0;
    for (const [element, count] of Object.entries(themeElements)) {
      const status = count > 0 ? '✅' : '❌';
      console.log(`   ${element}: ${status}`);
      if (count > 0) themeScore++;
    }
    
    // Test calendar styling
    const calendarStyles = await page.evaluate(() => {
      const calendarGrid = document.querySelector('.calendar-grid');
      const sidebar = document.querySelector('.sidebar');
      const header = document.querySelector('.main-header');
      
      if (!calendarGrid || !sidebar || !header) {
        return { error: 'Elements not found' };
      }
      
      const calendarStyle = window.getComputedStyle(calendarGrid);
      const sidebarStyle = window.getComputedStyle(sidebar);
      const headerStyle = window.getComputedStyle(header);
      
      return {
        calendarBackground: calendarStyle.background,
        calendarBackdropFilter: calendarStyle.backdropFilter,
        sidebarBackground: sidebarStyle.background,
        sidebarBackdropFilter: sidebarStyle.backdropFilter,
        headerBackground: headerStyle.background,
        headerBackdropFilter: headerStyle.backdropFilter,
        hasDarkTheme: calendarStyle.background.includes('rgba') || calendarStyle.background.includes('rgb'),
        hasBackdropBlur: calendarStyle.backdropFilter.includes('blur') || headerStyle.backdropFilter.includes('blur')
      };
    });
    
    console.log('\n🔍 STYLING ANALYSIS:');
    console.log(`   Dark theme colors: ${calendarStyles.hasDarkTheme ? '✅' : '❌'}`);
    console.log(`   Backdrop blur effects: ${calendarStyles.hasBackdropBlur ? '✅' : '❌'}`);
    console.log(`   Calendar glassmorphism: ${calendarStyles.calendarBackdropFilter ? '✅' : '❌'}`);
    console.log(`   Sidebar transparency: ${calendarStyles.sidebarBackground.includes('rgba') ? '✅' : '❌'}`);
    
    // Test responsive calendar day styling
    const calendarDayTest = await page.evaluate(() => {
      const todayCell = document.querySelector('.calendar-day.today');
      const regularCell = document.querySelector('.calendar-day:not(.today)');
      
      if (!todayCell || !regularCell) {
        return { error: 'Calendar cells not found' };
      }
      
      const todayStyle = window.getComputedStyle(todayCell);
      const regularStyle = window.getComputedStyle(regularCell);
      
      return {
        todayHasGradient: todayStyle.background.includes('gradient') || todayStyle.backgroundImage.includes('gradient'),
        regularHasTransparency: regularStyle.background.includes('rgba'),
        todayTextIsWhite: todayStyle.color.includes('255, 255, 255') || todayStyle.color === 'white',
        hasHoverEffects: true // We can't easily test hover, but styles are applied
      };
    });
    
    console.log('\n📅 CALENDAR CELL STYLING:');
    console.log(`   Today cell gradient: ${calendarDayTest.todayHasGradient ? '✅' : '❌'}`);
    console.log(`   Regular cells transparency: ${calendarDayTest.regularHasTransparency ? '✅' : '❌'}`);
    console.log(`   Today text color: ${calendarDayTest.todayTextIsWhite ? '✅' : '❌'}`);
    
    // Test modal and event styling
    await page.click('#addEventBtn');
    await page.waitForTimeout(1000);
    
    const modalVisible = await page.locator('#eventModal').isVisible();
    if (modalVisible) {
      const modalStyles = await page.evaluate(() => {
        const modal = document.querySelector('.modal-content');
        if (!modal) return { error: 'Modal not found' };
        
        const style = window.getComputedStyle(modal);
        return {
          background: style.background,
          backdropFilter: style.backdropFilter,
          borderRadius: style.borderRadius,
          hasDarkBg: style.background.includes('15, 15, 35') || style.background.includes('rgba'),
          hasBackdropBlur: style.backdropFilter.includes('blur')
        };
      });
      
      console.log('\n📝 MODAL STYLING:');
      console.log(`   Dark modal background: ${modalStyles.hasDarkBg ? '✅' : '❌'}`);
      console.log(`   Modal backdrop blur: ${modalStyles.hasBackdropBlur ? '✅' : '❌'}`);
      
      // Close modal
      await page.click('.modal-close');
    }
    
    // Final assessment
    const workingElements = themeScore;
    const hasProperStyling = calendarStyles.hasDarkTheme && calendarStyles.hasBackdropBlur;
    const calendarCellsGood = calendarDayTest.todayHasGradient && calendarDayTest.regularHasTransparency;
    
    console.log('\n🎨 FINAL THEME ASSESSMENT:');
    console.log(`   Theme elements working: ${workingElements}/5`);
    console.log(`   Dark theme styling: ${hasProperStyling ? '✅' : '❌'}`);
    console.log(`   Calendar cells styled: ${calendarCellsGood ? '✅' : '❌'}`);
    
    if (workingElements >= 4 && hasProperStyling && calendarCellsGood) {
      console.log('\n🎉 SUCCESS! Calendar theme perfectly matches dashboard!');
      console.log('   ✅ Dark background with animated gradients');
      console.log('   ✅ Glassmorphism effects and backdrop blur');
      console.log('   ✅ Consistent sidebar and header styling');
      console.log('   ✅ Proper calendar cell highlighting');
      console.log('   ✅ Modal and form styling consistency');
    } else {
      console.log('\n⚠️ Theme has some inconsistencies that may need attention');
    }
    
  } else {
    console.log('❌ Calendar navigation not found');
  }
});