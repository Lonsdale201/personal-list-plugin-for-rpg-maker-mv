# personal-list-plugin-for-rpg-maker-mv
Personal (NPC) list system for rpg maker mv

# Personals Plugin

**Version:** 1.0  
**Author:** Kristof Soczó

## Description
A lightweight RPG Maker MV/MZ plugin that adds a customizable “Personals” menu to your game. Players can collect NPC entries by reading event comments, view face graphics, icons, categories and detailed notes. Other plugins or game events can react when an NPC is added or removed via a simple API.

## Installation
1. Copy `Personallist.js` into your project's `js/plugins/` folder.  
2. Open the Plugin Manager, add “Personallist” and configure:
   - **Menu Title**: The text shown in the menu list (default “Personals”).
   - **Initially Enabled**: Enable/disable the menu at game start.
   - **Open Menu Key**: A keyboard key (e.g. “pageup”, “q”) that instantly opens the Personals menu on the map.

## Plugin Commands
Use these in your event’s “Plugin Command” box:

| Command                        | Description                                                                                   |
|--------------------------------|-----------------------------------------------------------------------------------------------|
| `EnablePersonalMenu`           | Enables the Personals menu immediately.                                                      |
| `DisablePersonalMenu`          | Disables the Personals menu so it no longer appears in the menu list.                        |
| `AddPersonalToList`            | Scans the current event’s comments for an NPC block and adds/updates that entry.             |
| `AddPersonalToList <id>`       | Finds an NPC with the given ID across all events and adds or updates it in the list.         |
| `RemovePersonalFromList <id>`  | Removes the NPC with the given ID from the list and triggers any removal callbacks.          |

## Script Calls
You can query or hook into the list at runtime:

```js
// Returns true if NPC with ID 5 is in the player’s list
if ($gameSystem.isPersonalAdded(5)) {
  // then-branch…
}

// Register a callback when NPC 3 is added
$gameSystem.onPersonalAdded(3, function(id) {
  console.log(`NPC ${id} was added!`);
});

// Register a callback when NPC 3 is removed
$gameSystem.onPersonalRemoved(3, function(id) {
  console.log(`NPC ${id} was removed!`);
});
