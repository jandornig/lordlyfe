import { test, expect } from '@playwright/test';

test('should allow user to enter name and create room', async ({ page }) => {
  // Navigate to the lobby
  await page.goto('http://localhost:5173');
  
  // Wait for the page to load
  await page.waitForSelector('input[id="name"]');
  
  // Enter player name
  await page.fill('input[id="name"]', 'TestPlayer');
  
  // Verify the create room button is enabled
  const createButton = page.getByTestId('create-room-button');
  await expect(createButton).toBeEnabled();
  
  // Click create room
  await createButton.click();
  
  // Wait for navigation to game page
  await page.waitForURL('**/game');
  
  // Verify we're on the game page
  expect(page.url()).toContain('/game');
}); 