import { test, expect } from '@playwright/test';

test('complete game flow with bot player', async ({ page }) => {
  // Start at the lobby
  await page.goto('/');
  
  // Wait for the lobby to load
  await expect(page.getByText('Welcome to Lordlyfe')).toBeVisible();
  
  // Enter player name
  await page.getByLabel('Your Name').fill('Test Player');
  
  // Check the "Add Bot Player" checkbox
  await page.getByLabel('Add Bot Player').check();
  
  // Create a room
  await page.getByRole('button', { name: 'Create Room' }).click();
  
  // Wait for the game to load
  await expect(page.getByText('Game Board')).toBeVisible();
  
  // Wait for the bot player to join
  await expect(page.getByText('Bot Player')).toBeVisible();
  
  // Set player to ready
  await page.getByRole('button', { name: 'Ready' }).click();
  
  // Wait for the game to start
  await expect(page.getByText('Your Turn')).toBeVisible();
  
  // Make an army movement
  // First, find an army to move
  const army = await page.locator('.army').first();
  await army.click();
  
  // Find a valid move location and click it
  const moveLocation = await page.locator('.valid-move').first();
  await moveLocation.click();
  
  // Verify the army moved
  await expect(army).toHaveAttribute('data-moved', 'true');
}); 