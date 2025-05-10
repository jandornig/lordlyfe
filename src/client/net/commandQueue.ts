import { Command } from '../../types/game';

// Internal command buffer
const commandBuffer: Command[] = [];

// Queue a command
export function queue(command: Command) {
  commandBuffer.push(command);
}

// Drain all commands for the current turn
export function drainForTurn(): Command[] {
  return commandBuffer.splice(0);
} 