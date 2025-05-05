let uniqueIdCounter = 0;
let armyIdCounter = 0;

export const generateUniqueId = (): string => {
  return `id_${uniqueIdCounter++}`;
};

export const generateArmyId = (): string => {
  return `army_${armyIdCounter++}`;
}; 