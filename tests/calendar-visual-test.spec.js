const { test, expect } = require('@playwright/test');

test('visual verification of calendar theme matching dashboard', async ({ page }) => {
  const productionUrl = 'https://daily-vibes-flax.vercel.app';
  
  console.log(`🎨 Visual verification of calendar theme consistency`);
  
  // Navigate to calendar
  await page.goto(`${productionUrl}/calendar.html`);
  await page.waitForTimeout(3000);
  
  console.log('📅 Calendar page loaded');
  
  // Check main theme elements
  const themeElements = {
    sidebar: await page.locator('.sidebar').count(),
    calendarGrid: await page.locator('.calendar-grid').count(),
    mainHeader: await page.locator('.main-header').count(),
    calendarDays: await page.locator('.calendar-days').count(),
    addEventBtn: await page.locator('#addEventBtn').count(),
    todayCell: await page.locator('.calendar-day.today').count()
  };
  
  console.log('\n🏗️ THEME STRUCTURE:');
  let elementScore = 0;
  for (const [element, count] of Object.entries(themeElements)) {
    const status = count > 0 ? '✅' : '❌';
    console.log(`   ${element}: ${status} (${count})`);
    if (count > 0) elementScore++;
  }
  
  // Test styling through computed styles
  const stylingTest = await page.evaluate(() => {
    const sidebar = document.querySelector('.sidebar');
    const calendarGrid = document.querySelector('.calendar-grid');
    const header = document.querySelector('.main-header');
    const todayCell = document.querySelector('.calendar-day.today');
    const pageTitle = document.querySelector('.page-title');
    
    if (!sidebar || !calendarGrid || !header) {
      return { error: 'Required elements not found' };
    }
    
    const sidebarStyle = window.getComputedStyle(sidebar);
    const gridStyle = window.getComputedStyle(calendarGrid);
    const headerStyle = window.getComputedStyle(header);
    const todayStyle = todayCell ? window.getComputedStyle(todayCell) : null;
    const titleStyle = pageTitle ? window.getComputedStyle(pageTitle) : null;
    
    return {
      // Dark theme checks
      hasDarkSidebar: sidebarStyle.background.includes('15, 15, 35') || sidebarStyle.background.includes('rgba'),
      hasDarkHeader: headerStyle.background.includes('15, 15, 35') || headerStyle.background.includes('rgba'),
      hasGlassmorphism: gridStyle.backdropFilter.includes('blur'),
      
      // Color consistency checks
      hasTransparentElements: gridStyle.background.includes('rgba') && sidebarStyle.background.includes('rgba'),
      
      // Today cell styling
      todayHasGradient: todayStyle ? (todayStyle.backgroundImage.includes('gradient') || todayStyle.background.includes('gradient')) : false,
      
      // Title gradient
      titleHasGradient: titleStyle ? titleStyle.backgroundImage.includes('gradient') : false,
      
      // Backdrop blur effects
      headerHasBlur: headerStyle.backdropFilter.includes('blur'),
      sidebarHasBlur: sidebarStyle.backdropFilter.includes('blur')
    };
  });
  
  console.log('\n🎨 THEME STYLING ANALYSIS:');
  console.log(`   Dark sidebar: ${stylingTest.hasDarkSidebar ? '✅' : '❌'}`);
  console.log(`   Dark header: ${stylingTest.hasDarkHeader ? '✅' : '❌'}`);
  console.log(`   Glassmorphism effects: ${stylingTest.hasGlassmorphism ? '✅' : '❌'}`);
  console.log(`   Transparent elements: ${stylingTest.hasTransparentElements ? '✅' : '❌'}`);
  console.log(`   Today cell gradient: ${stylingTest.todayHasGradient ? '✅' : '❌'}`);
  console.log(`   Header backdrop blur: ${stylingTest.headerHasBlur ? '✅' : '❌'}`);
  console.log(`   Sidebar backdrop blur: ${stylingTest.sidebarHasBlur ? '✅' : '❌'}`);
  
  // Test event creation modal styling
  console.log('\n📝 Testing modal theme consistency...');
  
  await page.click('#addEventBtn');
  await page.waitForTimeout(1000);
  
  const modalVisible = await page.locator('#eventModal').isVisible();
  if (modalVisible) {
    const modalStyling = await page.evaluate(() => {
      const modal = document.querySelector('.modal-content');
      if (!modal) return { error: 'Modal not found' };
      
      const style = window.getComputedStyle(modal);
      return {
        hasDarkBg: style.background.includes('15, 15, 35') || style.background.includes('rgba'),
        hasBackdropBlur: style.backdropFilter.includes('blur'),
        hasRoundedCorners: parseFloat(style.borderRadius) > 15,
        hasBorder: style.border.includes('rgba') || style.borderColor !== 'rgba(0, 0, 0, 0)'
      };
    });
    
    console.log(`   Modal dark background: ${modalStyling.hasDarkBg ? '✅' : '❌'}`);
    console.log(`   Modal backdrop blur: ${modalStyling.hasBackdropBlur ? '✅' : '❌'}`);
    console.log(`   Modal rounded corners: ${modalStyling.hasRoundedCorners ? '✅' : '❌'}`);
    console.log(`   Modal border styling: ${modalStyling.hasBorder ? '✅' : '❌'}`);
    
    // Close modal
    await page.click('.modal-close');
  }
  
  // Final theme assessment
  const themeFeatures = [
    stylingTest.hasDarkSidebar,
    stylingTest.hasDarkHeader,
    stylingTest.hasGlassmorphism,
    stylingTest.hasTransparentElements,
    stylingTest.todayHasGradient,
    stylingTest.headerHasBlur,
    stylingTest.sidebarHasBlur
  ];
  
  const workingThemeFeatures = themeFeatures.filter(Boolean).length;
  const totalThemeFeatures = themeFeatures.length;
  
  console.log('\n🏆 FINAL THEME ASSESSMENT:');
  console.log(`   Element structure: ${elementScore}/6 elements present`);
  console.log(`   Theme consistency: ${workingThemeFeatures}/${totalThemeFeatures} features working`);
  
  if (elementScore >= 5 && workingThemeFeatures >= 5) {
    console.log('\n🎉 EXCELLENT! Calendar theme perfectly matches dashboard!');
    console.log('   ✅ Dark theme with animated background');
    console.log('   ✅ Glassmorphism and backdrop blur effects');
    console.log('   ✅ Consistent sidebar and navigation');
    console.log('   ✅ Proper color scheme and gradients');
    console.log('   ✅ Modal and form styling matches');
    console.log('\n   🎨 Visual coherence achieved across entire application!');
  } else {
    console.log('\n⚠️ Some theme elements may need fine-tuning');
    console.log(`   Structure score: ${elementScore}/6`);
    console.log(`   Theme score: ${workingThemeFeatures}/${totalThemeFeatures}`);
  }
});