# Test info

- Name: should allow user to enter name and create room
- Location: C:\Users\Jan\Documents\games\Lordlyfe\tests\matchmaking.spec.ts:3:1

# Error details

```
Error: Timed out 5000ms waiting for expect(locator).toBeEnabled()

Locator: getByTestId('create-room-button')
Expected: enabled
Received: disabled
Call log:
  - expect.toBeEnabled with timeout 5000ms
  - waiting for getByTestId('create-room-button')
    9 × locator resolved to <button disabled data-testid="create-room-button" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">Create Room</button>
      - unexpected value "disabled"

    at C:\Users\Jan\Documents\games\Lordlyfe\tests\matchmaking.spec.ts:15:30
```

# Page snapshot

```yaml
- region "Notifications (F8)":
  - list
- region "Notifications alt+T"
- heading "Welcome to Lordlyfe" [level=3]
- paragraph: Create or join a game room to start playing
- text: Your Name
- textbox "Your Name": TestPlayer
- text: Room ID (Optional)
- textbox "Room ID (Optional)"
- checkbox "Add Bot Player"
- text: Add Bot Player
- button "Create Room" [disabled]
- button "Join Room" [disabled]
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 |
   3 | test('should allow user to enter name and create room', async ({ page }) => {
   4 |   // Navigate to the lobby
   5 |   await page.goto('http://localhost:5173');
   6 |   
   7 |   // Wait for the page to load
   8 |   await page.waitForSelector('input[id="name"]');
   9 |   
  10 |   // Enter player name
  11 |   await page.fill('input[id="name"]', 'TestPlayer');
  12 |   
  13 |   // Verify the create room button is enabled
  14 |   const createButton = page.getByTestId('create-room-button');
> 15 |   await expect(createButton).toBeEnabled();
     |                              ^ Error: Timed out 5000ms waiting for expect(locator).toBeEnabled()
  16 |   
  17 |   // Click create room
  18 |   await createButton.click();
  19 |   
  20 |   // Wait for navigation to game page
  21 |   await page.waitForURL('**/game');
  22 |   
  23 |   // Verify we're on the game page
  24 |   expect(page.url()).toContain('/game');
  25 | }); 
```